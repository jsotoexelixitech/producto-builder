import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PartnerBridgeService, productoEscrituraHabilitada } from '../partner-bridge/partner-bridge.service';
import { partirPlanId } from '../partner-bridge/configurador.mapper';
import {
  aBajaCobertura,
  aCabeceraPlan,
  aCondominio,
  aCoberturaPersonas,
  aCoberturaPlan,
  aDescRec,
  aEdadParentesco,
  aEditarCoberturaPersonas,
  aEditarFrecuencia,
  aEditarProducto,
  aFrecuencia,
  aFrecuenciaProductor,
  aQuienVende,
  aTarifaCoberturaPlan,
  aCancelarCasco,
  aRevisarCasco,
  aTarifaDias,
  aDeduciblesAuto,
  aTasaDiaria,
  aVersionCasco,
  aVistaPreviaCasco,
  consultaQuienVende,
  ENTIDADES_QUIEN_VENDE,
  errorRepartoCondominio,
  filasBorradas,
  TABLAS_CONDOMINIO,
  type TablaCondominio,
  type TipoDescRec,
} from '../partner-bridge/configurador-fase2.mapper';
import { OperacionRespaldada, Sis2000RespaldoService } from './respaldo/sis2000-respaldo.service';
import { claveRespaldo, Sis2000HistorialService, type SeccionRamoRespaldo, type SeccionRespaldo } from './respaldo/sis2000-historial.service';
import type { ContextoCambio } from './respaldo/respaldo.types';

type Obj = Record<string, unknown>;

/** Parámetros de auto configurable por plan (rutas de nest-api planes/:cramo/:cplan/auto/<tipo>). */
export type TipoAutoParametro = 'tasa-diaria' | 'deducibles';
export const TIPOS_AUTO_PARAMETRO: TipoAutoParametro[] = ['tasa-diaria', 'deducibles'];
const SECCION_AUTO: Record<TipoAutoParametro, SeccionRespaldo> = { 'tasa-diaria': 'TASA-DIARIA', deducibles: 'DEDUCIBLE-DESCUENTO' };

const t = (v: unknown) => String(v ?? '').trim();
const enc = (v: unknown) => encodeURIComponent(t(v));

/** nest-api respondió grabado: false (pide confirmar advertencias): no grabó; la versión queda FALLIDA con ese motivo. */
class SinGrabar extends Error {
  constructor(readonly respuesta: Obj) {
    const adv = Array.isArray(respuesta.advertencias) ? (respuesta.advertencias as unknown[]).map(String).join(' | ') : '';
    super(`No se grabó: falta confirmar las advertencias de nest-api.${adv ? ` ${adv}` : ''}`.slice(0, 1000));
  }
}

/**
 * Configurador fase 2 «editar todo» (.antigravity/CONTRATO-CONFIGURADOR-FASE2.md): proxies 1:1 de nest-api
 * v1/configurador. Cada escritura guarda antes lo que había (historial del configurador) con la clave del plan + sección
 * («28-PLAN01:FRECUENCIAS») o del ramo + sección («28-*:DISPOSITIVOS»). En las bajas físicas (frecuencias de productor,
 * quién vende) la versión guarda además las filas que nest-api devuelve como borradas.
 */
@Injectable()
export class ConfiguradorFase2Service {
  constructor(
    private readonly bridge: PartnerBridgeService,
    private readonly respaldo: Sis2000RespaldoService,
    private readonly historial: Sis2000HistorialService,
  ) {}

  // ── Rutas ──

  private plan(id: string) {
    const { cramo, cplan } = partirPlanId(id);
    if (!(cramo > 0) || !cplan) throw new BadRequestException('El plan debe venir como «ramo-plan» (por ejemplo 28-PLAN01).');
    return { cramo, cplan, ruta: `planes/${cramo}/${enc(cplan)}` };
  }

  private ramo(cramo: string | number) {
    const n = Number(cramo);
    if (!Number.isInteger(n) || n <= 0) throw new BadRequestException('El ramo debe ser un número entero mayor que 0.');
    return n;
  }

  private asegurarConfigurado() {
    if (!this.bridge.isConfigured()) {
      throw new ServiceUnavailableException('El configurador no tiene credencial de nest-api (NEST_API_KEY).');
    }
  }

  private leer(ruta: string) {
    this.asegurarConfigurado();
    return this.bridge.leerConfigurador(ruta);
  }

  // ── Catálogo de ramos ──

  /** Ramos con familia, estado, emisión Nexus, cantidad de planes y productos, avisos y secciones (GET ramos). */
  ramos() {
    return this.leer('ramos');
  }

  // ── Frecuencias ──

  listarFrecuencias(id: string) {
    return this.leer(`${this.plan(id).ruta}/frecuencias`);
  }

  agregarFrecuencia(id: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    return this.seccionPlan(p, 'FRECUENCIAS', ctx, 'POST', `${p.ruta}/frecuencias`, aFrecuencia(body), `${p.ruta}/frecuencias`);
  }

  editarFrecuencia(id: string, ifrecuencia: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    if (!t(ifrecuencia)) throw new BadRequestException('Falta la forma de pago (ifrecuencia).');
    const cuerpo = aEditarFrecuencia(body);
    return this.seccionPlan(p, 'FRECUENCIAS', ctx, 'PATCH', `${p.ruta}/frecuencias/${enc(ifrecuencia.toUpperCase())}`, cuerpo, `${p.ruta}/frecuencias`, {
      ifrecuencia: t(ifrecuencia).toUpperCase(),
      ...cuerpo,
    });
  }

  listarFrecuenciasProductor(id: string) {
    return this.leer(`${this.plan(id).ruta}/frecuencias-productor`);
  }

  agregarFrecuenciaProductor(id: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const cuerpo = aFrecuenciaProductor(body);
    if (cuerpo.cproductor === undefined || !cuerpo.ifrecuencia) throw new BadRequestException('Faltan el productor y la forma de pago.');
    return this.seccionPlan(p, 'FRECUENCIAS-PRODUCTOR', ctx, 'POST', `${p.ruta}/frecuencias-productor`, cuerpo, `${p.ruta}/frecuencias-productor`);
  }

  /** Borrado físico (la tabla no tiene iestado): antes se guarda la lista y después lo que nest-api devuelve borrado. */
  borrarFrecuenciaProductor(id: string, cproductor: string, ifrecuencia: string, ndias: string | undefined, ctx?: ContextoCambio) {
    const p = this.plan(id);
    if (!t(cproductor) || !t(ifrecuencia)) throw new BadRequestException('Faltan el productor y la forma de pago.');
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionPlan(p.cramo, p.cplan, 'FRECUENCIAS-PRODUCTOR'),
      tipo: 'ELIMINACION',
      leer: () => this.bridge.leerConfigurador(`${p.ruta}/frecuencias-productor`),
      escribir: () =>
        this.bridge.escribirConfigurador(
          'DELETE',
          `${p.ruta}/frecuencias-productor/${enc(cproductor)}/${enc(ifrecuencia.toUpperCase())}${/^\d+$/.test(t(ndias)) ? `?ndias=${t(ndias)}` : ''}`,
        ),
      payload: { operacion: 'baja', cproductor: t(cproductor), ifrecuencia: t(ifrecuencia).toUpperCase(), ndias: t(ndias) || null },
      guardarDelResultado: (r) => filasBorradas(r),
    });
  }

  // ── Quién vende (mausuplan) ──

  listarQuienVende(id: string, query: Obj) {
    return this.leer(`${this.plan(id).ruta}/quien-vende${consultaQuienVende(query)}`);
  }

  resumenQuienVende(id: string) {
    return this.leer(`${this.plan(id).ruta}/quien-vende/resumen`);
  }

  agregarQuienVende(id: string, body: Obj, ctx?: ContextoCambio) {
    return this.escribirQuienVende(id, body, ctx, 'alta');
  }

  /** Baja física: la respuesta trae las filas borradas y se guardan en la versión del historial. */
  bajaQuienVende(id: string, body: Obj, ctx?: ContextoCambio) {
    return this.escribirQuienVende(id, body, ctx, 'baja');
  }

  private escribirQuienVende(id: string, body: Obj, ctx: ContextoCambio | undefined, operacion: 'alta' | 'baja') {
    const p = this.plan(id);
    const cuerpo = aQuienVende(body);
    if (!ENTIDADES_QUIEN_VENDE.includes(String(cuerpo.centidad))) {
      throw new BadRequestException('Solo se editan productores (P), canales (C) y gestores (G); R, U y A son de solo lectura.');
    }
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionPlan(p.cramo, p.cplan, 'QUIEN-VENDE'),
      tipo: operacion === 'baja' ? 'ELIMINACION' : undefined,
      leer: () => this.leerQuienVendeParcial(p.ruta, cuerpo.centidad, cuerpo.itipouso, cuerpo.items),
      escribir: () =>
        this.bridge.escribirConfigurador('POST', `${p.ruta}/quien-vende${operacion === 'baja' ? '/baja' : ''}`, cuerpo, 120_000),
      payload: { operacion, ...cuerpo },
      guardarDelResultado: operacion === 'baja' ? (r) => filasBorradas(r) : undefined,
    });
  }

  /**
   * Respaldo de mausuplan sin leer miles de filas: el resumen del plan + las filas de esa entidad e incluye/excluye que
   * tocan los códigos enviados (o la fila «todos» si items es null).
   */
  private async leerQuienVendeParcial(ruta: string, centidad: string, itipouso: string, items: string[] | null) {
    const resumen = await this.bridge.leerConfigurador(`${ruta}/quien-vende/resumen`);
    const lista = await this.bridge.leerConfigurador(`${ruta}/quien-vende${consultaQuienVende({ centidad, itipouso, limit: 500 })}`);
    const filas = filasBorradas(lista);
    const codigos = items ? new Set(items.map((x) => t(x).toUpperCase())) : null;
    return {
      resumen,
      filas: filas.filter((f) => (codigos ? codigos.has(t(f.citem).toUpperCase()) : !t(f.citem))),
    };
  }

  // ── Producto (maproductos) ──

  async leerProducto(cproducto: string) {
    if (!t(cproducto)) throw new BadRequestException('Falta el código del producto.');
    return this.leer(`productos/${enc(cproducto)}`);
  }

  /** PATCH productos/:cproducto (no cambia cproducto ni cramo). Misma bandera que crear: SIS2000_PRODUCTO_ESCRITURA. */
  editarProducto(cproducto: string, body: Obj, ctx?: ContextoCambio) {
    this.asegurarConfigurado();
    this.exigirEscrituraProducto();
    const cuerpo = aEditarProducto(body);
    if (!(Number(cuerpo.cramo) > 0)) throw new BadRequestException('Indica el ramo del producto (cramo): elige la fila si el código se repite.');
    return this.historial.escribirProducto(
      cproducto,
      () => this.bridge.escribirConfigurador('PATCH', `productos/${enc(cproducto)}`, cuerpo),
      { cproducto: t(cproducto).toUpperCase(), ...cuerpo },
      ctx,
      true,
    );
  }

  exigirEscrituraProducto() {
    if (!productoEscrituraHabilitada()) {
      throw new ForbiddenException(
        'Crear o editar productos en Sis2000 está desactivado en este servidor (bandera SIS2000_PRODUCTO_ESCRITURA del builder).',
      );
    }
  }

  // ── Plan: cabecera y coberturas ──

  editarCabecera(id: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const cuerpo = aCabeceraPlan(body);
    if (!Object.keys(cuerpo).filter((k) => k !== 'confirmar').length) throw new BadRequestException('No hay cambios en los datos del plan.');
    return this.seccionPlanLeyendoPlan(p, 'CABECERA', ctx, 'PATCH', p.ruta, cuerpo, (s) => {
      const plan = s && typeof s === 'object' ? ((s as Obj).plan as Obj | undefined) : undefined;
      return plan ? { xplan: plan.xplan, cmoneda: plan.cmoneda, cproducto: plan.cproducto, iestado: plan.iestado } : s;
    });
  }

  agregarCoberturaPlan(id: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const cuerpo = aCoberturaPlan(body);
    if (!cuerpo.ccobertura || !cuerpo.ctarifa) throw new BadRequestException('Faltan la cobertura y la tarifa.');
    return this.seccionPlanLeyendoPlan(p, 'COBERTURAS', ctx, 'POST', `${p.ruta}/coberturas`, cuerpo);
  }

  editarTarifaCoberturaPlan(id: string, ccobertura: string, ctarifa: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const cuerpo = aTarifaCoberturaPlan(body);
    return this.seccionPlanLeyendoPlan(
      p,
      'COBERTURAS',
      ctx,
      'PATCH',
      `${p.ruta}/coberturas/${enc(ccobertura)}/tarifas/${enc(ctarifa)}`,
      cuerpo,
      undefined,
      { ccobertura: t(ccobertura), ctarifa: t(ctarifa), ...cuerpo },
    );
  }

  bajaCoberturaPlan(id: string, ccobertura: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const cuerpo = aBajaCobertura(body);
    return this.seccionPlanLeyendoPlan(p, 'COBERTURAS', ctx, 'POST', `${p.ruta}/coberturas/${enc(ccobertura)}/baja`, cuerpo, undefined, {
      operacion: 'baja',
      ccobertura: t(ccobertura),
      ...cuerpo,
    });
  }

  agregarCoberturaPersonas(id: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const cuerpo = aCoberturaPersonas(body);
    if (!cuerpo.ccobertura || !cuerpo.ctarifa) throw new BadRequestException('Faltan la cobertura y la tarifa.');
    return this.seccionPlanLeyendoPlan(p, 'COBERTURAS', ctx, 'POST', `${p.ruta}/coberturas-personas`, cuerpo);
  }

  editarCoberturaPersonas(id: string, ccobertura: string, ctarifa: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const cuerpo = aEditarCoberturaPersonas(body);
    return this.seccionPlanLeyendoPlan(
      p,
      'COBERTURAS',
      ctx,
      'PATCH',
      `${p.ruta}/coberturas-personas/${enc(ccobertura)}/tarifas/${enc(ctarifa)}`,
      cuerpo,
      undefined,
      { ccobertura: t(ccobertura), ctarifa: t(ctarifa), ...cuerpo },
    );
  }

  bajaCoberturaPersonas(id: string, ccobertura: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const cuerpo = aBajaCobertura(body);
    return this.seccionPlanLeyendoPlan(p, 'COBERTURAS', ctx, 'POST', `${p.ruta}/coberturas-personas/${enc(ccobertura)}/baja`, cuerpo, undefined, {
      operacion: 'baja',
      ccobertura: t(ccobertura),
      ...cuerpo,
    });
  }

  // ── Personas: edades por parentesco ──

  listarEdades(id: string) {
    return this.leer(`${this.plan(id).ruta}/edades`);
  }

  guardarEdad(id: string, cparen: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    if (!/^\d+$/.test(t(cparen))) throw new BadRequestException('El parentesco (cparen) es un número.');
    const cuerpo = aEdadParentesco(body);
    const min = Number(cuerpo.cemin_ase);
    const max = Number(cuerpo.cemax_ase);
    if (cuerpo.cemin_ase !== undefined && cuerpo.cemax_ase !== undefined && min > max) {
      throw new BadRequestException('La edad mínima del asegurado no puede ser mayor que la máxima.');
    }
    return this.seccionPlan(p, 'EDADES', ctx, 'PUT', `${p.ruta}/edades/${enc(cparen)}`, cuerpo, `${p.ruta}/edades`, {
      cparen: Number(cparen),
      ...cuerpo,
    });
  }

  // ── Patrimoniales: descuentos y recargos, condominio (por ramo) ──

  listarDescRec(cramo: string, tipo: TipoDescRec) {
    return this.leer(`ramos/${this.ramo(cramo)}/${tipo}`);
  }

  agregarDescRec(cramo: string, tipo: TipoDescRec, body: Obj, ctx?: ContextoCambio) {
    const n = this.ramo(cramo);
    const cuerpo = aDescRec(tipo, body, true);
    this.validarPorcentaje(cuerpo, tipo);
    return this.seccionRamo(n, tipo === 'dispositivos' ? 'DISPOSITIVOS' : 'SUSTANCIAS', ctx, 'POST', `ramos/${n}/${tipo}`, cuerpo, `ramos/${n}/${tipo}`);
  }

  editarDescRec(cramo: string, tipo: TipoDescRec, codigo: string, body: Obj, ctx?: ContextoCambio) {
    const n = this.ramo(cramo);
    if (!/^\d+$/.test(t(codigo))) throw new BadRequestException('El código es un número.');
    const cuerpo = aDescRec(tipo, body, false);
    this.validarPorcentaje(cuerpo, tipo);
    return this.seccionRamo(
      n,
      tipo === 'dispositivos' ? 'DISPOSITIVOS' : 'SUSTANCIAS',
      ctx,
      'PATCH',
      `ramos/${n}/${tipo}/${enc(codigo)}`,
      cuerpo,
      `ramos/${n}/${tipo}`,
      { codigo: Number(codigo), ...cuerpo },
    );
  }

  private validarPorcentaje(cuerpo: Obj, tipo: TipoDescRec) {
    const pct = cuerpo[tipo === 'dispositivos' ? 'pdisseg' : 'porcenta'];
    if (pct !== undefined && (Number(pct) < 0 || Number(pct) > 100)) throw new BadRequestException('El porcentaje va de 0 a 100.');
  }

  leerCondominio(cramo: string, tabla: string) {
    return this.leer(`ramos/${this.ramo(cramo)}/condominio/${this.tablaCondominio(tabla)}`);
  }

  guardarCondominio(cramo: string, tabla: string, body: Obj, ctx?: ContextoCambio) {
    const n = this.ramo(cramo);
    const tb = this.tablaCondominio(tabla);
    const cuerpo = aCondominio(tb, body);
    if (tb === 'reparto') {
      const error = errorRepartoCondominio(cuerpo.filas as Obj[]);
      if (error) throw new BadRequestException(error);
    }
    const seccion = `CONDOMINIO-${tb.toUpperCase()}` as SeccionRamoRespaldo;
    return this.seccionRamo(n, seccion, ctx, 'PUT', `ramos/${n}/condominio/${tb}`, cuerpo, `ramos/${n}/condominio/${tb}`);
  }

  private tablaCondominio(tabla: string): TablaCondominio {
    const tb = t(tabla).toLowerCase() as TablaCondominio;
    if (!TABLAS_CONDOMINIO.includes(tb)) throw new BadRequestException(`Tabla de condominio no válida: usa ${TABLAS_CONDOMINIO.join(', ')}.`);
    return tb;
  }

  // ── Auto: tarifa por días y tasa de casco ──

  listarTarifaDias(id: string) {
    return this.leer(`${this.plan(id).ruta}/tarifa-dias`);
  }

  guardarTarifaDias(id: string, ccober: string, ctarifa: string, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    if (!t(ccober) || !t(ctarifa)) throw new BadRequestException('Faltan la cobertura y la tarifa.');
    const cuerpo = aTarifaDias(body);
    return this.seccionPlan(
      p,
      'TARIFA-DIAS',
      ctx,
      'PUT',
      `${p.ruta}/tarifa-dias/${enc(ccober)}/${enc(ctarifa)}`,
      cuerpo,
      `${p.ruta}/tarifa-dias`,
      { ccober: t(ccober), ctarifa: t(ctarifa), ...cuerpo },
    );
  }

  // ── Auto configurable: tasa diaria por tipo de vehículo y descuento por deducible (macatvalores) ──

  leerAutoParametro(id: string, tipo: TipoAutoParametro) {
    return this.leer(`${this.plan(id).ruta}/auto/${tipo}`);
  }

  /** Upsert del JSON del plan (bactivo 1). nest-api responde 409 si el DBA todavía no creó el dominio. */
  guardarAutoParametro(id: string, tipo: TipoAutoParametro, body: Obj, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const ruta = `${p.ruta}/auto/${tipo}`;
    return this.seccionPlan(p, SECCION_AUTO[tipo], ctx, 'PUT', ruta, tipo === 'tasa-diaria' ? aTasaDiaria(body) : aDeduciblesAuto(body), ruta);
  }

  /** bactivo 0 (no borra): el cálculo vuelve a su comportamiento de siempre para ese plan. */
  desactivarAutoParametro(id: string, tipo: TipoAutoParametro, ctx?: ContextoCambio) {
    const p = this.plan(id);
    const ruta = `${p.ruta}/auto/${tipo}`;
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionPlan(p.cramo, p.cplan, SECCION_AUTO[tipo]),
      tipo: 'ELIMINACION',
      leer: () => this.bridge.leerConfigurador(ruta),
      escribir: () => this.bridge.escribirConfigurador('DELETE', ruta),
      payload: { operacion: 'desactivar', tipo },
    });
  }

  leerTasaCasco(cramo: string) {
    return this.leer(`auto/${this.ramo(cramo)}/tasa-casco`);
  }

  /** Historial de versiones (global, v_tarifa_casco_versiones). */
  listarVersionesCasco(cramo: string, limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.leer(`auto/${this.ramo(cramo)}/tasa-casco/versiones?limit=${n}`);
  }

  /** Vista previa de un ajuste: no escribe (sin respaldo). */
  vistaPreviaCasco(cramo: string, body: Obj) {
    this.asegurarConfigurado();
    return this.bridge.escribirConfigurador('POST', `auto/${this.ramo(cramo)}/tasa-casco/vista-previa`, aVistaPreviaCasco(body));
  }

  /** Propuesta por ajuste porcentual o restauración (sp_tarifa_casco_ajustar / _restaurar). */
  crearVersionCasco(cramo: string, body: Obj, ctx?: ContextoCambio) {
    const n = this.ramo(cramo);
    const cuerpo = aVersionCasco(body);
    if (t(cuerpo.motivo).length < 10) throw new BadRequestException('Indica el motivo de la propuesta (mínimo 10 caracteres).');
    if (!(Number(cuerpo.cusuario) > 0)) throw new BadRequestException('Indica tu usuario de Sis2000 (cusuario) con permiso para proponer.');
    return this.versionCasco(n, ctx, `auto/${n}/tasa-casco/versiones`, cuerpo, { operacion: 'proponer', ...cuerpo });
  }

  /** Publicar = aprobar (doble control: otro usuario de Sis2000 que el que propuso). */
  publicarVersionCasco(cramo: string, versionId: string, body: Obj, ctx?: ContextoCambio) {
    return this.revisionCasco(cramo, versionId, 'publicar', aRevisarCasco(body), ctx);
  }

  rechazarVersionCasco(cramo: string, versionId: string, body: Obj, ctx?: ContextoCambio) {
    const cuerpo = aRevisarCasco(body);
    if (t(cuerpo.comentario).length < 5) throw new BadRequestException('Explica por qué se rechaza (mínimo 5 caracteres).');
    return this.revisionCasco(cramo, versionId, 'rechazar', cuerpo, ctx);
  }

  cancelarVersionCasco(cramo: string, versionId: string, body: Obj, ctx?: ContextoCambio) {
    const cuerpo = aCancelarCasco(body);
    if (t(cuerpo.motivo).length < 10) throw new BadRequestException('Indica el motivo de la cancelación (mínimo 10 caracteres).');
    return this.revisionCasco(cramo, versionId, 'cancelar', cuerpo, ctx);
  }

  private revisionCasco(cramo: string, versionId: string, accion: 'publicar' | 'rechazar' | 'cancelar', cuerpo: Obj, ctx?: ContextoCambio) {
    const n = this.ramo(cramo);
    if (!/^\d+$/.test(t(versionId))) throw new BadRequestException('Falta la versión.');
    if (!(Number(cuerpo.cusuario) > 0)) throw new BadRequestException('Indica tu usuario de Sis2000 (cusuario).');
    return this.versionCasco(n, ctx, `auto/${n}/tasa-casco/versiones/${enc(versionId)}/${accion}`, cuerpo, {
      operacion: accion,
      version: t(versionId),
      ...cuerpo,
    });
  }

  /** El «antes» de la tasa de casco son las últimas versiones (no las miles de tasas: los SP guardan su propia copia). */
  private versionCasco(cramo: number, ctx: ContextoCambio | undefined, ruta: string, cuerpo: Obj, payload: Obj) {
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionRamo(cramo, 'TASA-CASCO'),
      leer: () => this.bridge.leerConfigurador(`auto/${cramo}/tasa-casco/versiones?limit=20`),
      escribir: () => this.bridge.escribirConfigurador('POST', ruta, cuerpo),
      payload,
    });
  }

  // ── Escritura con respaldo ──

  /** Sección del plan cuyo «antes» es su propio GET (frecuencias, edades, tarifa por días…). */
  private seccionPlan(
    p: { cramo: number; cplan: string },
    seccion: SeccionRespaldo,
    ctx: ContextoCambio | undefined,
    metodo: 'POST' | 'PUT' | 'PATCH',
    ruta: string,
    cuerpo: Obj,
    rutaLectura: string,
    payload: Obj = cuerpo,
  ) {
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionPlan(p.cramo, p.cplan, seccion),
      leer: () => this.bridge.leerConfigurador(rutaLectura),
      escribir: () => this.bridge.escribirConfigurador(metodo, ruta, cuerpo),
      payload,
    });
  }

  /** Sección del plan que se respalda con el plan completo leído de Sis2000 (cabecera, coberturas). */
  private seccionPlanLeyendoPlan(
    p: { cramo: number; cplan: string },
    seccion: SeccionRespaldo,
    ctx: ContextoCambio | undefined,
    metodo: 'POST' | 'PATCH',
    ruta: string,
    cuerpo: Obj,
    comparable?: (s: unknown) => unknown,
    payload: Obj = cuerpo,
  ) {
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionPlan(p.cramo, p.cplan, seccion),
      leer: () => this.bridge.leerSis2000Plan(p.cramo, p.cplan),
      escribir: () => this.bridge.escribirConfigurador(metodo, ruta, cuerpo),
      payload,
      exigirExistente: true,
      comparable:
        comparable ??
        ((s) => {
          const o = s && typeof s === 'object' ? (s as Obj) : null;
          const plan = o?.plan as Obj | undefined;
          return plan?.coberturas ?? s;
        }),
    });
  }

  private seccionRamo(
    cramo: number,
    seccion: SeccionRamoRespaldo,
    ctx: ContextoCambio | undefined,
    metodo: 'POST' | 'PUT' | 'PATCH',
    ruta: string,
    cuerpo: Obj,
    rutaLectura: string,
    payload: Obj = cuerpo,
  ) {
    return this.escribir(ctx, {
      entidad: 'PLAN',
      clave: claveRespaldo.seccionRamo(cramo, seccion),
      leer: () => this.bridge.leerConfigurador(rutaLectura),
      escribir: () => this.bridge.escribirConfigurador(metodo, ruta, cuerpo),
      payload,
    });
  }

  /**
   * Respaldo previo + escritura. Si nest-api responde `grabado: false` (pide confirmar advertencias) no grabó: la versión
   * queda FALLIDA con ese motivo y se devuelve la respuesta para que el front pida confirmar.
   */
  private async escribir(ctx: ContextoCambio | undefined, op: OperacionRespaldada<Obj>): Promise<Obj> {
    this.asegurarConfigurado();
    try {
      const { resultado } = await this.respaldo.escribir({
        ...op,
        escribir: async (anterior) => {
          const r = await op.escribir(anterior);
          if (r && r.grabado === false) throw new SinGrabar(r);
          return r;
        },
        motivo: ctx?.motivo,
        usuario: ctx?.usuario,
      });
      return resultado;
    } catch (e) {
      if (e instanceof SinGrabar) return e.respuesta;
      throw e;
    }
  }
}
