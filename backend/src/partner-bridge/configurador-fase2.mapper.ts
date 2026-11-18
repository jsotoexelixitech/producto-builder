// Configurador fase 2 «editar todo» (.antigravity/CONTRATO-CONFIGURADOR-FASE2.md): cuerpos del front → DTOs de
// nest-api v1/configurador. Explícitos (solo los campos del contrato) para no mandar basura a los DTOs con whitelist.

type Obj = Record<string, unknown>;

const texto = (v: unknown) => (v == null ? '' : String(v).trim());
const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
const fecha = (v: unknown) => (texto(v) ? texto(v).slice(0, 10) : undefined);
const bool = (v: unknown): boolean | undefined => {
  if (v == null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  return ['T', 'S', '1', 'TRUE', 'Y'].includes(String(v).trim().toUpperCase());
};
const estado = (v: unknown) => {
  const e = texto(v).toUpperCase();
  return e === 'V' || e === 'I' ? e : undefined;
};
function limpio<T extends Obj>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;
}
/** `confirmar: true` solo si el usuario aceptó las advertencias. */
const conConfirmar = (o: Obj, p: Obj) => (bool(p.confirmar) === true ? { ...o, confirmar: true } : o);
const lista = (v: unknown) => (Array.isArray(v) ? (v as Obj[]) : []);

export const LETRAS_FRECUENCIA = ['A', 'S', 'T', 'C', 'M', 'E', 'K', 'D'];

// ── Frecuencias ──

export function aFrecuencia(p: Obj) {
  return conConfirmar(
    limpio({ ifrecuencia: texto(p.ifrecuencia).toUpperCase(), xfrecuencia: texto(p.xfrecuencia), ndias: num(p.ndias), itipo: texto(p.itipo).toUpperCase() }),
    p,
  );
}

/** PATCH frecuencias/:ifrecuencia: `ndias` identifica la fila (si hay varias con la letra); `ndiasNuevo` es el valor nuevo. */
export function aEditarFrecuencia(p: Obj) {
  return conConfirmar(
    limpio({ xfrecuencia: texto(p.xfrecuencia), ndias: num(p.ndias), ndiasNuevo: num(p.ndiasNuevo), iestado: estado(p.iestado) }),
    p,
  );
}

export function aFrecuenciaProductor(p: Obj) {
  return conConfirmar(
    limpio({
      cproductor: num(p.cproductor),
      ifrecuencia: texto(p.ifrecuencia).toUpperCase(),
      xfrecuencia: texto(p.xfrecuencia),
      ndias: num(p.ndias),
      itipo: texto(p.itipo).toUpperCase(),
    }),
    p,
  );
}

// ── Quién vende (mausuplan) ──

/** { centidad, itipouso, items } — items null = todos los de esa entidad. Solo P, C y G se editan. */
export function aQuienVende(p: Obj): { centidad: string; itipouso: 'A' | 'E'; items: string[] | null; confirmar?: true } {
  const items = p.items == null ? null : lista(p.items).map((x) => texto(x)).filter(Boolean);
  const cuerpo = {
    centidad: texto(p.centidad).toUpperCase(),
    itipouso: (texto(p.itipouso).toUpperCase() === 'E' ? 'E' : 'A') as 'A' | 'E',
    items: items && items.length ? [...new Set(items)] : null,
  };
  return bool(p.confirmar) === true ? { ...cuerpo, confirmar: true } : cuerpo;
}

export const ENTIDADES_QUIEN_VENDE = ['P', 'C', 'G'];

/** Query de GET quien-vende (solo los filtros del contrato). */
export function consultaQuienVende(q: Obj): string {
  const qs = new URLSearchParams();
  const centidad = texto(q.centidad).toUpperCase();
  const itipouso = texto(q.itipouso).toUpperCase();
  if (centidad) qs.set('centidad', centidad);
  if (itipouso === 'A' || itipouso === 'E') qs.set('itipouso', itipouso);
  if (texto(q.q)) qs.set('q', texto(q.q).slice(0, 100));
  const limit = num(q.limit);
  if (limit && limit > 0) qs.set('limit', String(Math.min(Math.floor(limit), 500)));
  const offset = num(q.offset);
  if (offset && offset > 0) qs.set('offset', String(Math.floor(offset)));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ── Producto (maproductos) ──

export const CAMPOS_PRODUCTO_EDITABLES = [
  'xdescripcion_l',
  'xdescripcion_c',
  'xabreviatura',
  'iproductor',
  'icanal',
  'igestor',
  'xform',
  'xdescripcion_prod',
  'mmonto_inicial',
  'norden',
  'xfraccionamiento',
  'xurl_presentacion',
] as const;

const BOOLEANOS_PRODUCTO = new Set(['iproductor', 'icanal', 'igestor']);
const NUMEROS_PRODUCTO = new Set(['mmonto_inicial', 'norden']);

/**
 * PATCH productos/:cproducto: campos editables + cramo (elige la fila si el código se repite). Nunca cproducto.
 * null vacía el campo en Sis2000.
 */
export function aEditarProducto(p: Obj) {
  const out: Obj = { cramo: num(p.cramo) };
  for (const c of CAMPOS_PRODUCTO_EDITABLES) {
    if (p[c] === undefined) continue;
    if (p[c] === null && !BOOLEANOS_PRODUCTO.has(c)) {
      out[c] = null;
      continue;
    }
    out[c] = BOOLEANOS_PRODUCTO.has(c) ? bool(p[c]) : NUMEROS_PRODUCTO.has(c) ? num(p[c]) : texto(p[c]);
  }
  return conConfirmar(
    Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)),
    p,
  );
}


// ── Plan: cabecera y coberturas ──

export function aCabeceraPlan(p: Obj) {
  return conConfirmar(
    limpio({
      xplan: texto(p.xplan),
      cmoneda: texto(p.cmoneda).toUpperCase(),
      cproducto: texto(p.cproducto).toUpperCase(),
      iestado: estado(p.iestado),
    }),
    p,
  );
}

/** Prima y tasa son excluyentes: si llegan las dos, gana la que tenga valor (> 0); con las dos > 0, nest-api decide. */
function precio(p: Obj) {
  const mprima = num(p.mprima);
  const pprima = num(p.pprima);
  if (mprima !== undefined && pprima !== undefined) {
    if (mprima > 0 && !(pprima > 0)) return { mprima };
    if (pprima > 0 && !(mprima > 0)) return { pprima };
  }
  return limpio({ mprima, pprima });
}

export function aCoberturaPlan(p: Obj) {
  return conConfirmar(
    limpio({
      ccobertura: texto(p.ccobertura ?? p.ccober),
      ctarifa: texto(p.ctarifa),
      msumamin: num(p.msumamin),
      msumamax: num(p.msumamax),
      ...precio(p),
      bobligatoria: bool(p.bobligatoria),
    }),
    p,
  );
}

export function aTarifaCoberturaPlan(p: Obj) {
  return conConfirmar(limpio({ msumamin: num(p.msumamin), msumamax: num(p.msumamax), ...precio(p) }), p);
}

const parentescos = (v: unknown) =>
  lista(v)
    .map((r) => limpio({ cparen: num(r.cparen), ctablatar: texto(r.ctablatar).toUpperCase(), csexo: texto(r.csexo).toUpperCase() }))
    .filter((r) => r.cparen !== undefined);

export function aCoberturaPersonas(p: Obj) {
  return conConfirmar(
    limpio({
      ccobertura: texto(p.ccobertura ?? p.ccober),
      ctarifa: texto(p.ctarifa),
      bobligatoria: bool(p.bobligatoria),
      parentescos: parentescos(p.parentescos),
    }),
    p,
  );
}

export function aEditarCoberturaPersonas(p: Obj) {
  return conConfirmar({ parentescos: parentescos(p.parentescos) }, p);
}

/** Baja de cobertura (cosas o personas): solo confirmar y, en personas, la tarifa si viene. */
export function aBajaCobertura(p: Obj) {
  return conConfirmar(limpio({ ctarifa: texto(p.ctarifa) }), p);
}

// ── Personas: edades por parentesco ──

export function aEdadParentesco(p: Obj) {
  return conConfirmar(
    limpio({
      cemin_ase: num(p.cemin_ase),
      cemax_ase: num(p.cemax_ase),
      cemin_gi: num(p.cemin_gi),
      cemax_gi: num(p.cemax_gi),
      msvitalicia: num(p.msvitalicia),
      msvitaliciaext: num(p.msvitaliciaext),
      cereduccion: num(p.cereduccion),
      msreducida: num(p.msreducida),
      msreducidaext: num(p.msreducidaext),
    }),
    p,
  );
}

// ── Patrimoniales: descuentos y recargos, condominio ──

export type TipoDescRec = 'dispositivos' | 'sustancias';
export const CAMPOS_DESC_REC: Record<TipoDescRec, { codigo: string; nombre: string; porcentaje: string }> = {
  dispositivos: { codigo: 'cdisseg', nombre: 'xdisseg', porcentaje: 'pdisseg' },
  sustancias: { codigo: 'csustanc', nombre: 'xsustanc', porcentaje: 'porcenta' },
};

export function aDescRec(tipo: TipoDescRec, p: Obj, conCodigo: boolean) {
  const c = CAMPOS_DESC_REC[tipo];
  return conConfirmar(
    limpio({
      ...(conCodigo ? { [c.codigo]: num(p[c.codigo] ?? p.codigo) } : {}),
      [c.nombre]: texto(p[c.nombre] ?? p.nombre),
      [c.porcentaje]: num(p[c.porcentaje] ?? p.porcentaje),
    }),
    p,
  );
}

export const TABLAS_CONDOMINIO = ['antiguedad', 'reparto', 'rango'] as const;
export type TablaCondominio = (typeof TABLAS_CONDOMINIO)[number];

const COLUMNAS_CONDOMINIO: Record<TablaCondominio, { textos: string[]; numeros: string[] }> = {
  antiguedad: { textos: ['iuso'], numeros: ['itramo', 'pprima'] },
  reparto: { textos: ['ccober', 'ctarifa', 'itipo'], numeros: ['pvalor', 'plimite'] },
  rango: { textos: ['ccober', 'ctarifa'], numeros: ['ptasa_min', 'ptasa_max'] },
};

/** PUT condominio/:tabla → { filas } con las columnas de la tabla (reemplaza las filas del ramo). */
export function aCondominio(tabla: TablaCondominio, p: Obj) {
  const cols = COLUMNAS_CONDOMINIO[tabla];
  const filas = lista(p.filas).map((r) =>
    limpio({
      ...Object.fromEntries(cols.textos.map((c) => [c, texto(r[c]).toUpperCase()])),
      ...Object.fromEntries(cols.numeros.map((c) => [c, num(r[c])])),
    }),
  );
  return conConfirmar({ filas }, p);
}

/** El reparto con itipo P debe sumar 100 (null = bien). */
export function errorRepartoCondominio(filas: Obj[]): string | null {
  const p = filas.filter((f) => texto(f.itipo).toUpperCase() === 'P');
  if (!p.length) return null;
  const suma = p.reduce((s, f) => s + (num(f.pvalor) ?? 0), 0);
  return Math.abs(suma - 100) > 0.0001 ? `El reparto de tipo P debe sumar 100; suma ${Math.round(suma * 10000) / 10000}.` : null;
}

// ── Auto: tarifa por días y tasa de casco ──

export function aTarifaDias(p: Obj) {
  const filas = lista(p.filas).map((r) =>
    limpio({
      ctarifabi: num(r.ctarifabi),
      qdias: num(r.qdias),
      bnacional: bool(r.bnacional) ?? false,
      cmoneda: texto(r.cmoneda).toUpperCase(),
      ndias_min: num(r.ndias_min),
      ndias_max: num(r.ndias_max),
      msuma: num(r.msuma),
      mprima: num(r.mprima),
      mprima_anual: num(r.mprima_anual),
      mprima_dia: num(r.mprima_dia),
    }),
  );
  return conConfirmar({ filas }, p);
}

export const MOVIMIENTOS_CASCO = ['INCREMENTO', 'DISMINUCION'];
export const ALCANCES_CASCO = ['GLOBAL', 'TIPO_VEHICULO', 'COBERTURA', 'ANTIGUEDAD', 'SUMA_ASEGURADA', 'COMBINADA'];

/** Filtros con los nombres que lee sp_tarifa_casco_validar_ajuste (solo las llaves conocidas). */
function filtrosCasco(v: unknown): Obj | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const f = v as Obj;
  const enteros = (x: unknown) => lista(x).map((n) => num(n)).filter((n): n is number => n !== undefined);
  const out = limpio({
    vehicleTypes: enteros(f.vehicleTypes).length ? enteros(f.vehicleTypes) : undefined,
    coverages: lista(f.coverages).length ? lista(f.coverages).map((c) => texto(c).toUpperCase()).filter(Boolean) : undefined,
    ranges: enteros(f.ranges).length ? enteros(f.ranges) : undefined,
    ageFrom: num(f.ageFrom),
    ageTo: num(f.ageTo),
  });
  return Object.keys(out).length ? out : undefined;
}

/** POST tasa-casco/vista-previa (no escribe). */
export function aVistaPreviaCasco(p: Obj) {
  return limpio({
    movimiento: texto(p.movimiento).toUpperCase(),
    porcentaje: num(p.porcentaje),
    alcance: texto(p.alcance).toUpperCase(),
    filtros: filtrosCasco(p.filtros),
    tipo_vehiculo: num(p.tipo_vehiculo),
    cobertura: texto(p.cobertura),
  });
}

/** POST tasa-casco/versiones: propuesta por AJUSTE (movimiento, %, alcance, filtros) o RESTAURACION (version_id). */
export function aVersionCasco(p: Obj) {
  const origen = texto(p.origen).toUpperCase() === 'RESTAURACION' ? 'RESTAURACION' : 'AJUSTE';
  const comun = limpio({
    origen,
    cusuario: num(p.cusuario),
    vigente_desde: fecha(p.vigente_desde),
    vigente_hasta: fecha(p.vigente_hasta),
    rige_al_aprobar: bool(p.rige_al_aprobar),
    motivo: texto(p.motivo).slice(0, 500),
  });
  if (origen === 'RESTAURACION') return limpio({ ...comun, version_id: num(p.version_id) });
  return limpio({ ...comun, ...aVistaPreviaCasco(p), tipo_vehiculo: undefined, cobertura: undefined });
}

/** Publicar (= aprobar) o rechazar: usuario de Sis2000 que revisa (distinto del que propuso) y comentario. */
export function aRevisarCasco(p: Obj) {
  return limpio({ cusuario: num(p.cusuario), comentario: texto(p.comentario).slice(0, 500) });
}

export function aCancelarCasco(p: Obj) {
  return limpio({ cusuario: num(p.cusuario), motivo: texto(p.motivo).slice(0, 500) });
}

/** Respuesta de un GET: `data` tal cual; si es lista y el sobre trae total/paginación, se conserva junto a las filas. */
export function leerSobre(body: Obj): unknown {
  const { status: _s, message: _m, data, ...resto } = body ?? {};
  if (Array.isArray(data)) return Object.keys(resto).length ? { filas: data, ...resto } : data;
  return data === undefined ? resto : data;
}

/** Respuesta de una escritura: objeto con `advertencias` (texto) siempre presente. */
export function respuestaEscritura(body: Obj): Obj {
  const data = body?.data;
  const advSobre = Array.isArray(body?.advertencias) ? (body.advertencias as unknown[]) : [];
  const base: Obj = Array.isArray(data) ? { filas: data } : data && typeof data === 'object' ? { ...(data as Obj) } : {};
  const adv = Array.isArray(base.advertencias) ? (base.advertencias as unknown[]) : advSobre;
  return {
    ...base,
    advertencias: adv.map((a) => (typeof a === 'string' ? a : String((a as Obj)?.mensaje ?? JSON.stringify(a)))),
  };
}

/** Filas borradas que nest-api devuelve en una baja física (para guardarlas en el historial). */
export function filasBorradas(r: unknown): Obj[] {
  if (Array.isArray(r)) return r as Obj[];
  const o = r && typeof r === 'object' ? (r as Obj) : {};
  for (const k of ['borradas', 'filasBorradas', 'eliminadas', 'filas', 'rows']) if (Array.isArray(o[k])) return o[k] as Obj[];
  return [];
}
