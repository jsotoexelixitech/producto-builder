// Pasos «completar el plan» del Combo de coberturas: se agrupan las secciones que devuelve GET ramos/:cramo
// (no hay listas de secciones por ramo aquí: solo cómo se agrupan para mostrarlas). Funciones puras: se prueban
// con `npm test -w frontend`.
import { SECCIONES_BASE, familiaValida, type FamiliaRamo, type ItemRevision } from './configurador.ts';

/** Secciones que el Combo ya resuelve en sus 5 pasos: no se repiten al completar. */
export const SECCIONES_EN_PASOS_DEL_COMBO = ['producto', 'plan', 'coberturas', 'tarifas'];

/** Paso del Combo (id de PASOS) donde se corrige cada una de esas secciones. */
export const PASO_COMBO_DE_SECCION: Record<string, string> = {
  producto: 'producto',
  coberturas: 'coberturas',
  tarifas: 'precios',
  plan: 'datos',
};

export interface GrupoCompletar {
  id: string;
  titulo: string;
  resumen: string;
  /** Secciones del ramo (claves de GET ramos/:cramo → secciones) que se muestran en este paso, en orden. */
  secciones: string[];
}

export type EstadoGrupo = 'bloqueado' | 'hecho' | 'falta' | 'revisar' | 'visitado' | 'sin-visitar';

const MIEMBROS: Array<{ id: string; resumen: string; secciones: string[] }> = [
  {
    id: 'tarifa',
    resumen: 'Lo propio de la tarifa del ramo: tipo y uso, tasas, tarifa por días, edades y tablas',
    secciones: ['tipos-uso', 'tasas-antiguedad', 'tasa-casco', 'tarifa-dias', 'descuentos-recargos', 'edades-parentesco', 'tablas-edad', 'condominio'],
  },
  { id: 'deducibles', resumen: 'Lo que asume el asegurado en cada siniestro y su descuento', secciones: ['deducibles'] },
  { id: 'pagos', resumen: 'Cómo puede pagar el cliente: contado o en cuotas', secciones: ['frecuencias'] },
  { id: 'vende', resumen: 'Quién puede ofrecer el plan (con mancomunados) y qué comisión gana', secciones: ['quien-vende', 'canales', 'comisiones'] },
  { id: 'proveedores', resumen: 'Proveedores de servicio del plan (grúa, clínicas, asistencia…)', secciones: ['proveedores'] },
  { id: 'revision', resumen: '¿El plan se puede emitir? Lo que falta, sin cambiar nada', secciones: ['revision'] },
];

function tituloTarifa(familia: FamiliaRamo | null | undefined): string {
  const f = familia ? familiaValida(familia) : null;
  if (f === 'auto') return 'Vehículo y tarifa';
  if (f === 'personas') return 'Edades y tablas';
  return 'Tarifa del ramo';
}

const TITULOS: Record<string, string> = {
  deducibles: 'Deducibles',
  pagos: 'Pagos',
  vende: 'Quién lo vende y comisiones',
  proveedores: 'Proveedores',
  revision: 'Revisión',
  otros: 'Otras secciones del ramo',
};

/**
 * Pasos de «completar el plan» para las secciones que declara el ramo. Un paso sin secciones no sale; las secciones que
 * no están en ningún grupo van a «Otras secciones del ramo» (para no perder lo que una familia nueva traiga).
 */
export function gruposCompletar(familia: FamiliaRamo | null | undefined, secciones: string[]): GrupoCompletar[] {
  const lista = (secciones.length ? secciones : SECCIONES_BASE).filter((s) => !SECCIONES_EN_PASOS_DEL_COMBO.includes(s));
  // «Quién lo vende» y «canales» son la misma pantalla: una sola vez.
  const unicas = lista.filter((s, i) => lista.indexOf(s) === i && !(s === 'canales' && lista.includes('quien-vende')));
  const usadas = new Set<string>();
  const grupos: GrupoCompletar[] = [];
  for (const m of MIEMBROS) {
    const propias = m.secciones.filter((s) => unicas.includes(s));
    propias.forEach((s) => usadas.add(s));
    if (propias.length) {
      grupos.push({ id: m.id, titulo: m.id === 'tarifa' ? tituloTarifa(familia) : TITULOS[m.id], resumen: m.resumen, secciones: propias });
    }
  }
  const otras = unicas.filter((s) => !usadas.has(s));
  if (otras.length) {
    const revision = grupos.findIndex((g) => g.id === 'revision');
    const g: GrupoCompletar = { id: 'otros', titulo: TITULOS.otros, resumen: 'Otras partes del plan que declara el ramo', secciones: otras };
    grupos.splice(revision >= 0 ? revision : grupos.length, 0, g);
  }
  return grupos;
}

/** Grupo (id) donde se muestra una sección del ramo; null si no está en los pasos de completar. */
export function grupoDeSeccion(grupos: GrupoCompletar[], seccion: string): string | null {
  const s = seccion === 'canales' ? 'quien-vende' : seccion;
  return grupos.find((g) => g.secciones.includes(seccion) || g.secciones.includes(s))?.id ?? null;
}

export interface EntradaEstado {
  /** El plan ya existe en Sis2000 (guardado o abierto para editar). */
  planListo: boolean;
  /** Ids de grupos que el usuario ya abrió. */
  visitados: ReadonlySet<string>;
  /** Puntos de la revisión del plan (null = no hay dato: solo se sabe si se visitó). */
  items: ItemRevision[] | null;
  /** La revisión dijo «listo para emitir» (null = sin dato). */
  revisionListo: boolean | null;
}

/** Estado de un paso: de la revisión del plan cuando hay dato; si no, solo visitado / sin visitar. */
export function estadoGrupo(g: GrupoCompletar, e: EntradaEstado): EstadoGrupo {
  if (!e.planListo) return 'bloqueado';
  const visitado = e.visitados.has(g.id);
  if (g.id === 'revision') {
    if (e.revisionListo === true) return 'hecho';
    if (e.items?.some((i) => i.nivel === 'error')) return 'falta';
    return visitado ? 'visitado' : 'sin-visitar';
  }
  const propios = (e.items ?? []).filter((i) => g.secciones.includes(i.seccion) || (i.seccion === 'canales' && g.secciones.includes('quien-vende')));
  if (propios.some((i) => i.nivel === 'error')) return 'falta';
  if (propios.some((i) => i.nivel === 'aviso')) return 'revisar';
  if (propios.length) return 'hecho';
  return visitado ? 'visitado' : 'sin-visitar';
}

export const ETIQUETA_ESTADO: Record<EstadoGrupo, string> = {
  bloqueado: 'Se habilita al guardar el plan',
  hecho: 'Hecho',
  falta: 'Falta',
  revisar: 'Revisar',
  visitado: 'Visitado',
  'sin-visitar': 'Sin visitar',
};

// ── Editar un plan de personas con edades distintas por parentesco ───────────────────────────────────────────────

/** Un parentesco del plan tal como está en Sis2000 (edades de mapledades_per, sexo de mapltarifas_per). */
export interface ParentescoDelPlan {
  cparen: number;
  csexo: string;
  nedad_min: number;
  nedad_max: number;
}

export interface ParentescosDelPlan {
  /** Parentescos de la primera cobertura que los tiene, por código (y sexo). */
  lista: ParentescoDelPlan[];
  /** Las edades o el sexo no son iguales para todos: el formulario (un solo rango para todos) no puede editarlos. */
  varian: boolean;
  /** Todas las coberturas tienen los mismos parentescos, con el mismo sexo y edades. */
  igualesEnTodas: boolean;
}

const enteroOCero = (v: unknown) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Parentescos de un plan de personas leído de Sis2000 (coberturas de PlanDto). Cuando `varian`, el Combo no los edita:
 * los devuelve tal cual al guardar y pide a nest-api `conservarEdades` para que mapledades_per no se reescriba.
 */
export function parentescosDelPlan(coberturas: Array<Record<string, unknown>>): ParentescosDelPlan {
  const deCobertura = (c: Record<string, unknown>): ParentescoDelPlan[] =>
    (Array.isArray(c.parentescos) ? (c.parentescos as Record<string, unknown>[]) : [])
      .map((p) => ({
        cparen: Number(p.cparen),
        csexo: String(p.csexo ?? '').trim().toUpperCase() || 'A',
        nedad_min: enteroOCero(p.nedad_min),
        nedad_max: enteroOCero(p.nedad_max),
      }))
      .filter((p) => Number.isInteger(p.cparen) && p.cparen > 0)
      .sort((a, b) => a.cparen - b.cparen || a.csexo.localeCompare(b.csexo));
  const firma = (ps: ParentescoDelPlan[]) => ps.map((p) => [p.cparen, p.csexo, p.nedad_min, p.nedad_max].join('|')).join(',');
  const listas = coberturas.map(deCobertura).filter((ps) => ps.length);
  const lista = listas[0] ?? [];
  const p0 = lista[0];
  return {
    lista,
    varian: listas.some((ps) => ps.some((p) => p.csexo !== p0.csexo || p.nedad_min !== p0.nedad_min || p.nedad_max !== p0.nedad_max)),
    igualesEnTodas: listas.every((ps) => firma(ps) === firma(lista)),
  };
}

/** «de 0 a 74 años» (o «18 años» si mínima y máxima coinciden). */
export function textoEdades(p: Pick<ParentescoDelPlan, 'nedad_min' | 'nedad_max'>): string {
  return p.nedad_min === p.nedad_max ? `${p.nedad_min} años` : `de ${p.nedad_min} a ${p.nedad_max} años`;
}

// ── Nombre del producto de un plan cuando maproductos no lo tiene en el ramo del plan ────────────────────────────

/**
 * Solo presentación (no cambia lo que se graba): el producto de un plan que no está en maproductos con el ramo del
 * plan. Si el código existe en otro ramo se muestra su nombre y dónde está registrado («Viajero Local · registrado en
 * ramo 5»); si no existe, «Producto 1 (no está en el catálogo)».
 */
export function nombreProductoDelPlan(
  catalogo: Array<{ cproducto: string; cramo: number; nombre: string }>,
  cproducto: string,
  cramoPlan: number,
): string {
  const codigo = cproducto.trim().toUpperCase();
  const mismos = catalogo.filter((o) => o.cproducto.trim().toUpperCase() === codigo && o.nombre.trim());
  const enRamo = mismos.find((o) => o.cramo === cramoPlan);
  if (enRamo) return enRamo.nombre.trim();
  const otro = mismos.find((o) => o.cramo > 0) ?? mismos[0];
  if (!otro) return `Producto ${cproducto.trim()} (no está en el catálogo)`;
  return otro.cramo > 0 ? `${otro.nombre.trim()} · registrado en ramo ${otro.cramo}` : `${otro.nombre.trim()} · sin ramo en el catálogo`;
}
