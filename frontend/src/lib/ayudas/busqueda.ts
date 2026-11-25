// Buscador Ctrl+K: pantallas fijas, comandos que registra la pantalla abierta (pasos del combo) y ramos ya cargados.
// No hace llamadas al servidor: solo usa lo que ya está en memoria.

export type GrupoComando = 'Pantallas' | 'Pasos del combo' | 'Ramos';

export interface Comando {
  id: string;
  grupo: GrupoComando;
  titulo: string;
  detalle?: string;
  /** Qué hace al elegirlo. Si hay `ruta`, el buscador navega ahí (el router ya trae la base). */
  ejecutar?: () => void;
  ruta?: string;
}

export const PANTALLAS: Comando[] = [
  { id: 'p-productos', grupo: 'Pantallas', titulo: 'Productos', detalle: 'Inicio', ruta: '/' },
  { id: 'p-nuevo-producto', grupo: 'Pantallas', titulo: 'Nuevo producto', ruta: '/products/new' },
  { id: 'p-sis2000', grupo: 'Pantallas', titulo: 'Sis2000 QA', detalle: 'Catálogo', ruta: '/sis2000' },
  { id: 'p-ramos', grupo: 'Pantallas', titulo: 'Ramos', ruta: '/sis2000/ramos' },
  { id: 'p-combos', grupo: 'Pantallas', titulo: 'Combos de coberturas', detalle: 'Crear un plan', ruta: '/sis2000/combos' },
  { id: 'p-planes', grupo: 'Pantallas', titulo: 'Planes (editar)', ruta: '/sis2000/plans' },
];

/** Un comando por ramo ya cargado: abre las coberturas de ese ramo. */
export function comandosDeRamos(ramos: ReadonlyArray<{ cramo: number; xdescripcion?: string }>): Comando[] {
  return ramos
    .filter((r) => Number.isFinite(r.cramo) && r.cramo > 0)
    .map((r) => ({
      id: `ramo-${r.cramo}`,
      grupo: 'Ramos' as const,
      titulo: `Ramo ${r.cramo}${r.xdescripcion?.trim() ? ` · ${r.xdescripcion.trim()}` : ''}`,
      detalle: 'Ver sus coberturas',
      ruta: `/sis2000/ramo/${r.cramo}/coberturas`,
    }));
}

// ── Registro de comandos de la pantalla abierta (sin contexto ni suscripciones: se lee al abrir el buscador) ──
const registro = new Map<string, () => Comando[]>();

export function registrarComandos(clave: string, leer: () => Comando[]): () => void {
  registro.set(clave, leer);
  return () => {
    if (registro.get(clave) === leer) registro.delete(clave);
  };
}

export function comandosDisponibles(): Comando[] {
  const vistos = new Set<string>();
  return [...PANTALLAS, ...[...registro.values()].flatMap((leer) => leer())].filter((c) => !vistos.has(c.id) && vistos.add(c.id));
}
