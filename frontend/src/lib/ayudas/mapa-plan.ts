// Mapa visual del plan (producto → plan → coberturas → tarifas) y serie de tarifas por edad. Puro: usa solo lo que ya
// está en pantalla.

export interface CoberturaMapa {
  codigo: string;
  nombre: string;
  /** Cómo se cobra (texto ya armado en pantalla: tarifa o tabla de edad). Vacío = sin tarifa elegida. */
  tarifa: string;
}

export interface TramoEdadMapa {
  desde: number;
  hasta: number;
  /** Tasa en % sobre la suma asegurada. */
  tasa: number;
  /** Prima fija del tramo. */
  prima?: number;
}

export interface TablaEdadMapa {
  codigo: string;
  nombre: string;
  tramos: TramoEdadMapa[];
}

export interface DatosMapa {
  producto: string;
  plan: string;
  coberturas: CoberturaMapa[];
  /** Tablas de edad ya leídas en memoria (personas). */
  tablasEdad: TablaEdadMapa[];
}

export type TipoNodoMapa = 'producto' | 'plan' | 'cobertura' | 'tarifa';

export interface NodoMapa {
  id: string;
  tipo: TipoNodoMapa;
  etiqueta: string;
  x: number;
  y: number;
}

export interface AristaMapa {
  id: string;
  origen: string;
  destino: string;
}

const COLUMNA: Record<TipoNodoMapa, number> = { producto: 0, plan: 270, cobertura: 540, tarifa: 840 };
const ALTO_FILA = 76;

export function construirMapa(d: DatosMapa): { nodos: NodoMapa[]; aristas: AristaMapa[] } {
  const nodos: NodoMapa[] = [];
  const aristas: AristaMapa[] = [];
  const filas = Math.max(d.coberturas.length, 1);
  const centro = ((filas - 1) * ALTO_FILA) / 2;
  nodos.push({ id: 'producto', tipo: 'producto', etiqueta: d.producto.trim() || 'Producto sin elegir', x: COLUMNA.producto, y: centro });
  nodos.push({ id: 'plan', tipo: 'plan', etiqueta: d.plan.trim() || 'Plan sin nombre', x: COLUMNA.plan, y: centro });
  aristas.push({ id: 'producto-plan', origen: 'producto', destino: 'plan' });

  const tarifas = new Map<string, string>();
  d.coberturas.forEach((c, i) => {
    const idCob = `cob-${c.codigo}`;
    nodos.push({ id: idCob, tipo: 'cobertura', etiqueta: c.nombre || c.codigo, x: COLUMNA.cobertura, y: i * ALTO_FILA });
    aristas.push({ id: `plan-${idCob}`, origen: 'plan', destino: idCob });
    const t = c.tarifa.trim();
    if (!t) return;
    let idTar = tarifas.get(t);
    if (!idTar) {
      idTar = `tar-${tarifas.size + 1}`;
      tarifas.set(t, idTar);
      nodos.push({ id: idTar, tipo: 'tarifa', etiqueta: t, x: COLUMNA.tarifa, y: (tarifas.size - 1) * ALTO_FILA });
    }
    aristas.push({ id: `${idCob}-${idTar}`, origen: idCob, destino: idTar });
  });
  return { nodos, aristas };
}

export interface PuntoEdad {
  tramo: string;
  tasa: number;
  prima: number;
}

/** Serie para la gráfica: una barra por tramo de edad, en orden. Sin tramos válidos = lista vacía (no se grafica). */
export function serieTarifaEdad(t: TablaEdadMapa | undefined): PuntoEdad[] {
  if (!t) return [];
  return t.tramos
    .filter((x) => Number.isFinite(x.desde) && Number.isFinite(x.hasta))
    .slice()
    .sort((a, b) => a.desde - b.desde)
    .map((x) => ({ tramo: `${x.desde}–${x.hasta}`, tasa: Number.isFinite(x.tasa) ? x.tasa : 0, prima: Number.isFinite(x.prima) ? (x.prima as number) : 0 }));
}
