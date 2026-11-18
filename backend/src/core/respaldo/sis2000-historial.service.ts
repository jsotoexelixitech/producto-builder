import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  canalesEnPlanHabilitado,
  cuerpoPlan,
  PartnerBridgeService,
} from '../../partner-bridge/partner-bridge.service';
import {
  aCrearCobertura,
  aCrearDetalleTarifa,
  aCrearTarifa,
  aEditarCobertura,
  aBajaComision,
  aComision,
  aDeducibleCoberturaPlan,
  aEditarDetalleTarifa,
  aEditarTarifa,
  aProveedorPlan,
  aTasasAntiguedad,
  aTipoUso,
  partirPlanId,
} from '../../partner-bridge/configurador.mapper';
import {
  dtoToPartnerPayload,
  PartnerProductPayload,
  rowToPartnerForm,
} from '../../partner-bridge/partner-product.mapper';
import { OperacionRespaldada, Sis2000RespaldoService } from './sis2000-respaldo.service';
import {
  ContextoCambio,
  EntidadRespaldo,
  NOMBRE_ENTIDAD,
  RESPALDO_REPO,
  RespaldoRepo,
  VersionRow,
} from './respaldo.types';

type Obj = Record<string, unknown>;
const t = (v: unknown) => String(v ?? '').trim();
const up = (v: unknown) => t(v).toUpperCase();
const hoy = () => new Date().toISOString().slice(0, 10);

/** Claves de cada entidad en el historial (mayúsculas: Sis2000 compara sin distinguir). */
export const claveRespaldo = {
  cobertura: (cramo: unknown, ccobertura: unknown) => `${Number(cramo)}-${up(ccobertura)}`,
  tarifa: (cramo: unknown, ccober: unknown, ctarifa: unknown) => `${Number(cramo)}-${up(ccober)}-${up(ctarifa)}`,
  plan: (cramo: unknown, cplan: unknown) => `${Number(cramo)}-${up(cplan)}`,
  producto: (cproducto: unknown) => up(cproducto),
  /**
   * Secciones del plan o del ramo que no se reescriben con spMantPlanes (comisiones, deducibles del plan, tasas por
   * antigüedad, tipo y uso del ramo). Van en la misma tabla de respaldo, con la clave del plan + «:SECCION», para no
   * mezclarse con las versiones del plan ni necesitar una migración.
   */
  seccionPlan: (cramo: unknown, cplan: unknown, seccion: SeccionRespaldo) => `${Number(cramo)}-${up(cplan)}:${seccion}`,
  /** macattip es del ramo (afecta a todos sus planes): «18-*:TIPOS-USO». */
  tiposUsoRamo: (cramo: unknown) => `${Number(cramo)}-*:TIPOS-USO`,
  /** Secciones del ramo (fase 2: dispositivos, sustancias, condominio, tasa de casco): «28-*:DISPOSITIVOS». */
  seccionRamo: (cramo: unknown, seccion: SeccionRamoRespaldo) => `${Number(cramo)}-*:${seccion}`,
};

export type SeccionRespaldo =
  | 'COMISIONES'
  | 'DEDUCIBLES'
  | 'TASAS-ANTIGUEDAD'
  // Fase 2 («editar todo»)
  | 'CABECERA'
  | 'COBERTURAS'
  | 'FRECUENCIAS'
  | 'FRECUENCIAS-PRODUCTOR'
  | 'QUIEN-VENDE'
  | 'EDADES'
  | 'TARIFA-DIAS';

export type SeccionRamoRespaldo =
  | 'DISPOSITIVOS'
  | 'SUSTANCIAS'
  | 'CONDOMINIO-ANTIGUEDAD'
  | 'CONDOMINIO-REPARTO'
  | 'CONDOMINIO-RANGO'
  | 'TASA-CASCO';

/** Claves de sección (tienen «:»): se respaldan, pero restaurarlas aún no está disponible. */
export const esClaveSeccion = (clave: string) => clave.includes(':');

/** nest-api respondió grabado: false (pide confirmar advertencias): no grabó nada (la versión queda FALLIDA). */
class SinGrabarPorAdvertencias extends Error {
  constructor(readonly respuesta: Obj) {
    const adv = Array.isArray(respuesta.advertencias) ? (respuesta.advertencias as unknown[]).map(String).join(' | ') : '';
    super(`No se grabó: falta confirmar las advertencias de nest-api.${adv ? ` ${adv}` : ''}`.slice(0, 1000));
  }
}

/** "28-12" → [28, "12"]; "28-12-1" → [28, "12", "1"]. */
function partes(clave: string, n: number): [number, ...string[]] {
  const [cramo, ...resto] = clave.split('-');
  if (n === 2) return [Number(cramo), resto.join('-')];
  return [Number(cramo), resto[0] ?? '', resto.slice(1).join('-')];
}

export type MomentoVersion = 'antes' | 'despues';

/** Lo que se compara del plan para «qué cambió»: el plan en forma de PlanDto, no las filas crudas. */
const planComparable = (s: unknown) =>
  s && typeof s === 'object' && 'plan' in (s as Obj) ? (s as Obj).plan : s;

const claveProveedor = (r: Obj) => `${t(r.cci_rif)}/${t(r.cclave_num)}/${t(r.fdesde).slice(0, 10)}`;
const datosProveedor = (r: Obj) => ({
  fhasta: r.fhasta ? t(r.fhasta).slice(0, 10) : null,
  itiposerv: r.itiposerv ?? null,
  mcosto: r.mcosto == null ? null : Number(r.mcosto),
  mcostoext: r.mcostoext == null ? null : Number(r.mcostoext),
  cmoneda: t(r.cmoneda) || null,
});
const proveedoresComparable = (s: unknown) =>
  Array.isArray(s) ? Object.fromEntries((s as Obj[]).map((r) => [claveProveedor(r), datosProveedor(r)])) : s;

const CAMPOS_COBERTURA = [
  'xdescripcion_l',
  'xdescripcion_c',
  'xabreviatura',
  'bobligatoria',
  'iestado',
  'ccontrea',
  'cramorea',
  'cramopcnd',
];
const CAMPOS_TARIFA = ['xtarifam', 'xtarifa', 'bobligatoria', 'iestado'];
const CAMPOS_DETALLE = ['fhasta', 'msumamin', 'msumamax', 'mprima', 'pprima', 'bfraded', 'mdedu_fran', 'mdedu_franext', 'pdedu_fran'];

const elegir = (o: Obj, campos: string[]) =>
  Object.fromEntries(campos.filter((c) => o[c] !== undefined && o[c] !== null).map((c) => [c, o[c]]));

/**
 * Escrituras del configurador en Sis2000 con respaldo previo (Sis2000RespaldoService) y restauración por el mismo
 * camino de nest-api. Cubre producto, cobertura (incluye reaseguro), tarifa (con sus tasas), plan (coberturas del plan,
 * productores, canales, frecuencias; también los combos, que crean planes) y proveedores del plan.
 */
@Injectable()
export class Sis2000HistorialService {
  constructor(
    private readonly bridge: PartnerBridgeService,
    private readonly respaldo: Sis2000RespaldoService,
    @Inject(RESPALDO_REPO) private readonly repo: RespaldoRepo,
    private readonly prisma: PrismaService,
  ) {}

  // ── Lectura del estado actual en Sis2000 (null = no existe; error = no se pudo leer) ──

  async leerCobertura(cramo: number, ccobertura: string): Promise<Obj | null> {
    const filas = await this.bridge.listSis2000CoberturasByRamo(String(cramo));
    return filas.find((f) => up(f.ccobertura) === up(ccobertura)) ?? null;
  }

  async leerTarifa(cramo: number, ccober: string, ctarifa: string): Promise<Obj | null> {
    const tarifas = await this.bridge.listSis2000TarifasByRamoCobertura(String(cramo), t(ccober));
    return tarifas.find((f) => up(f.ctarifa) === up(ctarifa)) ?? null;
  }

  leerPlan(cramo: number, cplan: string): Promise<Obj | null> {
    return this.bridge.leerSis2000Plan(cramo, cplan);
  }

  async leerProducto(cproducto: string): Promise<Obj | null> {
    if (!(await this.bridge.productExists(t(cproducto)))) return null;
    return rowToPartnerForm(await this.bridge.getProductDetail(t(cproducto)));
  }

  async leerProveedoresPlan(cramo: number, cplan: string): Promise<Obj[]> {
    return (await this.bridge.listSis2000PlanProveedores(cramo, cplan)).proveedores;
  }

  // ── Escrituras con respaldo ────────────────────────────────────────────────

  crearCobertura(body: Obj, ctx?: ContextoCambio) {
    const cramo = Number(body.cramo);
    const ccob = t(body.ccobertura);
    this.exigirClave(cramo > 0 && Boolean(ccob), 'Faltan el ramo (cramo) y el código de la cobertura (ccobertura).');
    return this.escribir(ctx, {
      entidad: 'COBERTURA',
      clave: claveRespaldo.cobertura(cramo, ccob),
      leer: () => this.leerCobertura(cramo, ccob),
      escribir: () => this.bridge.createSis2000Cobertura(body),
      payload: aCrearCobertura(body),
    });
  }

  editarCobertura(cramo: number, ccobertura: string, body: Obj, ctx?: ContextoCambio) {
    return this.escribir(ctx, {
      entidad: 'COBERTURA',
      clave: claveRespaldo.cobertura(cramo, ccobertura),
      leer: () => this.leerCobertura(cramo, ccobertura),
      escribir: () => this.bridge.updateSis2000Cobertura(String(cramo), ccobertura, body),
      payload: aEditarCobertura(body),
      exigirExistente: true,
    });
  }

  crearTarifa(body: Obj, ctx?: ContextoCambio) {
    const cramo = Number(body.cramo);
    const ccober = t(body.ccober ?? body.ccobertura);
    const ctarifa = t(body.ctarifa);
    this.exigirClave(cramo > 0 && Boolean(ccober) && Boolean(ctarifa), 'Faltan ramo, cobertura (ccober) y tarifa (ctarifa).');
    return this.escribir(ctx, {
      entidad: 'TARIFA',
      clave: claveRespaldo.tarifa(cramo, ccober, ctarifa),
      leer: () => this.leerTarifa(cramo, ccober, ctarifa),
      escribir: () => this.bridge.createSis2000Tarifa(body),
      payload: aCrearTarifa(body),
    });
  }

  /** Agregar una tasa con vigencia es un cambio de la tarifa. */
  crearDetalleTarifa(body: Obj, ctx?: ContextoCambio) {
    const cramo = Number(body.cramo);
    const ccober = t(body.ccober ?? body.ccobertura);
    const ctarifa = t(body.ctarifa);
    this.exigirClave(cramo > 0 && Boolean(ccober) && Boolean(ctarifa), 'Faltan ramo, cobertura (ccober) y tarifa (ctarifa).');
    return this.escribir(ctx, {
      entidad: 'TARIFA',
      clave: claveRespaldo.tarifa(cramo, ccober, ctarifa),
      leer: () => this.leerTarifa(cramo, ccober, ctarifa),
      escribir: () => this.bridge.createSis2000TarifaDetalle(body),
      payload: aCrearDetalleTarifa(body),
      exigirExistente: true,
    });
  }

  editarTarifa(cramo: number, ccober: string, ctarifa: string, body: Obj, ctx?: ContextoCambio) {
    return this.escribir(ctx, {
      entidad: 'TARIFA',
      clave: claveRespaldo.tarifa(cramo, ccober, ctarifa),
      leer: () => this.leerTarifa(cramo, ccober, ctarifa),
      escribir: () => this.bridge.updateSis2000Tarifa(String(cramo), ccober, ctarifa, body),
      payload: aEditarTarifa(body),
      exigirExistente: true,
    });
  }

  /** Crear plan (formulario de planes y Combos de coberturas). */
  crearPlan(body: Obj, ctx?: ContextoCambio) {
    const cramo = Number(body.cramo);
    const cplan = t(body.cplan);
    this.exigirClave(cramo > 0 && Boolean(cplan), 'Faltan el ramo (cramo) y el código del plan (cplan).');
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.plan(cramo, cplan),
      leer: () => this.leerPlan(cramo, cplan),
      escribir: () => this.bridge.createSis2000MasterPlan(body),
      payload: cuerpoPlan(body),
      comparable: planComparable,
    });
  }

  editarPlan(id: string, body: Obj, ctx?: ContextoCambio) {
    const { cramo, cplan } = partirPlanId(id);
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.plan(cramo, cplan),
      leer: () => this.leerPlan(cramo, cplan),
      escribir: () => this.bridge.updateSis2000MasterPlan(id, body),
      payload: cuerpoPlan(body),
      comparable: planComparable,
      exigirExistente: true,
    });
  }

  /** Borrar un plan: antes se guarda el plan completo (coberturas, tarifas, edades, frecuencias, mausuplan). */
  eliminarPlan(id: string, ctx?: ContextoCambio) {
    const { cramo, cplan } = partirPlanId(id);
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.plan(cramo, cplan),
      tipo: 'ELIMINACION',
      leer: () => this.leerPlan(cramo, cplan),
      escribir: () => this.bridge.deleteSis2000MasterPlan(id),
      comparable: planComparable,
      exigirExistente: true,
    });
  }

  /** Crear, actualizar o sincronizar un producto (maproductos por nest-api partner/products). */
  escribirProducto<T>(
    cproducto: string,
    escribir: () => Promise<T>,
    payload: PartnerProductPayload | Obj,
    ctx?: ContextoCambio,
    exigirExistente = false,
  ) {
    this.exigirClave(Boolean(t(cproducto)), 'Falta el código del producto (cproducto).');
    return this.escribir(ctx, {
      entidad: 'PRODUCTO',
      clave: claveRespaldo.producto(cproducto),
      leer: () => this.leerProducto(cproducto),
      escribir,
      payload,
      exigirExistente,
    });
  }

  agregarProveedorPlan(cramo: number, cplan: string, body: Obj, ctx?: ContextoCambio) {
    return this.escribirProveedores(cramo, cplan, ctx, () => this.bridge.agregarSis2000ProveedorPlan(cramo, cplan, body), aProveedorPlan(body));
  }

  editarProveedorPlan(cramo: number, cplan: string, body: Obj, ctx?: ContextoCambio) {
    return this.escribirProveedores(cramo, cplan, ctx, () => this.bridge.editarSis2000ProveedorPlan(cramo, cplan, body), body);
  }

  bajaProveedorPlan(cramo: number, cplan: string, body: Obj, ctx?: ContextoCambio) {
    return this.escribirProveedores(cramo, cplan, ctx, () => this.bridge.bajaSis2000ProveedorPlan(cramo, cplan, body), body);
  }

  private escribirProveedores<T>(cramo: number, cplan: string, ctx: ContextoCambio | undefined, escribir: () => Promise<T>, payload: unknown) {
    return this.escribir(ctx, {
      entidad: 'PLAN_PROVEEDORES',
      clave: claveRespaldo.plan(cramo, cplan),
      leer: () => this.leerProveedoresPlan(cramo, cplan),
      escribir,
      payload,
      comparable: proveedoresComparable,
    });
  }

  // ── Configurador fase 1: deducibles, comisiones, tipo y uso (auto), tasas por antigüedad (auto) ──

  /** Una tasa con vigencia (matarifa_d): montos, deducible, cerrar vigencia o inactivar. Es un cambio de la tarifa. */
  editarDetalleTarifa(cramo: number, ccober: string, ctarifa: string, fdesde: string, body: Obj, ctx?: ContextoCambio) {
    const desde = t(fdesde).slice(0, 10);
    this.exigirClave(
      cramo > 0 && Boolean(t(ccober)) && Boolean(t(ctarifa)) && /^\d{4}-\d{2}-\d{2}$/.test(desde),
      'Faltan el ramo, la cobertura, la tarifa y la fecha desde (AAAA-MM-DD) de la tasa.',
    );
    return this.escribir(ctx, {
      entidad: 'TARIFA',
      clave: claveRespaldo.tarifa(cramo, ccober, ctarifa),
      leer: () => this.leerTarifa(cramo, ccober, ctarifa),
      escribir: () => this.bridge.editarSis2000DetalleTarifa(cramo, ccober, ctarifa, desde, body),
      payload: { detalle: desde, ...aEditarDetalleTarifa(body) },
      exigirExistente: true,
    });
  }

  /** Deducible de una cobertura del plan (maplancob). Se respalda el plan completo leído de Sis2000. */
  editarDeducibleCoberturaPlan(cramo: number, cplan: string, ccobertura: string, body: Obj, ctx?: ContextoCambio) {
    this.exigirClave(cramo > 0 && Boolean(t(cplan)) && Boolean(t(ccobertura)), 'Faltan el ramo, el plan y la cobertura.');
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionPlan(cramo, cplan, 'DEDUCIBLES'),
      leer: () => this.leerPlan(cramo, cplan),
      escribir: () => this.bridge.editarSis2000CoberturaPlan(cramo, cplan, ccobertura, body),
      payload: { ccobertura: up(ccobertura), ...aDeducibleCoberturaPlan(body) },
      comparable: (s) => {
        const filas = s && typeof s === 'object' ? ((s as Obj).filas as Obj | undefined) : undefined;
        return filas?.maplancob ?? planComparable(s);
      },
      exigirExistente: true,
    });
  }

  agregarComision(cramo: number, cplan: string, body: Obj, ctx?: ContextoCambio) {
    return this.escribirComisiones(cramo, cplan, ctx, () => this.bridge.agregarSis2000Comision(cramo, cplan, body), {
      operacion: 'alta',
      ...aComision(body),
    });
  }

  bajaComision(cramo: number, cplan: string, body: Obj, ctx?: ContextoCambio) {
    return this.escribirComisiones(cramo, cplan, ctx, () => this.bridge.bajaSis2000Comision(cramo, cplan, body), {
      operacion: 'baja',
      ...aBajaComision(body),
    });
  }

  private escribirComisiones<T>(cramo: number, cplan: string, ctx: ContextoCambio | undefined, escribir: () => Promise<T>, payload: Obj) {
    this.exigirClave(cramo > 0 && Boolean(t(cplan)), 'Faltan el ramo y el plan.');
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionPlan(cramo, cplan, 'COMISIONES'),
      leer: () => this.bridge.listarSis2000Comisiones(cramo, cplan),
      escribir,
      payload,
    });
  }

  /**
   * Tipo y uso del ramo (macattip): afecta a todos los planes del ramo. Sin `confirmar`, si nest-api devuelve
   * advertencias no graba: la versión queda FALLIDA con ese motivo y se devuelven las advertencias para confirmar.
   */
  guardarTipoUso(cramo: number, ctipo: string, ccategotr: string, body: Obj, ctx?: ContextoCambio) {
    this.exigirClave(cramo > 0 && Boolean(t(ctipo)) && Boolean(t(ccategotr)), 'Faltan el ramo, el tipo de vehículo y el uso.');
    return this.escribirConConfirmacion(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.tiposUsoRamo(cramo),
      leer: () => this.bridge.leerSis2000TiposUso(cramo),
      escribir: () => this.bridge.guardarSis2000TipoUso(cramo, ctipo, ccategotr, body),
      payload: { ctipo: t(ctipo), ccategotr: t(ccategotr), ...aTipoUso(body) },
    });
  }

  /** Reemplaza los tramos vigentes (tramos [] los inactiva). Cobertura que no es de casco: nest-api pide confirmar. */
  guardarTasasAntiguedad(cramo: number, cplan: string, ccober: string, ctarifa: string, body: Obj, ctx?: ContextoCambio) {
    this.exigirClave(
      cramo > 0 && Boolean(t(cplan)) && Boolean(t(ccober)) && Boolean(t(ctarifa)),
      'Faltan el ramo, el plan, la cobertura y la tarifa.',
    );
    return this.escribirConConfirmacion(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionPlan(cramo, cplan, 'TASAS-ANTIGUEDAD'),
      leer: () => this.bridge.listarSis2000TasasAntiguedad(cramo, cplan),
      escribir: () => this.bridge.guardarSis2000TasasAntiguedad(cramo, cplan, ccober, ctarifa, body),
      payload: { ccober: up(ccober), ctarifa: up(ctarifa), ...aTasasAntiguedad(body) },
    });
  }

  /**
   * Escrituras en las que nest-api puede responder `grabado: false` con advertencias (pide reenviar con confirmar):
   * en ese caso no se grabó nada, la versión queda FALLIDA con ese motivo y se devuelve la respuesta para confirmar.
   */
  private async escribirConConfirmacion(
    ctx: ContextoCambio | undefined,
    op: Omit<OperacionRespaldada<Obj>, 'escribir'> & { escribir: () => Promise<Obj> },
  ): Promise<Obj> {
    try {
      return await this.escribir(ctx, {
        ...op,
        escribir: async () => {
          const r = await op.escribir();
          if (r.grabado === false) throw new SinGrabarPorAdvertencias(r);
          return r;
        },
      });
    } catch (e) {
      if (e instanceof SinGrabarPorAdvertencias) return e.respuesta;
      throw e;
    }
  }

  // ── Historial y restauración ───────────────────────────────────────────────

  async historial(entidad: EntidadRespaldo, clave: string) {
    const k = up(clave);
    const respaldo = await this.repo.buscar(entidad, k);
    if (!respaldo) return { entidad, clave: k, respaldo: null, versiones: [] as VersionRow[] };
    return { entidad, clave: k, respaldo, versiones: await this.repo.versiones(respaldo.id) };
  }

  /** Lo que se escribiría al restaurar (para confirmar antes). */
  async vistaPrevia(entidad: EntidadRespaldo, clave: string, destino: string, momento: MomentoVersion = 'despues') {
    const k = up(clave);
    const { datos, descripcion } = await this.objetivo(entidad, k, destino, momento);
    const advertencias: string[] = [];
    const escribir = entidad === 'PLAN' ? (await this.prepararPlan(k, datos, advertencias)).plan : datos;
    return { entidad, clave: k, destino, momento, descripcion, datos: escribir, advertencias };
  }

  /** Reescribe en Sis2000 lo guardado (original o una versión) y deja la restauración como nueva versión. */
  async restaurar(
    entidad: EntidadRespaldo,
    clave: string,
    opciones: { destino: string; momento?: MomentoVersion; motivo: string },
    ctx?: ContextoCambio,
  ) {
    const motivo = t(opciones.motivo);
    if (motivo.length < 5) throw new BadRequestException('Indica el motivo de la restauración (mínimo 5 caracteres).');
    const momento = opciones.momento ?? 'despues';
    const k = up(clave);
    const { datos, descripcion } = await this.objetivo(entidad, k, opciones.destino, momento);
    const advertencias: string[] = [];
    const comun = {
      tipo: 'RESTAURACION' as const,
      motivo,
      usuario: ctx?.usuario,
      restauradaDesde: opciones.destino === 'ORIGINAL' ? 'ORIGINAL' : `${opciones.destino}:${momento}`,
    };

    let version: VersionRow;
    switch (entidad) {
      case 'COBERTURA':
        version = await this.restaurarCobertura(k, datos as Obj, comun);
        break;
      case 'TARIFA':
        version = await this.restaurarTarifa(k, datos as Obj, comun, advertencias);
        break;
      case 'PLAN':
        version = await this.restaurarPlan(k, datos, comun, advertencias);
        break;
      case 'PRODUCTO':
        version = await this.restaurarProducto(k, datos as Obj, comun);
        break;
      case 'PLAN_PROVEEDORES':
        version = await this.restaurarProveedores(k, datos, comun, advertencias);
        break;
      default:
        throw new BadRequestException(`Entidad no soportada: ${String(entidad)}`);
    }
    return {
      ok: version.resultado === 'APLICADA',
      entidad,
      clave: k,
      restaurado: descripcion,
      version: { id: version.id, numero: version.numero, resultado: version.resultado, error: version.error },
      advertencias,
    };
  }

  private async objetivo(entidad: EntidadRespaldo, clave: string, destino: string, momento: MomentoVersion) {
    if (esClaveSeccion(clave)) {
      throw new BadRequestException(
        'Restaurar una sección del plan o del ramo (comisiones, deducibles, formas de pago, quién lo vende, coberturas, edades, tarifas por días o por antigüedad, tipo y uso, descuentos y recargos, condominio, tasa de casco) todavía no está disponible desde el configurador. La copia de lo que había está en el historial: corrígelo desde su sección.',
      );
    }
    const nombre = `${NOMBRE_ENTIDAD[entidad]} ${clave}`;
    const respaldo = await this.repo.buscar(entidad, clave);
    if (!respaldo) throw new NotFoundException(`No hay historial de ${nombre}.`);

    let datos: unknown;
    let descripcion: string;
    if (destino === 'ORIGINAL') {
      if (respaldo.existia) {
        datos = respaldo.original;
        descripcion = 'la copia original';
      } else {
        const creacion = (await this.repo.versiones(respaldo.id))
          .filter((v) => v.tipo === 'CREACION' && v.resultado === 'APLICADA')
          .sort((a, b) => a.numero - b.numero)[0];
        if (!creacion) {
          throw new BadRequestException(
            `${nombre} no existía antes del configurador y su creación no quedó aplicada: no hay original que restaurar.`,
          );
        }
        datos = this.datosVersion(entidad, creacion, 'despues');
        descripcion = `la versión ${creacion.numero} (creación, primera copia)`;
      }
    } else {
      const v = await this.repo.version(destino);
      if (!v || v.respaldoId !== respaldo.id) throw new NotFoundException('Esa versión no está en el historial.');
      if (momento === 'despues' && v.resultado !== 'APLICADA') {
        throw new BadRequestException(`La versión ${v.numero} no se aplicó en Sis2000; elige «cómo estaba antes».`);
      }
      datos = this.datosVersion(entidad, v, momento);
      descripcion = momento === 'antes' ? `cómo estaba antes de la versión ${v.numero}` : `la versión ${v.numero}`;
    }
    if (datos == null) {
      throw new BadRequestException(`En ese punto ${nombre} no existía en Sis2000: no hay datos que restaurar.`);
    }
    return { datos, descripcion };
  }

  /** En planes, «cómo quedó» se restaura con el cuerpo exacto que se envió (si lo hay); si no, con lo leído. */
  private datosVersion(entidad: EntidadRespaldo, v: VersionRow, momento: MomentoVersion): unknown {
    if (momento === 'antes') return v.anterior;
    if (entidad === 'PLAN' && v.tipo !== 'ELIMINACION' && v.payload) return v.payload;
    return v.estado;
  }

  private restaurarCobertura(clave: string, datos: Obj, comun: Partial<OperacionRespaldada<unknown>>) {
    const [cramo, ccob] = partes(clave, 2) as [number, string];
    const cuerpo = elegir(datos, CAMPOS_COBERTURA);
    return this.escribirVersion({
      ...comun,
      entidad: 'COBERTURA',
      clave,
      leer: () => this.leerCobertura(cramo, ccob),
      escribir: (actual) =>
        actual
          ? this.bridge.updateSis2000Cobertura(String(cramo), ccob, cuerpo)
          : this.bridge.createSis2000Cobertura({ ...datos, cramo, ccobertura: ccob }),
      payload: aEditarCobertura(cuerpo),
    });
  }

  /**
   * Cabecera de la tarifa por PATCH; tasas (matarifa_d) que falten se vuelven a agregar. nest-api no edita ni borra
   * tasas: las que difieren o sobran se informan en advertencias.
   */
  private restaurarTarifa(clave: string, datos: Obj, comun: Partial<OperacionRespaldada<unknown>>, adv: string[]) {
    const [cramo, ccober, ctarifa] = partes(clave, 3) as [number, string, string];
    const cabecera = elegir(datos, CAMPOS_TARIFA);
    const detalles = Array.isArray(datos.detalles) ? (datos.detalles as Obj[]) : [];
    return this.escribirVersion({
      ...comun,
      entidad: 'TARIFA',
      clave,
      leer: () => this.leerTarifa(cramo, ccober, ctarifa),
      escribir: async (actual) => {
        if (!actual) {
          return this.bridge.createSis2000Tarifa({ ...datos, cramo, ccober, ctarifa, detalles });
        }
        await this.bridge.updateSis2000Tarifa(String(cramo), ccober, ctarifa, cabecera);
        const actuales = Array.isArray((actual as Obj).detalles) ? ((actual as Obj).detalles as Obj[]) : [];
        const fecha = (d: Obj) => t(d.fdesde).slice(0, 10);
        for (const d of detalles) {
          const igual = actuales.find((a) => fecha(a) === fecha(d));
          if (!igual) {
            await this.bridge.createSis2000TarifaDetalle({ ...d, cramo, ccober, ctarifa });
          } else if (JSON.stringify(elegir(igual, CAMPOS_DETALLE)) !== JSON.stringify(elegir(d, CAMPOS_DETALLE))) {
            adv.push(`La tasa con vigencia desde ${fecha(d)} tiene otros valores y el configurador no puede editarla; revísala en Sis2000.`);
          }
        }
        for (const a of actuales) {
          if (!detalles.some((d) => fecha(d) === fecha(a))) {
            adv.push(`La tasa con vigencia desde ${fecha(a)} no estaba en esa versión y no se puede borrar desde el configurador.`);
          }
        }
        return { cramo, ccober, ctarifa };
      },
      payload: { ...aEditarTarifa(cabecera), detalles },
    });
  }

  private async restaurarPlan(clave: string, datos: unknown, comun: Partial<OperacionRespaldada<unknown>>, adv: string[]) {
    const { cramo, cplan } = partirPlanId(clave);
    const { plan } = await this.prepararPlan(clave, datos, adv);
    const id = `${cramo}-${t(plan.cplan) || cplan}`;
    return this.escribirVersion({
      ...comun,
      entidad: 'PLAN',
      clave,
      leer: () => this.leerPlan(cramo, cplan),
      escribir: (actual) =>
        actual ? this.bridge.updateSis2000MasterPlan(id, plan) : this.bridge.createSis2000MasterPlan(plan),
      payload: cuerpoPlan(plan),
      comparable: planComparable,
    });
  }

  private restaurarProducto(clave: string, datos: Obj, comun: Partial<OperacionRespaldada<unknown>>) {
    const payload = dtoToPartnerPayload({ ...datos, cproducto: clave });
    return this.escribirVersion({
      ...comun,
      entidad: 'PRODUCTO',
      clave,
      leer: () => this.leerProducto(clave),
      escribir: (actual) =>
        actual ? this.bridge.updateProduct(payload.cproducto, payload) : this.bridge.createProduct(payload),
      payload,
    });
  }

  /** Proveedores: agrega los que falten, corrige los que difieran y da de baja (cierra fhasta) los que sobren. */
  private restaurarProveedores(clave: string, datos: unknown, comun: Partial<OperacionRespaldada<unknown>>, adv: string[]) {
    const [cramo, cplan] = partes(clave, 2) as [number, string];
    const objetivo = Array.isArray(datos) ? (datos as Obj[]) : [];
    return this.escribirVersion({
      ...comun,
      entidad: 'PLAN_PROVEEDORES',
      clave,
      leer: () => this.leerProveedoresPlan(cramo, cplan),
      comparable: proveedoresComparable,
      payload: objetivo,
      escribir: async (actual) => {
        const ahora = new Map(((actual as Obj[]) ?? []).map((r) => [claveProveedor(r), r]));
        for (const r of objetivo) {
          const a = ahora.get(claveProveedor(r));
          const deseado = datosProveedor(r);
          if (!a) {
            await this.bridge.agregarSis2000ProveedorPlan(cramo, cplan, { ...r, fhasta: deseado.fhasta ?? undefined });
            continue;
          }
          if (JSON.stringify(datosProveedor(a)) === JSON.stringify(deseado)) continue;
          await this.bridge.editarSis2000ProveedorPlan(cramo, cplan, {
            cci_rif: r.cci_rif,
            cclave_num: r.cclave_num,
            fdesde: r.fdesde,
            ...(deseado.fhasta ? { fhasta: deseado.fhasta } : { sin_fin: true }),
            itiposerv: deseado.itiposerv ?? undefined,
            mcosto: deseado.mcosto ?? undefined,
            mcostoext: deseado.mcostoext ?? undefined,
            cmoneda: deseado.cmoneda ?? undefined,
          });
        }
        const claves = new Set(objetivo.map(claveProveedor));
        for (const a of (actual as Obj[]) ?? []) {
          if (claves.has(claveProveedor(a))) continue;
          const fdesde = t(a.fdesde).slice(0, 10);
          const fhastaActual = a.fhasta ? t(a.fhasta).slice(0, 10) : null;
          const baja = hoy() < fdesde ? fdesde : hoy();
          if (!fhastaActual || fhastaActual > baja) {
            await this.bridge.bajaSis2000ProveedorPlan(cramo, cplan, {
              cci_rif: a.cci_rif,
              cclave_num: a.cclave_num,
              fdesde,
              fhasta_baja: baja,
            });
          }
          adv.push(`El proveedor ${t(a.cci_rif)} (clave ${t(a.cclave_num)}, desde ${fdesde}) no estaba en esa versión: se dio de baja con fecha ${baja} (no se borra).`);
        }
        return { cramo, cplan };
      },
    });
  }

  /** PlanDto a escribir: del plan leído o del cuerpo enviado; marca suma_calculada según la configuración propia. */
  private async prepararPlan(clave: string, datos: unknown, adv: string[]): Promise<{ plan: Obj }> {
    const { cramo, cplan } = partirPlanId(clave);
    const leido = datos && typeof datos === 'object' && 'plan' in (datos as Obj) ? (datos as Obj) : null;
    const plan: Obj = { ...((leido ? leido.plan : datos) as Obj) };
    if (leido && Array.isArray(leido.advertencias)) adv.push(...(leido.advertencias as string[]));
    plan.cramo = cramo;
    if (!t(plan.cplan)) plan.cplan = cplan;

    if (t(plan.type) !== 'personas' && Array.isArray(plan.coberturas)) {
      const calculadas = new Set(
        (await this.prisma.coberturaSumaConfig.findMany({ where: { cramo, tipoSuma: 'CALCULADA' } })).map((c) =>
          up(c.ccobertura),
        ),
      );
      plan.coberturas = (plan.coberturas as Obj[]).map((c) =>
        c.suma_calculada === undefined && calculadas.has(up(c.ccobertura)) ? { ...c, suma_calculada: true } : c,
      );
    }
    if (!canalesEnPlanHabilitado() && (plan.all_canal === true || (Array.isArray(plan.canales) && plan.canales.length))) {
      adv.push('Los canales de esta versión no se reponen: la asignación de canales en planes está desactivada (SIS2000_PLAN_CANALES).');
    } else if (plan.all_canal === true || (Array.isArray(plan.canales) && plan.canales.length)) {
      adv.push('Los canales de esta versión se agregan si faltan; los canales que el plan tenga de más no se quitan (no se borra en mausuplan).');
    }
    return { plan };
  }

  private async escribir<T>(ctx: ContextoCambio | undefined, op: OperacionRespaldada<T>): Promise<T> {
    const { resultado } = await this.respaldo.escribir({ ...op, motivo: ctx?.motivo, usuario: ctx?.usuario });
    return resultado;
  }

  private async escribirVersion(op: Partial<OperacionRespaldada<unknown>>): Promise<VersionRow> {
    const { version } = await this.respaldo.escribir(op as OperacionRespaldada<unknown>);
    return version;
  }

  private exigirClave(ok: boolean, mensaje: string) {
    if (!ok) throw new BadRequestException(mensaje);
  }
}
