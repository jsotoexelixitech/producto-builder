/** Historial de lo que el configurador escribe en Sis2000 (copia original + versiones, Postgres del configurador). */

export type EntidadHistorial = 'PRODUCTO' | 'COBERTURA' | 'TARIFA' | 'PLAN' | 'PLAN_PROVEEDORES';
export type TipoVersionHistorial = 'CREACION' | 'CAMBIO' | 'ELIMINACION' | 'RESTAURACION';
export type ResultadoVersionHistorial = 'PENDIENTE' | 'APLICADA' | 'FALLIDA';
export type MomentoVersion = 'antes' | 'despues';

export interface CambioHistorial {
  campo: string;
  antes: unknown;
  despues: unknown;
}

export interface RespaldoHistorial {
  id: string;
  entidad: EntidadHistorial;
  clave: string;
  existia: boolean;
  original: unknown;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
  createdAt: string;
}

export interface VersionHistorial {
  id: string;
  numero: number;
  tipo: TipoVersionHistorial;
  resultado: ResultadoVersionHistorial;
  anterior: unknown;
  estado: unknown;
  payload: unknown;
  cambios: CambioHistorial[] | null;
  motivo: string | null;
  restauradaDesde: string | null;
  error: string | null;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
  createdAt: string;
}

export interface HistorialRespuesta {
  entidad: EntidadHistorial;
  clave: string;
  respaldo: RespaldoHistorial | null;
  versiones: VersionHistorial[];
}

export interface VistaPreviaRestauracion {
  descripcion: string;
  datos: unknown;
  advertencias: string[];
}

export interface RestauracionRespuesta {
  ok: boolean;
  restaurado: string;
  version: { id: string; numero: number; resultado: ResultadoVersionHistorial; error: string | null };
  advertencias: string[];
}

/** Claves iguales a las del backend (mayúsculas). */
export const claveHistorial = {
  cobertura: (cramo: number | string, ccobertura: string) => `${Number(cramo)}-${ccobertura.trim().toUpperCase()}`,
  tarifa: (cramo: number | string, ccober: string, ctarifa: string) =>
    `${Number(cramo)}-${ccober.trim().toUpperCase()}-${ctarifa.trim().toUpperCase()}`,
  plan: (cramo: number | string, cplan: string) => `${Number(cramo)}-${cplan.trim().toUpperCase()}`,
};

export const TIPO_VERSION_LABEL: Record<TipoVersionHistorial, string> = {
  CREACION: 'Creación',
  CAMBIO: 'Cambio',
  ELIMINACION: 'Eliminación',
  RESTAURACION: 'Restauración',
};

export const RESULTADO_LABEL: Record<ResultadoVersionHistorial, string> = {
  PENDIENTE: 'En curso',
  APLICADA: 'Aplicada',
  FALLIDA: 'No se aplicó',
};

export function quienHizo(v: { usuarioNombre: string | null; usuarioEmail: string | null }): string {
  return v.usuarioNombre || v.usuarioEmail || 'Usuario no identificado';
}

export function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

export function valorCorto(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
