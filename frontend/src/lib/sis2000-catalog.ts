export interface Sis2000Product {
  cproducto: string;
  cramo: number | null;
  u_version: string | null;
  xdescripcion_l: string;
  xdescripcion_c: string | null;
  xabreviatura: string;
  iproductor: boolean;
  icanal: boolean;
  xform: string;
  cprog: string | null;
  ifuente: string | null;
  bok: boolean | null;
  cerror: string | null;
  fingreso: string | null;
  cusuario: number | null;
  ccategoria: number | null;
  cusuarioauto: number | null;
  ccategoriaauto: number | null;
  fultmod: string | null;
  cusuariomod: number | null;
  ccategoriamod: number | null;
  ctiporamo: number | null;
  xdescripcion_prod: string | null;
  mmonto_inicial: string | null;
  norden: number | null;
  xfraccionamiento: string | null;
  xurl_presentacion: string | null;
}

export type Sis2000ProductInput = Sis2000Product;

export type Sis2000FieldType = 'text' | 'number' | 'boolean' | 'select' | 'tri-bool';

export interface Sis2000FieldDef {
  key: keyof Sis2000Product;
  label: string;
  type: Sis2000FieldType;
  hint?: string;
  section: 'identificacion' | 'clasificacion' | 'comercial' | 'auditoria';
  createOnly?: boolean;
  wide?: boolean;
}

export const SIS2000_FIELD_DEFS: Sis2000FieldDef[] = [
  { key: 'cproducto', label: 'cproducto', type: 'text', section: 'identificacion', hint: 'Máx. 6 caracteres', createOnly: true },
  { key: 'xdescripcion_l', label: 'xdescripcion_l', type: 'text', section: 'identificacion', wide: true },
  { key: 'xabreviatura', label: 'xabreviatura', type: 'text', section: 'identificacion', hint: 'Máx. 5 caracteres' },
  { key: 'xdescripcion_c', label: 'xdescripcion_c (icono)', type: 'text', section: 'identificacion' },
  { key: 'u_version', label: 'u_version', type: 'text', section: 'identificacion', hint: 'Ej. !' },
  { key: 'xform', label: 'xform', type: 'select', section: 'clasificacion' },
  { key: 'cramo', label: 'cramo', type: 'number', section: 'clasificacion' },
  { key: 'ctiporamo', label: 'ctiporamo', type: 'number', section: 'clasificacion' },
  { key: 'norden', label: 'norden', type: 'number', section: 'clasificacion' },
  { key: 'iproductor', label: 'iproductor', type: 'boolean', section: 'clasificacion' },
  { key: 'icanal', label: 'icanal', type: 'boolean', section: 'clasificacion' },
  { key: 'xdescripcion_prod', label: 'xdescripcion_prod', type: 'text', section: 'comercial', wide: true },
  { key: 'mmonto_inicial', label: 'mmonto_inicial', type: 'text', section: 'comercial' },
  { key: 'xfraccionamiento', label: 'xfraccionamiento', type: 'text', section: 'comercial', wide: true },
  { key: 'xurl_presentacion', label: 'xurl_presentacion', type: 'text', section: 'comercial', wide: true },
  { key: 'ifuente', label: 'ifuente', type: 'text', section: 'auditoria', hint: 'SQL / API' },
  { key: 'cprog', label: 'cprog', type: 'text', section: 'auditoria' },
  { key: 'fingreso', label: 'fingreso', type: 'text', section: 'auditoria' },
  { key: 'fultmod', label: 'fultmod', type: 'text', section: 'auditoria' },
  { key: 'cusuario', label: 'cusuario', type: 'number', section: 'auditoria' },
  { key: 'ccategoria', label: 'ccategoria', type: 'number', section: 'auditoria' },
  { key: 'cusuarioauto', label: 'cusuarioauto', type: 'number', section: 'auditoria' },
  { key: 'ccategoriaauto', label: 'ccategoriaauto', type: 'number', section: 'auditoria' },
  { key: 'cusuariomod', label: 'cusuariomod', type: 'number', section: 'auditoria' },
  { key: 'ccategoriamod', label: 'ccategoriamod', type: 'number', section: 'auditoria' },
  { key: 'bok', label: 'bok', type: 'tri-bool', section: 'auditoria' },
  { key: 'cerror', label: 'cerror', type: 'text', section: 'auditoria', wide: true },
];

export const SIS2000_XFORM_OPTIONS = [
  { value: 'persons', label: 'Personas' },
  { value: 'persons-ind', label: 'Personas individual' },
  { value: 'automobile', label: 'Automóvil / RCV' },
  { value: 'rcv-external', label: 'RCV externo (iframe)' },
  { value: 'traveler', label: 'Viajero local' },
  { value: 'alt-traveler', label: 'Viajero' },
  { value: 'general-risk', label: 'Riesgos generales' },
  { value: 'embarcaciones', label: 'Embarcaciones' },
] as const;

export const EMPTY_SIS2000_PRODUCT: Sis2000ProductInput = {
  cproducto: '',
  cramo: null,
  u_version: '!',
  xdescripcion_l: '',
  xdescripcion_c: null,
  xabreviatura: '',
  iproductor: true,
  icanal: true,
  xform: 'persons',
  cprog: 'ApiCreateProduct',
  ifuente: 'API',
  bok: null,
  cerror: null,
  fingreso: null,
  cusuario: null,
  ccategoria: null,
  cusuarioauto: null,
  ccategoriaauto: null,
  fultmod: null,
  cusuariomod: null,
  ccategoriamod: null,
  ctiporamo: 2,
  xdescripcion_prod: null,
  mmonto_inicial: null,
  norden: null,
  xfraccionamiento: null,
  xurl_presentacion: null,
};

export const SIS2000_SECTION_LABELS: Record<Sis2000FieldDef['section'], string> = {
  identificacion: 'Identificación',
  clasificacion: 'Clasificación y visibilidad',
  comercial: 'Presentación comercial',
  auditoria: 'Auditoría Sis2000',
};

export function sis2000SourceLabel(p: Sis2000Product): string {
  if (p.ifuente === 'API') return 'API';
  if (p.ifuente === 'SQL') return 'Sis2000';
  return p.ifuente ?? '—';
}

export function formatSis2000Value(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

export function boolLabel(value: boolean | null | undefined): string {
  if (value == null) return '—';
  return value ? 'Sí' : 'No';
}
