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
    hint: 'Hasta 6 letras o números, sin espacios. Ejemplo: RCG01.',
    tooltip: 'Código con el que los planes y las pólizas identifican el producto. No se cambia después de crearlo y no debe pasar de 6 caracteres: el alta de planes no acepta más.\nEn Sis2000: maproductos.cproducto',
    createOnly: true,
    required: true,
  },
  {
    key: 'xdescripcion_l',
    label: 'Nombre del producto (xdescripcion_l)',
    type: 'text',
    section: 'identificacion',
    tooltip: 'Nombre del producto como lo ven SysIP y la tarjeta del MarketPlace. Ejemplo: RC GENERAL PARTICULAR.\nEn Sis2000: maproductos.xdescripcion_l',
    wide: true,
    required: true,
  },
  {
    key: 'xabreviatura',
    label: 'Abreviatura (xabreviatura)',
    type: 'text',
    section: 'identificacion',
    hint: 'Hasta 5 caracteres. Ejemplo: RCG.',
    tooltip: 'Nombre corto del producto en listados y reportes de Sis2000.\nEn Sis2000: maproductos.xabreviatura',
    required: true,
  },
  {
    key: 'xdescripcion_c',
    label: 'Ícono (xdescripcion_c)',
    type: 'text',
    section: 'identificacion',
    hint: 'Nombre del archivo de imagen. Ejemplo: 4_1.png.',
    tooltip: 'Imagen de la tarjeta del producto en el MarketPlace de SysIP. Aunque el campo se llama «descripción corta», aquí va el nombre del archivo, no un texto.\nEn Sis2000: maproductos.xdescripcion_c',
  },
  {
    key: 'u_version',
    label: 'Versión del registro (u_version)',
    type: 'text',
    section: 'identificacion',
    hint: 'Normalmente «!».',
    tooltip: 'Marca interna de versión del registro. Se deja en «!»; no cambia nada del producto.\nEn Sis2000: maproductos.u_version',
  },
  {
    key: 'xform',
    label: 'Formulario de emisión (xform)',
    type: 'select',
    section: 'clasificacion',
    required: true,
    hint: 'Pantalla de emisión que abre SysIP.',
    tooltip: 'Qué pantalla de emisión abre SysIP para este producto: personas, automóvil, viajero, riesgos generales… Al cambiarla se sugieren el tipo de ramo y el ramo.\nEn Sis2000: maproductos.xform',
  },
  {
    key: 'cramo',
    label: 'Ramo (cramo)',
    type: 'number',
    section: 'clasificacion',
    required: true,
    hint: 'Ejemplo: 18 (automóvil).',
    tooltip: 'Ramo al que pertenece el producto. Sus planes, coberturas, tarifas y comisiones se crean en este ramo. El ramo necesita numeración de recibos configurada para poder emitir.\nEn Sis2000: maproductos.cramo',
  },
  {
    key: 'ctiporamo',
    label: 'Tipo de ramo (ctiporamo)',
    type: 'number',
    section: 'clasificacion',
    hint: 'Se sugiere al elegir el formulario de emisión.',
    tooltip: 'Tipo de ramo del producto. Ejemplo: 7 = automóvil; 2 y 4 = personas; 1 y 6 = patrimoniales; 5 = fianzas. Debe coincidir con el ramo elegido.\nEn Sis2000: maproductos.ctiporamo',
  },
  {
    key: 'norden',
    label: 'Orden (norden)',
    type: 'number',
    section: 'clasificacion',
    tooltip: 'Posición del producto en los listados. Hoy SysIP no lo usa para ordenar.\nEn Sis2000: maproductos.norden',
  },
  {
    key: 'iproductor',
    label: 'Visible para productores (iproductor)',
    type: 'boolean',
    section: 'clasificacion',
    tooltip: 'Activo: el producto aparece en SysIP a los productores. Además, cada plan debe tener al productor incluido en «Quién lo vende».\nEn Sis2000: maproductos.iproductor',
  },
  {
    key: 'icanal',
    label: 'Visible para canales (icanal)',
    type: 'boolean',
    section: 'clasificacion',
    tooltip: 'Activo: el producto aparece en SysIP a los canales (por ejemplo, aliados comerciales). Además, cada plan debe tener al canal incluido en «Quién lo vende».\nEn Sis2000: maproductos.icanal',
  },
  {
    key: 'xdescripcion_prod',
    label: 'Descripción comercial (xdescripcion_prod)',
    type: 'text',
    section: 'comercial',
    wide: true,
    tooltip: 'Texto comercial bajo el nombre en la tarjeta del MarketPlace de SysIP.\nEn Sis2000: maproductos.xdescripcion_prod',
  },
  {
    key: 'mmonto_inicial',
    label: 'Monto «desde» (mmonto_inicial)',
    type: 'text',
    section: 'comercial',
    tooltip: 'Precio «desde» que muestra la tarjeta del MarketPlace. Es solo informativo: no se usa para cotizar ni emitir. Ejemplo: 25,00$.\nEn Sis2000: maproductos.mmonto_inicial',
  },
  {
    key: 'xfraccionamiento',
    label: 'Texto de fraccionamiento (xfraccionamiento)',
    type: 'text',
    section: 'comercial',
    wide: true,
    tooltip: 'Leyenda de formas de pago bajo el monto en la tarjeta del MarketPlace. Es solo texto: las formas de pago reales se configuran en cada plan.\nEn Sis2000: maproductos.xfraccionamiento',
  },
  {
    key: 'xurl_presentacion',
    label: 'Enlace de presentación (xurl_presentacion)',
    type: 'text',
    section: 'comercial',
    wide: true,
    tooltip: 'Enlace al folleto o presentación del producto; la tarjeta del MarketPlace lo abre en otra pestaña.\nEn Sis2000: maproductos.xurl_presentacion',
  },
  {
    key: 'ifuente',
    label: 'Origen del registro (ifuente)',
    type: 'text',
    section: 'auditoria',
    hint: 'SQL o API.',
    tooltip: 'Por dónde se creó el producto: API (configurador u otra integración) o SQL (directo en Sis2000).\nEn Sis2000: maproductos.ifuente',
  },
  {
    key: 'cprog',
    label: 'Programa que lo creó (cprog)',
    type: 'text',
    section: 'auditoria',
    tooltip: 'Programa que grabó el registro. Lo creado desde el configurador queda como NEXUS-CONFIG; la persona real queda en el historial del builder.\nEn Sis2000: maproductos.cprog',
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

/** Un producto de maproductos para los selectores (sin repetir la fila SysIP y la fila `*-nexus`). */
export interface Sis2000ProductoOpcion {
  /** Valor del selector: cproducto + cramo. */
  clave: string;
  cproducto: string;
  cramo: number;
  /** Fila representativa: la de SysIP si existe (su xform define personas/cosas). */
  producto: Sis2000Product;
  /** Todos los xform del producto (SysIP y Nexus). */
  formularios: string[];
  tieneNexus: boolean;
}

const esXformNexus = (xform: unknown) => /nexus/i.test(String(xform ?? ''));

/**
 * maproductos tiene por cada producto una fila SysIP y otra `*-nexus` (mismo cproducto y cramo,
 * distinto xform). Agrupa por (cproducto, cramo) en el orden de llegada y marca si tiene versión Nexus.
 */
export function agruparProductosSis2000(rows: Sis2000Product[]): Sis2000ProductoOpcion[] {
  const grupos = new Map<string, Sis2000ProductoOpcion>();
  for (const p of rows) {
    const cproducto = String(p.cproducto ?? '').trim();
    if (!cproducto) continue;
    const cramo = Number(p.cramo) > 0 ? Number(p.cramo) : 0;
    const clave = `${cproducto}|${cramo}`;
    const xform = String(p.xform ?? '').trim();
    const grupo = grupos.get(clave);
    if (!grupo) {
      grupos.set(clave, {
        clave,
        cproducto,
        cramo,
        producto: p,
        formularios: xform ? [xform] : [],
        tieneNexus: esXformNexus(xform),
      });
      continue;
    }
    if (xform && !grupo.formularios.includes(xform)) grupo.formularios.push(xform);
    if (esXformNexus(xform)) grupo.tieneNexus = true;
    else if (esXformNexus(grupo.producto.xform)) grupo.producto = p;
  }
  return [...grupos.values()];
}
