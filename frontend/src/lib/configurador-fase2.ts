// Configurador fase 2, «editar todo» (.antigravity/CONTRATO-CONFIGURADOR-FASE2.md). Lógica pura de los paneles:
// normalizar lo que responde nest-api (tolerante a nombres de campo), validar formularios y armar los cuerpos.
// Sin dependencias de React: se prueba con `npm test -w frontend` (node --test).

import { familiaValida, fechaIso, type FamiliaRamo } from './configurador.ts';

type Obj = Record<string, unknown>;
export const texto = (v: unknown) => (v == null ? '' : String(v).trim());
const numeroONull = (v: unknown): number | null => {
  if (v == null || texto(v) === '') return null;
  const n = Number(texto(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
/** Texto de un input → número (coma decimal aceptada); undefined si está vacío o no es número. */
export const aNumero = (v: string | undefined | null): number | undefined => {
  const t = texto(v).replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};
const vacio = (v: string | undefined | null) => !texto(v);
const esEnteroTexto = (v: string) => /^-?\d+$/.test(texto(v));
const primero = (r: Obj, claves: string[]) => {
  for (const k of claves) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
};
/** Lista de una respuesta: arreglo directo o dentro de filas/items/rows/data. */
export function listaDe(r: unknown, claves: string[] = ['filas', 'items', 'rows', 'data', 'resultados']): Obj[] {
  if (Array.isArray(r)) return r as Obj[];
  if (r && typeof r === 'object') {
    for (const k of claves) if (Array.isArray((r as Obj)[k])) return (r as Obj)[k] as Obj[];
  }
  return [];
}
const verdadero = (v: unknown) => v === true || v === 1 || ['1', 'TRUE', 'S', 'T', 'Y', 'SI', 'SÍ'].includes(texto(v).toUpperCase());

// ── Catálogo de ramos ─────────────────────────────────────────────────────────

export type EstadoRamo = 'activo' | 'sin-planes' | 'inactivo' | '';

export interface RamoCatalogo {
  cramo: number;
  nombre: string;
  familia: FamiliaRamo;
  colectivo: boolean;
  emisionNexus: string | null;
  estado: EstadoRamo;
  planes: number | null;
  productos: number | null;
  /** nest-api lo marca (fianzas): solo se consulta. */
  soloLectura: boolean;
  /** Avisos que manda nest-api por ramo (se muestran tal cual). */
  avisos: string[];
  /** Tiene tarifa de condominio / tarifa por días. */
  condominio: boolean;
  tarifaDias: boolean;
}

export const NOMBRE_FAMILIA: Record<FamiliaRamo, string> = {
  auto: 'Automóvil',
  personas: 'Personas',
  patrimonial: 'Patrimoniales',
  cosas: 'Patrimoniales',
  fianzas: 'Fianzas',
};

export const NOMBRE_EMISION: Record<string, string> = {
  auto: 'Emisión de auto',
  personas: 'Emisión de personas',
  patrimonial: 'Emisión patrimonial',
};

export function normalizarRamoCatalogo(r: Obj): RamoCatalogo {
  const planes = numeroONull(primero(r, ['planes', 'nplanes', 'cantidadPlanes', 'qplanes', 'totalPlanes']));
  const productos = numeroONull(primero(r, ['productos', 'nproductos', 'cantidadProductos', 'qproductos', 'totalProductos']));
  const e = texto(r.estado).toLowerCase();
  let estado: EstadoRamo = e === 'activo' || e === 'sin-planes' || e === 'inactivo' ? e : '';
  if (!estado && texto(r.iestado)) estado = texto(r.iestado).toUpperCase() !== 'V' ? 'inactivo' : planes === 0 ? 'sin-planes' : planes ? 'activo' : '';
  return {
    cramo: Number(r.cramo),
    nombre: texto(r.xdescripcion_l ?? r.xdescripcion ?? r.xramo),
    familia: familiaValida(r.familia),
    colectivo: verdadero(r.colectivo),
    emisionNexus: texto(r.emisionNexus) || null,
    estado,
    planes: Array.isArray(r.planes) ? (r.planes as unknown[]).length : planes,
    productos: Array.isArray(r.productos) ? (r.productos as unknown[]).length : productos,
    soloLectura: verdadero(r.soloLectura) || familiaValida(r.familia) === 'fianzas',
    avisos: (Array.isArray(r.avisos) ? (r.avisos as unknown[]) : []).map((a) => texto(typeof a === 'object' && a ? (a as Obj).mensaje : a)).filter(Boolean),
    condominio: verdadero(r.condominio),
    tarifaDias: verdadero(r.tarifaDias),
  };
}

/**
 * Avisos de un ramo en el catálogo: los de nest-api y, si no mandó ninguno sobre el tema, los propios (fianzas,
 * colectivos, sin planes, inactivo).
 */
export function avisosRamo(r: RamoCatalogo): string[] {
  const out = [...r.avisos];
  const yaDice = (re: RegExp) => out.some((a) => re.test(a));
  if (r.familia === 'fianzas' && !yaDice(/emisi[oó]n nexus/i)) out.push('Sin flujo de emisión Nexus: solo se puede consultar.');
  if (r.colectivo && !yaDice(/plantilla/i)) out.push('Colectivo: requiere póliza plantilla de Técnica.');
  if ((r.estado === 'sin-planes' || r.planes === 0) && !yaDice(/sin planes|no tiene planes/i)) out.push('Este ramo todavía no tiene planes.');
  if (r.estado === 'inactivo' && !yaDice(/inactivo/i)) out.push('Ramo inactivo en Sis2000.');
  return out;
}

export function filtrarRamos(ramos: RamoCatalogo[], filtro: { familia?: string; q?: string }): RamoCatalogo[] {
  const q = texto(filtro.q).toLowerCase();
  const fam = texto(filtro.familia);
  return ramos.filter((r) => {
    if (fam && fam !== 'todas') {
      const f = r.familia === 'cosas' ? 'patrimonial' : r.familia;
      if (f !== fam) return false;
    }
    if (q && !String(r.cramo).includes(q) && !r.nombre.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Se puede crear un plan nuevo en el ramo (fianzas e inactivos no). */
export const ramoPermiteCrearPlan = (r: RamoCatalogo) => !r.soloLectura && r.familia !== 'fianzas' && r.estado !== 'inactivo';

// ── Frecuencias (maplanes_frec, maplanes_frec_produc) ─────────────────────────

export const LETRAS_FRECUENCIA: Record<string, string> = {
  A: 'Anual',
  S: 'Semestral',
  T: 'Trimestral',
  C: 'Cuatrimestral',
  M: 'Mensual',
  E: 'Especial',
  K: 'Bimestral',
  D: 'Por días',
};

export interface Frecuencia {
  ifrecuencia: string;
  xfrecuencia: string;
  ndias: number | null;
  iestado: string;
  itipo: string;
}

export function normalizarFrecuencia(r: Obj): Frecuencia {
  return {
    ifrecuencia: texto(r.ifrecuencia).toUpperCase(),
    xfrecuencia: texto(r.xfrecuencia),
    ndias: numeroONull(r.ndias),
    iestado: texto(r.iestado).toUpperCase() || 'V',
    itipo: texto(r.itipo),
  };
}

export interface FrecuenciaForm {
  ifrecuencia: string;
  xfrecuencia: string;
  ndias: string;
}

export function validarFrecuencia(f: FrecuenciaForm, existentes: Frecuencia[] = []): Partial<Record<keyof FrecuenciaForm, string>> {
  const e: Partial<Record<keyof FrecuenciaForm, string>> = {};
  const letra = texto(f.ifrecuencia).toUpperCase();
  if (!letra) e.ifrecuencia = 'Elige la forma de pago.';
  else if (!LETRAS_FRECUENCIA[letra]) e.ifrecuencia = `Letra no válida: usa ${Object.keys(LETRAS_FRECUENCIA).join(', ')}.`;
  if (letra === 'D' && vacio(f.ndias)) e.ndias = 'Por días: indica cuántos días.';
  if (!vacio(f.ndias) && (!/^\d+$/.test(texto(f.ndias)) || Number(f.ndias) <= 0)) e.ndias = 'Los días son un número entero mayor que 0.';
  if (texto(f.xfrecuencia).length > 150) e.xfrecuencia = 'El nombre admite hasta 150 caracteres.';
  if (!e.ifrecuencia && !e.ndias) {
    const nd = vacio(f.ndias) ? null : Number(f.ndias);
    if (existentes.some((x) => x.iestado === 'V' && x.ifrecuencia === letra && (x.ndias ?? null) === nd)) {
      e.ifrecuencia = 'Esa forma de pago ya está activa en el plan.';
    }
  }
  return e;
}

export function cuerpoFrecuencia(f: FrecuenciaForm) {
  const letra = texto(f.ifrecuencia).toUpperCase();
  const out: Obj = { ifrecuencia: letra, xfrecuencia: texto(f.xfrecuencia) || LETRAS_FRECUENCIA[letra] || letra };
  if (!vacio(f.ndias)) out.ndias = Number(f.ndias);
  return out;
}

/** Al menos una forma de pago activa (regla de la revisión). */
export const hayFrecuenciaActiva = (filas: Frecuencia[]) => filas.some((f) => f.iestado === 'V');

export interface FrecuenciaProductor {
  cproductor: string;
  ifrecuencia: string;
  xfrecuencia: string;
  ndias: number | null;
  itipo: string;
}

export function normalizarFrecuenciaProductor(r: Obj): FrecuenciaProductor {
  return {
    cproductor: texto(r.cproductor),
    ifrecuencia: texto(r.ifrecuencia).toUpperCase(),
    xfrecuencia: texto(r.xfrecuencia),
    ndias: numeroONull(r.ndias),
    itipo: texto(r.itipo),
  };
}

// ── Quién vende (mausuplan) ───────────────────────────────────────────────────

export type EntidadVenta = 'P' | 'C' | 'G';
export const ENTIDADES_EDITABLES: EntidadVenta[] = ['P', 'C', 'G'];
export const NOMBRE_ENTIDAD_VENTA: Record<string, { uno: string; varios: string }> = {
  P: { uno: 'productor', varios: 'Productores' },
  C: { uno: 'canal', varios: 'Canales' },
  G: { uno: 'gestor', varios: 'Gestores' },
  R: { uno: 'entidad R', varios: 'Otros (R)' },
  U: { uno: 'entidad U', varios: 'Otros (U)' },
  A: { uno: 'entidad A', varios: 'Otros (A)' },
};
export const entidadEditable = (c: string): c is EntidadVenta => (ENTIDADES_EDITABLES as string[]).includes(texto(c).toUpperCase());

export interface FilaQuienVende {
  id: string;
  centidad: string;
  /** null = todos los de esa entidad. */
  citem: string | null;
  nombre: string;
  itipouso: 'A' | 'E';
}

export function normalizarFilaQuienVende(r: Obj): FilaQuienVende {
  const c = texto(r.citem);
  return {
    id: texto(r.id),
    centidad: texto(r.centidad).toUpperCase(),
    citem: c ? c : null,
    nombre: texto(primero(r, ['nombre', 'xnombre', 'xentidad', 'xproductor', 'xcanalalt', 'xgestor', 'xdescripcion'])),
    itipouso: texto(r.itipouso).toUpperCase() === 'E' ? 'E' : 'A',
  };
}

export interface PaginaQuienVende {
  filas: FilaQuienVende[];
  total: number | null;
}

export function normalizarPaginaQuienVende(r: unknown): PaginaQuienVende {
  const filas = listaDe(r).map(normalizarFilaQuienVende);
  const o = r && typeof r === 'object' && !Array.isArray(r) ? (r as Obj) : {};
  return { filas, total: numeroONull(primero(o, ['total', 'totalFilas', 'count', 'cantidad'])) };
}

export interface GrupoResumen {
  centidad: string;
  itipouso: 'A' | 'E';
  cantidad: number;
  /** Hay una fila con citem NULL (todos los de esa entidad). */
  todos: boolean;
}

/** Resumen por entidad e incluye/excluye; tolera arreglo o { grupos | resumen | filas } y el «todos» aparte. */
export function normalizarResumenQuienVende(r: unknown): GrupoResumen[] {
  const lista = listaDe(r, ['grupos', 'resumen', 'filas', 'items', 'porEntidad', 'data']);
  const o = r && typeof r === 'object' && !Array.isArray(r) ? (r as Obj) : {};
  const todosAparte = listaDe(o, ['todos', 'conTodos', 'citemNull']);
  const grupos = lista.map((g): GrupoResumen => {
    const centidad = texto(g.centidad).toUpperCase();
    const itipouso = texto(g.itipouso).toUpperCase() === 'E' ? 'E' : 'A';
    const marca = primero(g, ['todos', 'conTodos', 'hayTodos', 'citemNull', 'todosCount', 'filasTodos']);
    const todos =
      (typeof marca === 'number' ? marca > 0 : verdadero(marca)) ||
      todosAparte.some((t) => texto(t.centidad).toUpperCase() === centidad && (texto(t.itipouso).toUpperCase() || 'A') === itipouso);
    return { centidad, itipouso, cantidad: numeroONull(primero(g, ['cantidad', 'total', 'filas', 'count', 'n', 'qfilas'])) ?? 0, todos };
  });
  return grupos.sort((a, b) => a.centidad.localeCompare(b.centidad) || a.itipouso.localeCompare(b.itipouso));
}

/** Texto pegado («101, 102 103\n104») → códigos sin repetir. */
export function partirCodigos(txt: string): string[] {
  return [...new Set(String(txt ?? '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))];
}

export interface AltaQuienVendeForm {
  centidad: string;
  itipouso: string;
  todos: boolean;
  codigos: string;
}

export function validarAltaQuienVende(f: AltaQuienVendeForm): Partial<Record<'centidad' | 'itipouso' | 'codigos', string>> {
  const e: Partial<Record<'centidad' | 'itipouso' | 'codigos', string>> = {};
  if (!entidadEditable(f.centidad)) e.centidad = 'Elige productor, canal o gestor.';
  if (!['A', 'E'].includes(texto(f.itipouso).toUpperCase())) e.itipouso = 'Elige si se incluye o se excluye.';
  if (!f.todos) {
    const cods = partirCodigos(f.codigos);
    if (!cods.length) e.codigos = 'Escribe al menos un código (o marca «Todos»).';
    else if (cods.some((c) => c.length > 50)) e.codigos = 'Cada código admite hasta 50 caracteres.';
    else if (cods.length > 5000) e.codigos = 'Máximo 5000 códigos por vez.';
  }
  if (f.todos && texto(f.itipouso).toUpperCase() === 'E') e.itipouso = '«Todos» solo se usa para incluir; para excluir indica los códigos.';
  return e;
}

/** Cuerpo de alta o baja: items null = todos los de esa entidad. */
export function cuerpoQuienVende(f: AltaQuienVendeForm) {
  return {
    centidad: texto(f.centidad).toUpperCase() as EntidadVenta,
    itipouso: (texto(f.itipouso).toUpperCase() === 'E' ? 'E' : 'A') as 'A' | 'E',
    items: f.todos ? null : partirCodigos(f.codigos),
  };
}

/** Al menos una fila que incluye (regla de la revisión). */
export const hayQuienVende = (resumen: GrupoResumen[]) => resumen.some((g) => g.itipouso === 'A' && (g.cantidad > 0 || g.todos));

/** Query de la lista paginada. */
export function consultaQuienVende(p: { centidad?: string; itipouso?: string; q?: string; limit?: number; offset?: number }): string {
  const qs = new URLSearchParams();
  if (texto(p.centidad)) qs.set('centidad', texto(p.centidad).toUpperCase());
  if (texto(p.itipouso)) qs.set('itipouso', texto(p.itipouso).toUpperCase());
  if (texto(p.q)) qs.set('q', texto(p.q));
  if (p.limit) qs.set('limit', String(p.limit));
  if (p.offset) qs.set('offset', String(p.offset));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ── Producto (maproductos) ────────────────────────────────────────────────────

export interface ProductoForm {
  cproducto: string;
  cramo: string;
  xdescripcion_l: string;
  xdescripcion_c: string;
  xabreviatura: string;
  iproductor: boolean;
  icanal: boolean;
  igestor: boolean;
  xform: string;
  xdescripcion_prod: string;
  mmonto_inicial: string;
  norden: string;
  xfraccionamiento: string;
  xurl_presentacion: string;
}

export const PRODUCTO_VACIO: ProductoForm = {
  cproducto: '',
  cramo: '',
  xdescripcion_l: '',
  xdescripcion_c: '',
  xabreviatura: '',
  iproductor: true,
  icanal: false,
  igestor: false,
  xform: '',
  xdescripcion_prod: '',
  mmonto_inicial: '',
  norden: '',
  xfraccionamiento: '',
  xurl_presentacion: '',
};

const boolDe = (v: unknown, defecto = false) => (v == null || v === '' ? defecto : verdadero(v));

export function productoDeFila(r: Obj | null | undefined): ProductoForm {
  if (!r) return { ...PRODUCTO_VACIO };
  const t = (v: unknown) => texto(v);
  const n = (v: unknown) => (numeroONull(v) == null ? '' : String(numeroONull(v)));
  return {
    cproducto: t(r.cproducto),
    cramo: n(r.cramo),
    xdescripcion_l: t(r.xdescripcion_l ?? r.xproducto),
    xdescripcion_c: t(r.xdescripcion_c),
    xabreviatura: t(r.xabreviatura),
    iproductor: boolDe(r.iproductor),
    icanal: boolDe(r.icanal),
    igestor: boolDe(r.igestor),
    xform: t(r.xform),
    xdescripcion_prod: t(r.xdescripcion_prod),
    mmonto_inicial: n(r.mmonto_inicial),
    norden: n(r.norden),
    xfraccionamiento: t(r.xfraccionamiento),
    xurl_presentacion: t(r.xurl_presentacion),
  };
}

export function validarProducto(f: ProductoForm, nuevo: boolean): Partial<Record<keyof ProductoForm, string>> {
  const e: Partial<Record<keyof ProductoForm, string>> = {};
  if (nuevo) {
    if (vacio(f.cproducto)) e.cproducto = 'Escribe el código del producto.';
    else if (/\s/.test(f.cproducto.trim())) e.cproducto = 'El código no puede tener espacios.';
    else if (f.cproducto.trim().length > 20) e.cproducto = 'El código admite hasta 20 caracteres.';
  }
  if (!(Number(f.cramo) > 0)) e.cramo = 'Elige el ramo.';
  if (vacio(f.xdescripcion_l)) e.xdescripcion_l = 'Escribe el nombre del producto.';
  if (!vacio(f.mmonto_inicial) && !(aNumero(f.mmonto_inicial)! >= 0)) e.mmonto_inicial = 'El monto inicial es un número de 0 o más.';
  if (!vacio(f.norden) && !/^\d+$/.test(texto(f.norden))) e.norden = 'El orden es un número entero.';
  if (!vacio(f.xurl_presentacion) && !/^https?:\/\//i.test(texto(f.xurl_presentacion))) e.xurl_presentacion = 'La dirección debe empezar por http:// o https://';
  if (!f.iproductor && !f.icanal && !f.igestor) e.iproductor = 'Marca al menos quién lo ve: productor, canal o gestor.';
  return e;
}

/** Avisos que no impiden guardar (código largo para usarlo en planes). */
export function avisosProducto(f: ProductoForm, nuevo: boolean): string[] {
  const out: string[] = [];
  if (nuevo && f.cproducto.trim().length > 6) {
    out.push('El código tiene más de 6 caracteres: los planes guardan el producto en 6, así que no podrás usarlo en planes.');
  }
  return out;
}

/**
 * Cuerpo del PATCH (sin cproducto; cramo identifica la fila) o del POST (con cproducto). Al editar, un campo opcional
 * vacío va como null (nest-api vacía el campo); al crear, simplemente no se manda.
 */
export function cuerpoProducto(f: ProductoForm, nuevo: boolean): Obj {
  const opcional = (v: string) => (texto(v) ? texto(v) : nuevo ? undefined : null);
  const out: Obj = {
    cramo: Number(f.cramo),
    xdescripcion_l: texto(f.xdescripcion_l),
    xdescripcion_c: opcional(f.xdescripcion_c),
    xabreviatura: opcional(f.xabreviatura),
    iproductor: f.iproductor,
    icanal: f.icanal,
    igestor: f.igestor,
    xform: opcional(f.xform),
    xdescripcion_prod: opcional(f.xdescripcion_prod),
    xfraccionamiento: opcional(f.xfraccionamiento),
    xurl_presentacion: opcional(f.xurl_presentacion),
    mmonto_inicial: vacio(f.mmonto_inicial) ? (nuevo ? undefined : null) : aNumero(f.mmonto_inicial),
    norden: vacio(f.norden) ? (nuevo ? undefined : null) : Number(f.norden),
  };
  if (nuevo) out.cproducto = texto(f.cproducto).toUpperCase();
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

// ── Plan: cabecera ────────────────────────────────────────────────────────────

export interface CabeceraForm {
  xplan: string;
  cmoneda: string;
  cproducto: string;
  iestado: string;
}

export function cabeceraDePlan(plan: Obj | null | undefined): CabeceraForm {
  return {
    xplan: texto(plan?.xplan),
    cmoneda: texto(plan?.cmoneda),
    cproducto: texto(plan?.cproducto),
    iestado: texto(plan?.iestado).toUpperCase() === 'I' ? 'I' : 'V',
  };
}

export function validarCabecera(f: CabeceraForm, monedas: string[] = []): Partial<Record<keyof CabeceraForm, string>> {
  const e: Partial<Record<keyof CabeceraForm, string>> = {};
  if (vacio(f.xplan)) e.xplan = 'Escribe el nombre del plan.';
  else if (f.xplan.trim().length > 60) e.xplan = 'El nombre admite hasta 60 caracteres.';
  if (vacio(f.cmoneda)) e.cmoneda = 'Elige la moneda.';
  else if (monedas.length && !monedas.map((m) => m.toUpperCase()).includes(f.cmoneda.trim().toUpperCase())) e.cmoneda = 'Esa moneda no está en Sis2000.';
  if (vacio(f.cproducto)) e.cproducto = 'Elige el producto.';
  else if (f.cproducto.trim().length > 6) e.cproducto = 'El plan guarda el producto en 6 caracteres: elige un producto con código más corto.';
  if (!['V', 'I'].includes(f.iestado)) e.iestado = 'El estado es activo o inactivo.';
  return e;
}

/** Solo lo que cambió (PATCH). {} = nada que guardar. */
export function cambiosCabecera(antes: CabeceraForm, despues: CabeceraForm): Obj {
  const out: Obj = {};
  for (const k of ['xplan', 'cmoneda', 'cproducto', 'iestado'] as const) {
    if (texto(antes[k]) !== texto(despues[k])) out[k] = k === 'cproducto' || k === 'cmoneda' ? texto(despues[k]).toUpperCase() : texto(despues[k]);
  }
  return out;
}

// ── Coberturas del plan (cosas y auto: maplancob + maplantar) ─────────────────

export interface CoberturaPlanFila {
  ccobertura: string;
  ctarifa: string;
  msumamin: number | null;
  msumamax: number | null;
  mprima: number | null;
  pprima: number | null;
  bobligatoria: boolean;
  iestado: string;
}

export function normalizarCoberturaPlan(r: Obj): CoberturaPlanFila {
  return {
    ccobertura: texto(r.ccobertura ?? r.ccober),
    ctarifa: texto(r.ctarifa),
    msumamin: numeroONull(r.msumamin),
    msumamax: numeroONull(r.msumamax),
    mprima: numeroONull(r.mprima),
    pprima: numeroONull(r.pprima),
    bobligatoria: verdadero(r.bobligatoria),
    iestado: texto(r.iestado).toUpperCase() || 'V',
  };
}

export type ModoPrecio = 'prima' | 'tasa';

export interface CoberturaPlanForm {
  ccobertura: string;
  ctarifa: string;
  msumamin: string;
  msumamax: string;
  modo: ModoPrecio;
  valor: string;
  bobligatoria: boolean;
}

export function formDeCoberturaPlan(c: CoberturaPlanFila): CoberturaPlanForm {
  const tasa = c.pprima != null && c.pprima > 0 && !(c.mprima != null && c.mprima > 0);
  const s = (n: number | null) => (n == null ? '' : String(n));
  return {
    ccobertura: c.ccobertura,
    ctarifa: c.ctarifa,
    msumamin: s(c.msumamin),
    msumamax: s(c.msumamax),
    modo: tasa ? 'tasa' : 'prima',
    valor: tasa ? s(c.pprima) : s(c.mprima),
    bobligatoria: c.bobligatoria,
  };
}

/** Suma mínima ≤ máxima, montos ≥ 0 y prima o tasa (excluyentes; la tasa es % de 0 a 100). */
export function validarCoberturaPlan(f: CoberturaPlanForm, nueva: boolean): Partial<Record<keyof CoberturaPlanForm, string>> {
  const e: Partial<Record<keyof CoberturaPlanForm, string>> = {};
  if (nueva && vacio(f.ccobertura)) e.ccobertura = 'Elige la cobertura.';
  if (nueva && vacio(f.ctarifa)) e.ctarifa = 'Elige la tarifa.';
  const min = aNumero(f.msumamin);
  const max = aNumero(f.msumamax);
  if (!vacio(f.msumamin) && (min === undefined || min < 0)) e.msumamin = 'La suma mínima es un número de 0 o más.';
  if (vacio(f.msumamax)) e.msumamax = 'Escribe la suma asegurada máxima.';
  else if (max === undefined || max < 0) e.msumamax = 'La suma máxima es un número de 0 o más.';
  if (!e.msumamin && !e.msumamax && min !== undefined && max !== undefined && min > max) e.msumamin = 'La suma mínima no puede ser mayor que la máxima.';
  const v = aNumero(f.valor);
  if (vacio(f.valor)) e.valor = f.modo === 'tasa' ? 'Escribe la tasa (%).' : 'Escribe la prima.';
  else if (v === undefined || v < 0) e.valor = 'Debe ser un número de 0 o más.';
  else if (f.modo === 'tasa' && v > 100) e.valor = 'La tasa es un porcentaje: entre 0 y 100.';
  return e;
}

/** Cuerpo del alta (con cobertura y tarifa) o del PATCH de la tarifa del plan. Prima y tasa nunca van juntas. */
export function cuerpoCoberturaPlan(f: CoberturaPlanForm, nueva: boolean): Obj {
  const out: Obj = {};
  if (nueva) {
    out.ccobertura = texto(f.ccobertura);
    out.ctarifa = texto(f.ctarifa);
    out.bobligatoria = f.bobligatoria;
  }
  out.msumamin = aNumero(f.msumamin) ?? 0;
  out.msumamax = aNumero(f.msumamax) ?? 0;
  if (f.modo === 'tasa') out.pprima = aNumero(f.valor) ?? 0;
  else out.mprima = aNumero(f.valor) ?? 0;
  return out;
}

/** Dar de baja esta cobertura deja el plan sin obligatorias (nest-api responde 409; se avisa antes). */
export function esUltimaObligatoria(filas: CoberturaPlanFila[], ccobertura: string): boolean {
  const vigentes = filas.filter((f) => f.iestado === 'V' && f.bobligatoria);
  return vigentes.length > 0 && vigentes.every((f) => f.ccobertura.toUpperCase() === ccobertura.toUpperCase());
}

// ── Coberturas del plan de personas (maplcober_per + mapltarifas_per) ─────────

export interface ParentescoTabla {
  cparen: string;
  ctablatar: string;
}

export interface CoberturaPersonasForm {
  ccobertura: string;
  ctarifa: string;
  parentescos: ParentescoTabla[];
}

export function validarCoberturaPersonas(f: CoberturaPersonasForm, nueva: boolean): { campos: Partial<Record<'ccobertura' | 'ctarifa' | 'parentescos', string>>; filas: Array<Partial<Record<keyof ParentescoTabla, string>>> } {
  const campos: Partial<Record<'ccobertura' | 'ctarifa' | 'parentescos', string>> = {};
  if (nueva && vacio(f.ccobertura)) campos.ccobertura = 'Elige la cobertura.';
  if (nueva && vacio(f.ctarifa)) campos.ctarifa = 'Elige la tarifa.';
  if (!f.parentescos.length) campos.parentescos = 'Agrega al menos un parentesco con su tabla de tasas.';
  const vistos = new Set<string>();
  const filas = f.parentescos.map((p) => {
    const e: Partial<Record<keyof ParentescoTabla, string>> = {};
    if (!/^\d+$/.test(texto(p.cparen))) e.cparen = 'Elige el parentesco.';
    else if (vistos.has(texto(p.cparen))) e.cparen = 'Ese parentesco está repetido.';
    vistos.add(texto(p.cparen));
    if (vacio(p.ctablatar)) e.ctablatar = 'Elige la tabla de tasas por edad.';
    return e;
  });
  return { campos, filas };
}

export function cuerpoCoberturaPersonas(f: CoberturaPersonasForm, nueva: boolean): Obj {
  const parentescos = f.parentescos.map((p) => ({ cparen: Number(p.cparen), ctablatar: texto(p.ctablatar).toUpperCase() }));
  return nueva ? { ccobertura: texto(f.ccobertura), ctarifa: texto(f.ctarifa), parentescos } : { parentescos };
}

// ── Edades por parentesco (mapledades_per) ────────────────────────────────────

export interface EdadParentesco {
  cparen: string;
  cemin_ase: string;
  cemax_ase: string;
  cemin_gi: string;
  cemax_gi: string;
  msvitalicia: string;
  cereduccion: string;
  msreducida: string;
}

export const CAMPOS_EDAD: Array<keyof EdadParentesco> = ['cparen', 'cemin_ase', 'cemax_ase', 'cemin_gi', 'cemax_gi', 'msvitalicia', 'cereduccion', 'msreducida'];

export function normalizarEdad(r: Obj): EdadParentesco {
  const n = (v: unknown) => (numeroONull(v) == null ? '' : String(numeroONull(v)));
  return {
    cparen: n(r.cparen),
    cemin_ase: n(r.cemin_ase),
    cemax_ase: n(r.cemax_ase),
    cemin_gi: n(r.cemin_gi),
    cemax_gi: n(r.cemax_gi),
    msvitalicia: n(r.msvitalicia),
    cereduccion: n(r.cereduccion),
    msreducida: n(r.msreducida),
  };
}

const edadOk = (v: string) => /^\d+$/.test(texto(v)) && Number(v) <= 120;

export function validarEdad(f: EdadParentesco): Partial<Record<keyof EdadParentesco, string>> {
  const e: Partial<Record<keyof EdadParentesco, string>> = {};
  if (!/^\d+$/.test(texto(f.cparen))) e.cparen = 'Elige el parentesco.';
  for (const k of ['cemin_ase', 'cemax_ase'] as const) {
    if (vacio(f[k])) e[k] = 'Obligatorio.';
    else if (!edadOk(f[k])) e[k] = 'Edad entera entre 0 y 120.';
  }
  for (const k of ['cemin_gi', 'cemax_gi', 'cereduccion'] as const) {
    if (!vacio(f[k]) && !edadOk(f[k])) e[k] = 'Edad entera entre 0 y 120.';
  }
  if (!e.cemin_ase && !e.cemax_ase && Number(f.cemin_ase) > Number(f.cemax_ase)) e.cemax_ase = 'La edad máxima no puede ser menor que la mínima.';
  if (!vacio(f.cemin_gi) && !vacio(f.cemax_gi) && !e.cemin_gi && !e.cemax_gi && Number(f.cemin_gi) > Number(f.cemax_gi)) {
    e.cemax_gi = 'La edad máxima de grupo no puede ser menor que la mínima.';
  }
  for (const k of ['msvitalicia', 'msreducida'] as const) {
    if (!vacio(f[k]) && !(aNumero(f[k])! >= 0)) e[k] = 'Monto de 0 o más.';
  }
  return e;
}

export function cuerpoEdad(f: EdadParentesco): Obj {
  const out: Obj = { cemin_ase: Number(f.cemin_ase), cemax_ase: Number(f.cemax_ase) };
  for (const k of ['cemin_gi', 'cemax_gi', 'cereduccion'] as const) if (!vacio(f[k])) out[k] = Number(f[k]);
  for (const k of ['msvitalicia', 'msreducida'] as const) if (!vacio(f[k])) out[k] = aNumero(f[k]);
  return out;
}

/**
 * Aviso si los tramos de las tablas de edad del plan no cubren [min, max] (no impide guardar). `tramos` son los
 * tramos de la tabla (edad desde / hasta).
 */
export function avisoCoberturaEdades(min: number, max: number, tramos: Array<{ desde: number; hasta: number }>, tabla = ''): string | null {
  if (!tramos.length || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  const orden = [...tramos].sort((a, b) => a.desde - b.desde);
  let cubierto = min;
  for (const t of orden) {
    if (t.desde > cubierto) break;
    cubierto = Math.max(cubierto, t.hasta + 1);
    if (cubierto > max) return null;
  }
  const t = tabla ? ` ${tabla}` : '';
  return `La tabla de tasas${t} no cubre todas las edades de ${min} a ${max} años: falta desde ${cubierto}. Quien tenga esa edad no podrá cotizar.`;
}

/** Parentescos usados en las tarifas del plan que no tienen fila de edades (regla de la revisión). */
export function parentescosSinEdad(enTarifas: string[], edades: EdadParentesco[]): string[] {
  const con = new Set(edades.map((e) => texto(e.cparen)));
  return [...new Set(enTarifas.map(texto).filter(Boolean))].filter((c) => !con.has(c));
}

// ── Descuentos y recargos del ramo (madisseg, masustac) ───────────────────────

export interface DescuentoRecargo {
  codigo: string;
  nombre: string;
  porcentaje: string;
}

export type TipoDescRec = 'dispositivos' | 'sustancias';

export const CAMPOS_DESC_REC: Record<TipoDescRec, { codigo: string; nombre: string; porcentaje: string }> = {
  dispositivos: { codigo: 'cdisseg', nombre: 'xdisseg', porcentaje: 'pdisseg' },
  sustancias: { codigo: 'csustanc', nombre: 'xsustanc', porcentaje: 'porcenta' },
};

export function normalizarDescRec(tipo: TipoDescRec, r: Obj): DescuentoRecargo {
  const c = CAMPOS_DESC_REC[tipo];
  const p = numeroONull(r[c.porcentaje]);
  return { codigo: texto(r[c.codigo]), nombre: texto(r[c.nombre]), porcentaje: p == null ? '' : String(p) };
}

export function validarDescRec(f: DescuentoRecargo, nuevo: boolean, existentes: DescuentoRecargo[] = []): Partial<Record<keyof DescuentoRecargo, string>> {
  const e: Partial<Record<keyof DescuentoRecargo, string>> = {};
  // El código es opcional al agregar: vacío = Sis2000 usa el siguiente libre.
  if (nuevo && !vacio(f.codigo)) {
    if (!/^\d+$/.test(texto(f.codigo)) || Number(f.codigo) <= 0 || Number(f.codigo) > 32767) e.codigo = 'El código es un número entero entre 1 y 32767 (o déjalo vacío).';
    else if (existentes.some((x) => texto(x.codigo) === texto(f.codigo))) e.codigo = 'Ese código ya existe en el ramo: edítalo en la tabla.';
  }
  if (vacio(f.nombre)) e.nombre = 'Escribe la descripción.';
  const p = aNumero(f.porcentaje);
  if (vacio(f.porcentaje)) e.porcentaje = 'Escribe el porcentaje (0 lo deja sin efecto).';
  else if (p === undefined || p < 0 || p > 100) e.porcentaje = 'El porcentaje va de 0 a 100.';
  return e;
}

export function cuerpoDescRec(tipo: TipoDescRec, f: DescuentoRecargo, nuevo: boolean): Obj {
  const c = CAMPOS_DESC_REC[tipo];
  const out: Obj = { [c.nombre]: texto(f.nombre), [c.porcentaje]: aNumero(f.porcentaje) ?? 0 };
  if (nuevo && !vacio(f.codigo)) out[c.codigo] = Number(f.codigo);
  return out;
}

// ── Condominio (MATARIFA_*_NEXUS, por ramo) ───────────────────────────────────

export type TablaCondominio = 'antiguedad' | 'reparto' | 'rango';

export const COLUMNAS_CONDOMINIO: Record<TablaCondominio, Array<{ clave: string; titulo: string; tipo: 'texto' | 'numero' | 'entero'; ayuda: string }>> = {
  antiguedad: [
    { clave: 'iuso', titulo: 'Uso', tipo: 'texto', ayuda: 'Uso del inmueble: C o R. Cada uso lleva su propia tasa en cada tramo de antigüedad.\nEn Sis2000: MATARIFA_ANTIGUEDAD_NEXUS.iuso' },
    { clave: 'itramo', titulo: 'Tramo', tipo: 'entero', ayuda: 'Tramo según el año de construcción: 1 = 1967 o antes, 2 = 1968–1993, 3 = 1994–2018, 4 = 2019 en adelante.\nEn Sis2000: MATARIFA_ANTIGUEDAD_NEXUS.itramo' },
    { clave: 'pprima', titulo: 'Tasa %', tipo: 'numero', ayuda: 'Tasa global (% sobre la suma asegurada) para ese uso y tramo. Luego se reparte entre las coberturas según la tabla de reparto.\nEn Sis2000: MATARIFA_ANTIGUEDAD_NEXUS.pprima' },
  ],
  reparto: [
    { clave: 'ccober', titulo: 'Cobertura', tipo: 'texto', ayuda: 'Código de la cobertura del ramo que recibe una parte de la tasa global.\nEn Sis2000: MATARIFA_REPARTO_NEXUS.ccober' },
    { clave: 'ctarifa', titulo: 'Tarifa', tipo: 'texto', ayuda: 'Tarifa de esa cobertura; debe tener una tasa vigente.\nEn Sis2000: MATARIFA_REPARTO_NEXUS.ctarifa' },
    { clave: 'itipo', titulo: 'Tipo', tipo: 'texto', ayuda: 'Cómo cobra la cobertura: P = % de la tasa global (todas las P deben sumar 100); F = parte fija de la tasa; M = monto fijo.\nEn Sis2000: MATARIFA_REPARTO_NEXUS.itipo' },
    { clave: 'pvalor', titulo: 'Valor', tipo: 'numero', ayuda: 'Con P, el % de la tasa global; con F, la tasa fija (debe ser menor que la tasa global más baja); con M, el monto. Ejemplo: P con 15 = 15 % de la tasa.\nEn Sis2000: MATARIFA_REPARTO_NEXUS.pvalor' },
    { clave: 'plimite', titulo: 'Límite %', tipo: 'numero', ayuda: 'Opcional. Suma de la cobertura como % de la suma asegurada de la póliza. Ejemplo: 30 = la cobertura asegura el 30 % de la suma.\nEn Sis2000: MATARIFA_REPARTO_NEXUS.plimite' },
  ],
  rango: [
    { clave: 'ccober', titulo: 'Cobertura', tipo: 'texto', ayuda: 'Código de la cobertura cuya tasa se puede mover dentro de un rango.\nEn Sis2000: MATARIFA_RANGO_NEXUS.ccober' },
    { clave: 'ctarifa', titulo: 'Tarifa', tipo: 'texto', ayuda: 'Tarifa de esa cobertura.\nEn Sis2000: MATARIFA_RANGO_NEXUS.ctarifa' },
    { clave: 'ptasa_min', titulo: 'Tasa mínima %', tipo: 'numero', ayuda: 'Tasa más baja (%) que se acepta al cotizar esta cobertura; si la cotización trae una tasa menor, se rechaza. Debe ser menor que la máxima.\nEn Sis2000: MATARIFA_RANGO_NEXUS.ptasa_min' },
    { clave: 'ptasa_max', titulo: 'Tasa máxima %', tipo: 'numero', ayuda: 'Tasa más alta (%) que se acepta al cotizar esta cobertura; máximo 100.\nEn Sis2000: MATARIFA_RANGO_NEXUS.ptasa_max' },
  ],
};

export function filasCondominioATexto(tabla: TablaCondominio, filas: Obj[]): Record<string, string>[] {
  return filas.map((r) => Object.fromEntries(COLUMNAS_CONDOMINIO[tabla].map((c) => [c.clave, texto(r[c.clave] ?? r[c.clave.toUpperCase()])])));
}

/** Errores por fila + error de la tabla (el reparto con itipo P debe sumar 100). */
export function validarCondominio(tabla: TablaCondominio, filas: Record<string, string>[]): { filas: Array<Record<string, string>>; tabla: string | null } {
  const errores = filas.map((f) => {
    const e: Record<string, string> = {};
    for (const c of COLUMNAS_CONDOMINIO[tabla]) {
      const v = f[c.clave] ?? '';
      const opcional = c.clave === 'plimite';
      if (vacio(v)) {
        if (!opcional) e[c.clave] = 'Obligatorio.';
        continue;
      }
      if (c.tipo === 'entero' && !/^\d+$/.test(texto(v))) e[c.clave] = 'Número entero.';
      if (c.tipo === 'numero' && (aNumero(v) === undefined || aNumero(v)! < 0)) e[c.clave] = 'Número de 0 o más.';
      if (c.tipo === 'texto' && texto(v).length > 4) e[c.clave] = 'Hasta 4 caracteres.';
    }
    if (tabla === 'rango' && !e.ptasa_min && !e.ptasa_max && aNumero(f.ptasa_min)! > aNumero(f.ptasa_max)!) e.ptasa_max = 'La máxima no puede ser menor que la mínima.';
    if (tabla === 'reparto' && !e.itipo && texto(f.itipo).length !== 1) e.itipo = 'Una letra.';
    return e;
  });
  let error: string | null = null;
  if (tabla === 'reparto') {
    const p = filas.filter((f) => texto(f.itipo).toUpperCase() === 'P');
    const suma = p.reduce((s, f) => s + (aNumero(f.pvalor) ?? 0), 0);
    if (p.length && Math.abs(suma - 100) > 0.0001) error = `Los repartos de tipo P deben sumar 100; hoy suman ${Math.round(suma * 10000) / 10000}.`;
  }
  return { filas: errores, tabla: error };
}

export function cuerpoCondominio(tabla: TablaCondominio, filas: Record<string, string>[]): { filas: Obj[] } {
  return {
    filas: filas.map((f) =>
      Object.fromEntries(
        COLUMNAS_CONDOMINIO[tabla]
          .filter((c) => !(c.clave === 'plimite' && vacio(f[c.clave])))
          .map((c) => [c.clave, c.tipo === 'texto' ? texto(f[c.clave]).toUpperCase() : Number(texto(f[c.clave]).replace(',', '.'))]),
      ),
    ),
  };
}

// ── Tarifa por días (maplantar_dias, Binacional) ──────────────────────────────

export const COLUMNAS_TARIFA_DIAS = ['ctarifabi', 'qdias', 'bnacional', 'cmoneda', 'ndias_min', 'ndias_max', 'msuma', 'mprima', 'mprima_anual', 'mprima_dia'] as const;
export type FilaTarifaDias = Record<(typeof COLUMNAS_TARIFA_DIAS)[number], string>;

export function normalizarTarifaDias(r: Obj): FilaTarifaDias & { ccober: string; ctarifa: string; iestado: string } {
  const out = Object.fromEntries(COLUMNAS_TARIFA_DIAS.map((k) => [k, texto(r[k])])) as FilaTarifaDias;
  out.bnacional = r.bnacional == null || r.bnacional === '' ? '' : verdadero(r.bnacional) ? '1' : '0';
  return { ...out, ccober: texto(r.ccober ?? r.ccobertura), ctarifa: texto(r.ctarifa), iestado: texto(r.iestado).toUpperCase() || 'V' };
}

/**
 * Rangos de días por (ctarifabi, bnacional) sin solaparse (un borde compartido, 0–3 y 3–7, es válido); `qdias` es el
 * número de tramo. Fila anual (días máx. 30 con prima anual) obligatoria si el plan es BINAC*.
 */
export function validarTarifaDias(filas: FilaTarifaDias[], cplan = ''): { filas: Array<Record<string, string>>; tabla: string[] } {
  const errores = filas.map((f) => {
    const e: Record<string, string> = {};
    if (!/^\d+$/.test(texto(f.ctarifabi))) e.ctarifabi = 'Número entero.';
    if (!/^\d+$/.test(texto(f.qdias))) e.qdias = 'Número entero.';
    if (!['0', '1'].includes(texto(f.bnacional))) e.bnacional = 'Elige nacional o internacional.';
    for (const k of ['ndias_min', 'ndias_max'] as const) if (!/^\d+$/.test(texto(f[k]))) e[k] = 'Días enteros.';
    if (!e.ndias_min && !e.ndias_max && Number(f.ndias_min) > Number(f.ndias_max)) e.ndias_max = 'No puede ser menor que el mínimo.';
    for (const k of ['msuma', 'mprima', 'mprima_anual', 'mprima_dia'] as const) {
      if (!vacio(f[k]) && !(aNumero(f[k])! >= 0)) e[k] = 'Monto de 0 o más.';
    }
    if (texto(f.cmoneda).length > 3) e.cmoneda = 'Hasta 3 letras.';
    return e;
  });
  const tabla: string[] = [];
  const grupos = new Map<string, Array<{ i: number; min: number; max: number }>>();
  filas.forEach((f, i) => {
    if (errores[i].ndias_min || errores[i].ndias_max || errores[i].ctarifabi || errores[i].bnacional) return;
    const k = `${texto(f.ctarifabi)}|${texto(f.bnacional)}`;
    grupos.set(k, [...(grupos.get(k) ?? []), { i, min: Number(f.ndias_min), max: Number(f.ndias_max) }]);
  });
  for (const [k, lista] of grupos) {
    const orden = [...lista].sort((a, b) => a.min - b.min);
    for (let j = 1; j < orden.length; j++) {
      if (orden[j].min < orden[j - 1].max) {
        const [ctarifabi, bn] = k.split('|');
        errores[orden[j].i].ndias_min = `Se solapa con la fila ${orden[j - 1].i + 1} (${orden[j - 1].min}–${orden[j - 1].max} días).`;
        tabla.push(`Tarifa ${ctarifabi} ${bn === '1' ? 'nacional' : 'internacional'}: los rangos de días de las filas ${orden[j - 1].i + 1} y ${orden[j].i + 1} se solapan.`);
      }
    }
  }
  if (/^BINAC/i.test(texto(cplan)) && filas.length && !filas.some((f) => texto(f.ndias_max) === '30' && aNumero(f.mprima_anual) !== undefined && aNumero(f.mprima_anual)! > 0)) {
    tabla.push('Los planes Binacional necesitan la fila anual: «Días máx.» 30 con la prima anual.');
  }
  return { filas: errores, tabla };
}

export function cuerpoTarifaDias(filas: FilaTarifaDias[]): { filas: Obj[] } {
  return {
    filas: filas.map((f) => {
      const o: Obj = {
        ctarifabi: Number(f.ctarifabi),
        qdias: Number(f.qdias),
        bnacional: texto(f.bnacional) === '1',
        ndias_min: Number(f.ndias_min),
        ndias_max: Number(f.ndias_max),
      };
      if (texto(f.cmoneda)) o.cmoneda = texto(f.cmoneda).toUpperCase();
      for (const k of ['msuma', 'mprima', 'mprima_anual', 'mprima_dia'] as const) {
        const n = aNumero(f[k]);
        if (n !== undefined) o[k] = n;
      }
      return o;
    }),
  };
}

// ── Tasa de casco por características (versionado de Sis2000: tarifa_casco_versiones + sp_tarifa_casco_*) ──
// No se edita por celdas: una versión nueva se propone por ajuste porcentual o por restauración de una versión
// anterior; publicar = aprobar (doble control: otro usuario de Sis2000). El versionado es global (ramo 18).

export interface VersionCasco {
  id: string;
  numero: string;
  estado: string;
  /** PENDIENTE | RECHAZADA | CANCELADA | PROGRAMADA | VIGENTE | HISTORICA. */
  situacion: string;
  origen: string;
  movimiento: string;
  porcentaje: number | null;
  alcance: string;
  vigenteDesde: string;
  vigenteHasta: string;
  rigeAlAprobar: boolean;
  motivo: string;
  propuestaPor: string;
  propuestaPorId: string;
  revisadaPor: string;
  tasasCambiadas: number | null;
}

export function normalizarVersionCasco(r: Obj | null | undefined): VersionCasco | null {
  if (!r || typeof r !== 'object') return null;
  const id = texto(primero(r, ['id', 'version_id', 'versionId']));
  if (!id) return null;
  const persona = (login: unknown, nombre: unknown, idp: unknown) => texto(nombre) || texto(login) || texto(idp);
  return {
    id,
    numero: texto(primero(r, ['numero', 'version', 'nversion'])),
    estado: texto(primero(r, ['estado', 'status'])).toUpperCase(),
    situacion: texto(r.situacion).toUpperCase() || texto(r.estado).toUpperCase(),
    origen: texto(r.origen).toUpperCase(),
    movimiento: texto(r.movimiento).toUpperCase(),
    porcentaje: numeroONull(r.porcentaje),
    alcance: texto(r.alcance).toUpperCase(),
    vigenteDesde: fechaIso(primero(r, ['vigente_desde', 'vigenteDesde'])),
    vigenteHasta: fechaIso(primero(r, ['vigente_hasta', 'vigenteHasta'])),
    rigeAlAprobar: verdadero(r.rige_al_aprobar),
    motivo: texto(r.motivo),
    propuestaPor: persona(r.propuesta_por_login, r.propuesta_por_nombre, r.propuesta_por ?? r.created_by),
    propuestaPorId: texto(r.propuesta_por ?? r.created_by),
    revisadaPor: persona(r.revisada_por_login, r.revisada_por_nombre, r.revisada_por),
    tasasCambiadas: numeroONull(r.tasas_cambiadas),
  };
}

export interface TasaCasco {
  versionado: boolean;
  requiereAprobacion: boolean | null;
  vigente: VersionCasco | null;
  /** Propuestas PENDIENTE o APROBADA (programada) aún no aplicadas. */
  enCurso: VersionCasco[];
  planes: Obj[];
  rangos: Obj[];
  tasas: Obj[];
  factores: Obj[];
  avisos: string[];
}

export function normalizarTasaCasco(r: unknown): TasaCasco {
  const o = r && typeof r === 'object' && !Array.isArray(r) ? (r as Obj) : {};
  const vigente = normalizarVersionCasco((o.vigente ?? o.version ?? o.versionVigente) as Obj);
  return {
    versionado: o.versionado === undefined ? true : verdadero(o.versionado),
    requiereAprobacion: o.requiereAprobacion == null ? null : verdadero(o.requiereAprobacion),
    vigente,
    enCurso: listaDe(o, ['enCurso', 'borradores', 'pendientes'])
      .map((v) => normalizarVersionCasco(v))
      .filter((v): v is VersionCasco => Boolean(v) && v!.id !== vigente?.id),
    planes: listaDe(o, ['planes', 'macalcasco']),
    rangos: listaDe(o, ['rangos', 'marangosum']),
    tasas: listaDe(o, ['tasas', 'marangoano']),
    factores: listaDe(o, ['factores', 'macobtipo']),
    avisos: (Array.isArray(o.avisos) ? (o.avisos as unknown[]) : []).map(texto).filter(Boolean),
  };
}

export const ALCANCES_CASCO: Record<string, string> = {
  GLOBAL: 'Todas las tasas',
  TIPO_VEHICULO: 'Por tipo de vehículo',
  COBERTURA: 'Por cobertura',
  ANTIGUEDAD: 'Por antigüedad del vehículo',
  SUMA_ASEGURADA: 'Por rango de suma asegurada',
  COMBINADA: 'Rango de suma y antigüedad',
};

export const SITUACION_CASCO: Record<string, string> = {
  PENDIENTE: 'Pendiente de aprobar',
  PROGRAMADA: 'Aprobada, rige más adelante',
  APROBADA: 'Aprobada, rige más adelante',
  VIGENTE: 'Vigente',
  HISTORICA: 'Anterior',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
};

export interface AjusteCascoForm {
  origen: 'AJUSTE' | 'RESTAURACION';
  cusuario: string;
  movimiento: string;
  porcentaje: string;
  alcance: string;
  /** Códigos separados por coma: tipos de vehículo, coberturas o rangos según el alcance. */
  tipos: string;
  coberturas: string;
  rangos: string;
  edadDesde: string;
  edadHasta: string;
  versionId: string;
  rigeAlAprobar: boolean;
  vigenteDesde: string;
  vigenteHasta: string;
  motivo: string;
}

export const AJUSTE_CASCO_VACIO: AjusteCascoForm = {
  origen: 'AJUSTE',
  cusuario: '',
  movimiento: 'INCREMENTO',
  porcentaje: '',
  alcance: 'GLOBAL',
  tipos: '',
  coberturas: '',
  rangos: '',
  edadDesde: '',
  edadHasta: '',
  versionId: '',
  rigeAlAprobar: true,
  vigenteDesde: '',
  vigenteHasta: '',
  motivo: '',
};

const usaTipos = (a: string) => a === 'TIPO_VEHICULO';
const usaCoberturas = (a: string) => a === 'COBERTURA';
const usaRangos = (a: string) => a === 'SUMA_ASEGURADA' || a === 'COMBINADA';
const usaEdad = (a: string) => a === 'ANTIGUEDAD' || a === 'COMBINADA';
export const filtrosQueUsa = (alcance: string) => ({
  tipos: usaTipos(alcance),
  coberturas: usaCoberturas(alcance),
  rangos: usaRangos(alcance),
  edad: usaEdad(alcance),
});

const fechaValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(texto(v));

/** Mismas reglas que sp_tarifa_casco_validar_ajuste / validar_vigencia (para avisar antes de llamar). */
export function validarAjusteCasco(f: AjusteCascoForm): Partial<Record<keyof AjusteCascoForm, string>> {
  const e: Partial<Record<keyof AjusteCascoForm, string>> = {};
  if (!/^\d+$/.test(texto(f.cusuario)) || Number(f.cusuario) < 1) e.cusuario = 'Tu usuario de Sis2000 (número) con permiso para proponer.';
  if (texto(f.motivo).length < 10) e.motivo = 'Explica el motivo (mínimo 10 caracteres).';
  if (!f.rigeAlAprobar && !fechaValida(f.vigenteDesde)) e.vigenteDesde = 'Indica desde cuándo rige (o marca «rige al aprobarse»).';
  if (!vacio(f.vigenteHasta)) {
    if (!fechaValida(f.vigenteHasta)) e.vigenteHasta = 'Fecha AAAA-MM-DD.';
    else if (!f.rigeAlAprobar && fechaValida(f.vigenteDesde) && f.vigenteHasta < f.vigenteDesde) e.vigenteHasta = 'No puede ser anterior al inicio.';
  }
  if (f.origen === 'RESTAURACION') {
    if (!/^\d+$/.test(texto(f.versionId))) e.versionId = 'Elige la versión que quieres volver a aplicar.';
    return e;
  }
  if (!['INCREMENTO', 'DISMINUCION'].includes(f.movimiento)) e.movimiento = 'Elige subir o bajar.';
  const p = aNumero(f.porcentaje);
  if (p === undefined || p <= 0 || p > 100) e.porcentaje = 'Porcentaje mayor que 0 y hasta 100.';
  else if (f.movimiento === 'DISMINUCION' && p >= 100) e.porcentaje = 'Una disminución debe ser menor que 100: la tasa no puede quedar en cero.';
  else if (!/^\d+([.,]\d{1,2})?$/.test(texto(f.porcentaje))) e.porcentaje = 'Hasta 2 decimales.';
  if (!ALCANCES_CASCO[f.alcance]) e.alcance = 'Elige a qué tasas aplica.';
  if (usaTipos(f.alcance)) {
    const t = partirCodigos(f.tipos);
    if (!t.length) e.tipos = 'Elige al menos un tipo de vehículo.';
    else if (t.some((x) => !/^\d+$/.test(x) || Number(x) < 1)) e.tipos = 'Los tipos son números mayores que 0.';
  }
  if (usaCoberturas(f.alcance)) {
    const c = partirCodigos(f.coberturas);
    if (!c.length) e.coberturas = 'Elige al menos una cobertura.';
    else if (c.some((x) => x.length > 4 || x.toUpperCase() === 'N')) e.coberturas = 'Las coberturas no son válidas (hasta 4 caracteres).';
  }
  if (usaRangos(f.alcance)) {
    const r = partirCodigos(f.rangos);
    if (!r.length) e.rangos = 'Elige al menos un rango de suma asegurada.';
    else if (r.some((x) => !/^\d+$/.test(x) || Number(x) > 255)) e.rangos = 'Los rangos son números de 0 a 255.';
  }
  if (usaEdad(f.alcance)) {
    const d = texto(f.edadDesde);
    const h = texto(f.edadHasta);
    if (!/^-?\d+$/.test(d) || !/^-?\d+$/.test(h) || Number(d) < -1 || Number(h) > 20 || Number(d) > Number(h)) {
      e.edadDesde = 'Antigüedad entre -1 y 20 años, y «desde» no mayor que «hasta».';
    }
  }
  return e;
}

/** Filtros con los nombres que lee el SP (solo los del alcance). */
export function filtrosAjusteCasco(f: AjusteCascoForm): Obj | undefined {
  const out: Obj = {};
  if (usaTipos(f.alcance)) out.vehicleTypes = partirCodigos(f.tipos).map(Number);
  if (usaCoberturas(f.alcance)) out.coverages = partirCodigos(f.coberturas).map((c) => c.toUpperCase());
  if (usaRangos(f.alcance)) out.ranges = partirCodigos(f.rangos).map(Number);
  if (usaEdad(f.alcance)) {
    out.ageFrom = Number(f.edadDesde);
    out.ageTo = Number(f.edadHasta);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Cuerpo de la vista previa (no escribe). */
export function cuerpoVistaPreviaCasco(f: AjusteCascoForm): Obj {
  const out: Obj = { movimiento: f.movimiento, porcentaje: aNumero(f.porcentaje), alcance: f.alcance };
  const filtros = filtrosAjusteCasco(f);
  if (filtros) out.filtros = filtros;
  return out;
}

/** Cuerpo de POST versiones (propuesta por ajuste o por restauración). */
export function cuerpoVersionCasco(f: AjusteCascoForm): Obj {
  const out: Obj = { origen: f.origen, cusuario: Number(f.cusuario), motivo: texto(f.motivo), rige_al_aprobar: f.rigeAlAprobar };
  if (!f.rigeAlAprobar && fechaValida(f.vigenteDesde)) out.vigente_desde = texto(f.vigenteDesde);
  if (fechaValida(f.vigenteHasta)) out.vigente_hasta = texto(f.vigenteHasta);
  if (f.origen === 'RESTAURACION') {
    out.version_id = Number(f.versionId);
    return out;
  }
  return { ...out, ...cuerpoVistaPreviaCasco(f) };
}

/** Aprobar exige otro usuario de Sis2000 distinto del que propuso (doble control). */
export function errorAprobarCasco(v: VersionCasco, cusuario: string): string | null {
  if (!/^\d+$/.test(texto(cusuario)) || Number(cusuario) < 1) return 'Indica tu usuario de Sis2000 (número) con permiso para aprobar.';
  if (v.propuestaPorId && texto(v.propuestaPorId) === texto(cusuario)) return 'Quien propuso la versión no puede aprobarla: debe aprobarla otra persona.';
  return null;
}

/** 501 = la operación no existe todavía en Sis2000 (p. ej. publicar sin el SP). */
export function esNoImplementado(e: unknown): boolean {
  return Boolean(e && typeof e === 'object' && (e as { status?: number }).status === 501);
}

// ── Utilidades de paneles ─────────────────────────────────────────────────────

/** ¿El ramo/plan se edita? Fianzas es solo lectura. */
export const familiaSoloLectura = (f: FamiliaRamo | null | undefined) => f === 'fianzas';

/** Etiqueta «Activo/Inactivo». */
export const textoEstado = (iestado: string) => (texto(iestado).toUpperCase() === 'I' ? 'Inactivo' : 'Activo');

export { esEnteroTexto };
