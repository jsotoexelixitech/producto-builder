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
  /** Qué hace el campo en Sis2000 (ícono de ayuda junto al título). */
  tooltip?: string;
  section: 'identificacion' | 'clasificacion' | 'comercial' | 'auditoria';
  createOnly?: boolean;
  hideOnCreate?: boolean;
  required?: boolean;
  wide?: boolean;
}

/** ctiporamo sugerido al elegir xform (mapa Sis2000 / partner). */
export const SIS2000_XFORM_CTIRAMO: Record<string, number> = {
  persons: 2,
  'persons-ind': 2,
  automobile: 7,
  'rcv-external': 7,
  traveler: 4,
  'alt-traveler': 4,
  'general-risk': 6,
  embarcaciones: 6,
};

/** cramo típico por xform (confirmar con LM). */
export const SIS2000_XFORM_SUGGESTED_CRAMO: Record<string, number> = {
  persons: 8,
  'persons-ind': 8,
  automobile: 18,
  'rcv-external': 18,
  traveler: 5,
  'alt-traveler': 5,
  'general-risk': 10,
  embarcaciones: 20,
};

/** Campos de auditoría que Sis2000 rellena al crear — no mostrar en /new. */
export const SIS2000_AUDITORIA_HIDE_ON_CREATE: ReadonlySet<keyof Sis2000Product> = new Set([
  'fingreso',
  'fultmod',
  'cusuario',
  'ccategoria',
  'cusuarioauto',
  'ccategoriaauto',
  'cusuariomod',
  'ccategoriamod',
  'bok',
  'cerror',
]);

export const SIS2000_FIELD_DEFS: Sis2000FieldDef[] = [
  {
    key: 'cproducto',
    label: 'Código de producto (cproducto)',
    type: 'text',
    section: 'identificacion',
    hint: 'Máx. 6 caracteres alfanuméricos',
    tooltip: 'Clave del producto en maproductos. Los planes y las pólizas lo referencian; no se puede cambiar después de crearlo.',
    createOnly: true,
    required: true,
  },
  {
    key: 'xdescripcion_l',
    label: 'Nombre del producto (xdescripcion_l)',
    type: 'text',
    section: 'identificacion',
    tooltip: 'Nombre largo que muestran SysIP y la tarjeta del MarketPlace.',
    wide: true,
    required: true,
  },
  {
    key: 'xabreviatura',
    label: 'Abreviatura (xabreviatura)',
    type: 'text',
    section: 'identificacion',
    hint: 'Máx. 5 caracteres',
    tooltip: 'Nombre corto del producto en listados y reportes de Sis2000.',
    required: true,
  },
  {
    key: 'xdescripcion_c',
    label: 'Ícono (xdescripcion_c)',
    type: 'text',
    section: 'identificacion',
    hint: 'Nombre PNG/JPG en Sis2000 (ej. 4_1.png). Vista previa si está en public/sis2000-icons/',
    tooltip: 'Nombre del archivo de imagen que la tarjeta del MarketPlace de SysIP busca en assets/img/marketplace/. No es una descripción corta.',
  },
  {
    key: 'u_version',
    label: 'Versión del registro (u_version)',
    type: 'text',
    section: 'identificacion',
    hint: 'Ej. !',
    tooltip: 'Marca de versión de las tablas de Sis2000. Se deja en «!».',
  },
  {
    key: 'xform',
    label: 'Formulario de emisión (xform)',
    type: 'select',
    section: 'clasificacion',
    required: true,
    hint: 'Tipo de formulario de emisión Sis2000',
    tooltip: 'Qué formulario abre SysIP para emitir este producto (personas, automóvil, viajero, riesgos generales…). Al cambiarlo se sugieren el tipo de ramo y el ramo.',
  },
  {
    key: 'cramo',
    label: 'Ramo (cramo)',
    type: 'number',
    section: 'clasificacion',
    required: true,
    hint: 'Código de ramo en maproductos',
    tooltip: 'Ramo de Sis2000 al que pertenece el producto. Sus planes, coberturas y tarifas se crean en este ramo.',
  },
  {
    key: 'ctiporamo',
    label: 'Tipo de ramo (ctiporamo)',
    type: 'number',
    section: 'clasificacion',
    hint: 'Se sugiere al cambiar xform',
    tooltip: 'Agrupación del ramo en Sis2000 (tabla matiporamo), p. ej. 2 personas, 4 viajes, 6 riesgos generales, 7 automóvil.',
  },
  {
    key: 'norden',
    label: 'Orden (norden)',
    type: 'number',
    section: 'clasificacion',
    tooltip: 'Posición del producto en los listados. Hoy SysIP no lo usa para ordenar.',
  },
  {
    key: 'iproductor',
    label: 'Visible para productores (iproductor)',
    type: 'boolean',
    section: 'clasificacion',
    tooltip: 'Si está activo, el producto aparece en la lista de productos que SysIP ofrece a los productores (intermediarios).',
  },
  {
    key: 'icanal',
    label: 'Visible para canales (icanal)',
    type: 'boolean',
    section: 'clasificacion',
    tooltip: 'Si está activo, el producto aparece en la lista de productos que SysIP ofrece a los canales de venta.',
  },
  {
    key: 'xdescripcion_prod',
    label: 'Descripción comercial (xdescripcion_prod)',
    type: 'text',
    section: 'comercial',
    wide: true,
    tooltip: 'Texto bajo el nombre en la tarjeta del MarketPlace de SysIP.',
  },
  {
    key: 'mmonto_inicial',
    label: 'Monto «desde» (mmonto_inicial)',
    type: 'text',
    section: 'comercial',
    tooltip: 'Precio de referencia que muestra la tarjeta del MarketPlace (texto, p. ej. «25,00$»). No se usa para cotizar.',
  },
  {
    key: 'xfraccionamiento',
    label: 'Texto de fraccionamiento (xfraccionamiento)',
    type: 'text',
    section: 'comercial',
    wide: true,
    tooltip: 'Leyenda de formas de pago bajo el monto en la tarjeta del MarketPlace. Es solo texto: las frecuencias reales se configuran en cada plan.',
  },
  {
    key: 'xurl_presentacion',
    label: 'Enlace de presentación (xurl_presentacion)',
    type: 'text',
    section: 'comercial',
    wide: true,
    tooltip: 'URL del folleto o presentación del producto; la tarjeta del MarketPlace la abre en otra pestaña.',
  },
  {
    key: 'ifuente',
    label: 'Origen del registro (ifuente)',
    type: 'text',
    section: 'auditoria',
    hint: 'SQL / API',
    tooltip: 'Por dónde se creó el producto: API (configurador u otra integración) o SQL (directo en Sis2000).',
  },
  {
    key: 'cprog',
    label: 'Programa que lo creó (cprog)',
    type: 'text',
    section: 'auditoria',
    tooltip: 'Nombre del programa o proceso que grabó el registro; sirve para rastrear quién lo creó.',
  },
  { key: 'fingreso', label: 'Fecha de ingreso (fingreso)', type: 'text', section: 'auditoria', hideOnCreate: true },
  { key: 'fultmod', label: 'Última modificación (fultmod)', type: 'text', section: 'auditoria', hideOnCreate: true },
  { key: 'cusuario', label: 'Usuario que lo creó (cusuario)', type: 'number', section: 'auditoria', hideOnCreate: true },
  { key: 'ccategoria', label: 'Categoría del usuario (ccategoria)', type: 'number', section: 'auditoria', hideOnCreate: true },
  {
    key: 'cusuarioauto',
    label: 'Usuario que autorizó (cusuarioauto)',
    type: 'number',
    section: 'auditoria',
    hideOnCreate: true,
  },
  {
    key: 'ccategoriaauto',
    label: 'Categoría de quien autorizó (ccategoriaauto)',
    type: 'number',
    section: 'auditoria',
    hideOnCreate: true,
  },
  { key: 'cusuariomod', label: 'Usuario que modificó (cusuariomod)', type: 'number', section: 'auditoria', hideOnCreate: true },
  {
    key: 'ccategoriamod',
    label: 'Categoría de quien modificó (ccategoriamod)',
    type: 'number',
    section: 'auditoria',
    hideOnCreate: true,
  },
  { key: 'bok', label: 'Indicador OK (bok)', type: 'tri-bool', section: 'auditoria', hideOnCreate: true },
  { key: 'cerror', label: 'Código de error (cerror)', type: 'text', section: 'auditoria', wide: true, hideOnCreate: true },
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

/** Campos opcionales que no se muestran en ficha si vienen vacíos de Sis2000. */
export const SIS2000_HIDE_WHEN_EMPTY: ReadonlySet<keyof Sis2000Product> = new Set([
  'xdescripcion_c',
  'norden',
  'mmonto_inicial',
  'xfraccionamiento',
  'xurl_presentacion',
  'cusuario',
  'ccategoria',
  'cusuarioauto',
  'ccategoriaauto',
  'fultmod',
  'cusuariomod',
  'ccategoriamod',
  'bok',
  'cerror',
]);

export function shouldShowSis2000ProductField(
  key: keyof Sis2000Product,
  value: unknown,
): boolean {
  if (!SIS2000_HIDE_WHEN_EMPTY.has(key)) return true;
  return value != null && value !== '';
}

export function boolLabel(value: boolean | null | undefined): string {
  if (value == null) return '—';
  return value ? 'Sí' : 'No';
}

export function shouldShowSis2000FormField(def: Sis2000FieldDef, isNew: boolean): boolean {
  if (isNew && def.hideOnCreate) return false;
  if (isNew && SIS2000_AUDITORIA_HIDE_ON_CREATE.has(def.key)) return false;
  return true;
}

/** Valida antes de POST partner/products/create. */
export function validateSis2000ProductForSave(form: Sis2000ProductInput): string[] {
  const errors: string[] = [];
  const code = form.cproducto.trim().toUpperCase();
  if (code.length < 2 || code.length > 6 || !/^[A-Z0-9]+$/.test(code)) {
    errors.push('cproducto: 2–6 caracteres alfanuméricos.');
  }
  if (form.xdescripcion_l.trim().length < 2) {
    errors.push('xdescripcion_l: mínimo 2 caracteres.');
  }
  const abrev = form.xabreviatura.trim().toUpperCase();
  if (abrev.length < 2 || abrev.length > 5 || !/^[A-Z0-9]+$/.test(abrev)) {
    errors.push('xabreviatura: 2–5 caracteres alfanuméricos.');
  }
  if (form.cramo == null || Number.isNaN(Number(form.cramo))) {
    errors.push('cramo: obligatorio (número de ramo Sis2000).');
  }
  if (!form.xform.trim()) {
    errors.push('xform: elige tipo de formulario Sis2000.');
  }
  return errors;
}
