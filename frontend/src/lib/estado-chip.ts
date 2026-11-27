/** Estado visible de un registro (activo / inactivo / borrador / con errores), igual en todas las listas. */
export type EstadoChip = 'activo' | 'inactivo' | 'borrador' | 'errores' | 'otro';

export const ETIQUETA_ESTADO: Record<EstadoChip, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  borrador: 'Borrador',
  errores: 'Con errores',
  otro: '—',
};

/** Traduce el valor crudo (A / I / ACTIVO / DRAFT / ...) al estado del chip. */
export function estadoDeValor(valor: unknown): EstadoChip {
  if (valor === true) return 'activo';
  if (valor === false) return 'inactivo';
  const v = String(valor ?? '').trim().toUpperCase();
  if (!v) return 'otro';
  if (['A', 'ACTIVO', 'ACTIVA', 'ACTIVE', '1', 'TRUE', 'APPROVED_ACTIVE', 'VIGENTE'].includes(v)) return 'activo';
  if (['I', 'INACTIVO', 'INACTIVA', 'INACTIVE', '0', 'FALSE', 'ANULADO'].includes(v)) return 'inactivo';
  if (['B', 'BORRADOR', 'DRAFT', 'ACTUARIAL_REVIEW', 'SUBMITTED_TO_SUDEASEG', 'PENDIENTE'].includes(v)) return 'borrador';
  if (['E', 'ERROR', 'ERRORES', 'CON ERRORES', 'FALLIDO', 'REJECTED'].includes(v)) return 'errores';
  return 'otro';
}
