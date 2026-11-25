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
  { id: 'proveedores', resumen: 'Clínicas y proveedores de servicio del plan', secciones: ['proveedores'] },
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
