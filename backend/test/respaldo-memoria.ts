// Dobles de prueba: repositorio de respaldo en memoria y un Sis2000 simulado detrás del bridge.
import { randomUUID } from 'node:crypto';
import { aEditarCobertura, aEditarProveedorPlan, aProveedorPlan, cuerpoPlanParaPrueba } from './util';
import type {
  Cambio,
  EntidadRespaldo,
  RespaldoRepo,
  RespaldoRow,
  TipoVersion,
  UsuarioCambio,
  VersionRow,
} from '../src/core/respaldo/respaldo.types';

type Obj = Record<string, unknown>;
const copia = <T>(v: T): T => (v === undefined ? (null as T) : JSON.parse(JSON.stringify(v)));

export class MemoriaRespaldoRepo implements RespaldoRepo {
  respaldos: RespaldoRow[] = [];
  versionesGuardadas: VersionRow[] = [];
  /** Para simular que la Postgres del configurador no responde. */
  fallar = false;

  async buscar(entidad: EntidadRespaldo, clave: string) {
    return this.respaldos.find((r) => r.entidad === entidad && r.clave === clave) ?? null;
  }

  async asegurarOriginal(d: { entidad: EntidadRespaldo; clave: string; existia: boolean; original: unknown; usuario?: UsuarioCambio }) {
    if (this.fallar) throw new Error('Postgres no disponible');
    const existente = await this.buscar(d.entidad, d.clave);
    if (existente) return existente;
    const fila: RespaldoRow = {
      id: randomUUID(),
      entidad: d.entidad,
      clave: d.clave,
      existia: d.existia,
      original: copia(d.original),
      usuarioId: d.usuario?.id ?? null,
      usuarioEmail: d.usuario?.email ?? null,
      usuarioNombre: d.usuario?.nombre ?? null,
      createdAt: new Date(),
    };
    this.respaldos.push(fila);
    return fila;
  }

  async abrirVersion(
    respaldoId: string,
    d: { tipo: TipoVersion; anterior: unknown; payload: unknown; motivo?: string; restauradaDesde?: string; usuario?: UsuarioCambio },
  ) {
    if (this.fallar) throw new Error('Postgres no disponible');
    const numero = this.versionesGuardadas.filter((v) => v.respaldoId === respaldoId).length + 1;
    const v: VersionRow = {
      id: randomUUID(),
      respaldoId,
      numero,
      tipo: d.tipo,
      resultado: 'PENDIENTE',
      anterior: copia(d.anterior),
      estado: null,
      payload: copia(d.payload),
      cambios: null,
      motivo: d.motivo ?? null,
      restauradaDesde: d.restauradaDesde ?? null,
      error: null,
      usuarioId: d.usuario?.id ?? null,
      usuarioEmail: d.usuario?.email ?? null,
      usuarioNombre: d.usuario?.nombre ?? null,
      createdAt: new Date(),
      terminadaEn: null,
    };
    this.versionesGuardadas.push(v);
    return v;
  }

  async cerrarVersion(id: string, d: { resultado: 'APLICADA' | 'FALLIDA'; estado?: unknown; cambios?: Cambio[]; error?: string }) {
    const v = this.versionesGuardadas.find((x) => x.id === id);
    if (!v) throw new Error('versión no existe');
    if (v.resultado !== 'PENDIENTE') throw new Error('versión ya cerrada');
    Object.assign(v, { resultado: d.resultado, estado: copia(d.estado ?? null), cambios: d.cambios ?? [], error: d.error ?? null, terminadaEn: new Date() });
    return v;
  }

  async versiones(respaldoId: string) {
    return this.versionesGuardadas.filter((v) => v.respaldoId === respaldoId).sort((a, b) => b.numero - a.numero);
  }

  async version(id: string) {
    return this.versionesGuardadas.find((v) => v.id === id) ?? null;
  }
}

/** Sis2000 en memoria con la misma superficie que PartnerBridgeService usa el historial. */
export class Sis2000Simulado {
  coberturas: Obj[] = [];
  planes = new Map<string, Obj>();
  proveedores: Obj[] = [];
  llamadas: Array<{ metodo: string; args: unknown[] }> = [];
  fallarLectura = false;

  private anotar(metodo: string, ...args: unknown[]) {
    this.llamadas.push({ metodo, args: copia(args) });
  }

  private revisar() {
    if (this.fallarLectura) throw new Error('nest-api no responde');
  }

  async listSis2000CoberturasByRamo(cramo: string) {
    this.revisar();
    return copia(this.coberturas.filter((c) => String(c.cramo) === String(cramo)));
  }

  async updateSis2000Cobertura(cramo: string, ccob: string, body: Obj) {
    this.anotar('updateSis2000Cobertura', cramo, ccob, body);
    const fila = this.coberturas.find((c) => String(c.cramo) === String(cramo) && c.ccobertura === ccob);
    if (!fila) throw new Error('no existe');
    Object.assign(fila, aEditarCobertura(body));
    return { cramo: Number(cramo), ccobertura: ccob };
  }

  async createSis2000Cobertura(body: Obj) {
    this.anotar('createSis2000Cobertura', body);
    this.coberturas.push({ ...body, iestado: 'V' });
    return { cramo: body.cramo, ccobertura: body.ccobertura };
  }

  async leerSis2000Plan(cramo: number, cplan: string) {
    this.revisar();
    return copia(this.planes.get(`${cramo}-${cplan.toUpperCase()}`) ?? null);
  }

  async createSis2000MasterPlan(body: Obj) {
    this.anotar('createSis2000MasterPlan', body);
    const plan = cuerpoPlanParaPrueba(body);
    this.planes.set(`${plan.cramo}-${String(plan.cplan).toUpperCase()}`, { type: plan.type, plan, advertencias: [], filas: {} });
    return { cramo: plan.cramo, cplan: plan.cplan };
  }

  async updateSis2000MasterPlan(id: string, body: Obj) {
    this.anotar('updateSis2000MasterPlan', id, body);
    const plan = cuerpoPlanParaPrueba(body);
    this.planes.set(id.toUpperCase(), { type: plan.type, plan, advertencias: [], filas: {} });
    return { cramo: plan.cramo, cplan: plan.cplan };
  }

  async deleteSis2000MasterPlan(id: string) {
    this.anotar('deleteSis2000MasterPlan', id);
    this.planes.delete(id.toUpperCase());
  }

  async listSis2000PlanProveedores(cramo: number, cplan: string) {
    this.revisar();
    return {
      escritura_habilitada: true,
      columna_cobertura: null,
      proveedores: copia(this.proveedores.filter((p) => p.cramo === cramo && p.cplan === cplan)),
    };
  }

  async agregarSis2000ProveedorPlan(cramo: number, cplan: string, body: Obj) {
    this.anotar('agregarSis2000ProveedorPlan', cramo, cplan, body);
    const fila: Obj = { cramo, cplan, ...aProveedorPlan(body) };
    this.proveedores.push({ ...fila, fhasta: fila.fhasta ?? null });
    return {};
  }

  private fila(cramo: number, cplan: string, k: Obj) {
    return this.proveedores.find(
      (p) => p.cramo === cramo && p.cplan === cplan && p.cci_rif === k.cci_rif && p.cclave_num === k.cclave_num && p.fdesde === k.fdesde,
    );
  }

  async editarSis2000ProveedorPlan(cramo: number, cplan: string, body: Obj) {
    this.anotar('editarSis2000ProveedorPlan', cramo, cplan, body);
    const cuerpo = aEditarProveedorPlan(body) as Obj;
    const f = this.fila(cramo, cplan, cuerpo);
    if (!f) throw new Error('no existe');
    const { sin_fin, cci_rif: _r, cclave_num: _c, fdesde: _d, ...resto } = cuerpo;
    Object.assign(f, resto, sin_fin ? { fhasta: null } : {});
    return {};
  }

  async bajaSis2000ProveedorPlan(cramo: number, cplan: string, body: Obj) {
    this.anotar('bajaSis2000ProveedorPlan', cramo, cplan, body);
    const f = this.fila(cramo, cplan, body);
    if (!f) throw new Error('no existe');
    f.fhasta = body.fhasta_baja;
    return {};
  }
}
