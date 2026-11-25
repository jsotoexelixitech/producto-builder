// «¿Se puede emitir?»: avance del plan a partir de los pasos del Combo y de los pasos de completar (EstadoGrupo ya
// existente). Funciones puras: no leen nada del servidor.
import type { EstadoGrupo } from '../configurador-combo.ts';

export type EstadoItem = 'hecho' | 'falta' | 'revisar' | 'pendiente' | 'bloqueado';

export interface PasoEntrada {
  /** Índice del paso en el asistente (lo que recibe irAPaso). */
  indice: number;
  titulo: string;
  /** Textos de lo que falta en ese paso (vacío = completo). */
  faltas: string[];
}

export interface GrupoEntrada {
  indice: number;
  titulo: string;
  estado: EstadoGrupo;
}

export interface ItemChecklist {
  indice: number;
  titulo: string;
  estado: EstadoItem;
  detalle: string;
}

export interface Checklist {
  items: ItemChecklist[];
  hechos: number;
  total: number;
  porcentaje: number;
  /** Todo está hecho: ya se puede emitir. */
  puedeEmitir: boolean;
}

const DE_GRUPO: Record<EstadoGrupo, { estado: EstadoItem; detalle: string }> = {
  hecho: { estado: 'hecho', detalle: 'Listo' },
  falta: { estado: 'falta', detalle: 'Falta algo: la revisión lo marca' },
  revisar: { estado: 'revisar', detalle: 'Tiene avisos por revisar' },
  visitado: { estado: 'pendiente', detalle: 'Lo abriste, falta confirmarlo' },
  'sin-visitar': { estado: 'pendiente', detalle: 'Todavía no lo abres' },
  bloqueado: { estado: 'bloqueado', detalle: 'Se habilita al guardar el plan' },
};

export function construirChecklist(pasos: PasoEntrada[], grupos: GrupoEntrada[]): Checklist {
  const items: ItemChecklist[] = [
    ...pasos.map<ItemChecklist>((p) =>
      p.faltas.length
        ? { indice: p.indice, titulo: p.titulo, estado: 'falta', detalle: p.faltas.length === 1 ? p.faltas[0] : `${p.faltas[0]} (y ${p.faltas.length - 1} más)` }
        : { indice: p.indice, titulo: p.titulo, estado: 'hecho', detalle: 'Listo' },
    ),
    ...grupos.map<ItemChecklist>((g) => ({ indice: g.indice, titulo: g.titulo, ...DE_GRUPO[g.estado] })),
  ];
  const hechos = items.filter((i) => i.estado === 'hecho').length;
  const total = items.length;
  return { items, hechos, total, porcentaje: total ? Math.round((hechos / total) * 100) : 0, puedeEmitir: total > 0 && hechos === total };
}
