/** Proveedores del plan en Sis2000 (maplprov_per). Se asignan al plan y aplican a todas sus coberturas. */

export interface ProveedorCatalogo {
  cci_rif: number;
  cid: string;
  xcliente: string;
  /** Filas de maclient_prov del proveedor (cada una con su cclave_num si la tabla la tiene). */
  claves: Array<Record<string, unknown>>;
}

export interface ProveedorPlan {
  cramo: number;
  cplan: string;
  cci_rif: number;
  cclave_num: number;
  fdesde: string;
  fhasta: string | null;
  itiposerv: number | string | null;
  /** Descripción del servicio en el catálogo (maclient_prov.xdescripcion). */
  xdescripcion_servicio?: string | null;
  mcosto: number | null;
  mcostoext: number | null;
  cmoneda: string | null;
  cid?: string | null;
  xcliente?: string | null;
  vigente: boolean;
}

export interface ProveedoresPlanRespuesta {
  escritura_habilitada: boolean;
  /** Columna de cobertura en maplprov_per; null = la relación es solo por plan. */
  columna_cobertura: string | null;
  proveedores: ProveedorPlan[];
}

export interface ProveedorPlanForm {
  cci_rif: string;
  cclave_num: string;
  fdesde: string;
  fhasta: string;
  itiposerv: string;
  mcostoext: string;
  mcosto: string;
  cmoneda: string;
}

export const PROVEEDOR_FORM_VACIO = (): ProveedorPlanForm => ({
  cci_rif: '',
  cclave_num: '1',
  fdesde: new Date().toISOString().slice(0, 10),
  fhasta: '',
  // Vacío = nest-api toma el tipo de servicio del catálogo del proveedor.
  itiposerv: '',
  mcostoext: '',
  mcosto: '',
  cmoneda: '$',
});

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Errores del formulario de proveedor (vacío = válido). */
export function validarProveedorForm(f: ProveedorPlanForm): string[] {
  const e: string[] = [];
  if (!(Number(f.cci_rif) > 0)) e.push('Elige un proveedor.');
  if (!(Number.isInteger(Number(f.cclave_num)) && Number(f.cclave_num) >= 0)) e.push('Indica la clave del proveedor.');
  if (!FECHA.test(f.fdesde)) e.push('Indica la vigencia desde.');
  if (f.fhasta && !FECHA.test(f.fhasta)) e.push('La vigencia hasta no es una fecha válida.');
  if (f.fhasta && f.fhasta < f.fdesde) e.push('La vigencia hasta es anterior a la vigencia desde.');
  for (const [campo, nombre] of [['mcostoext', 'costo en divisa'], ['mcosto', 'costo en bolívares']] as const) {
    if (f[campo] !== '' && !(Number(f[campo]) >= 0)) e.push(`El ${nombre} debe ser un número mayor o igual a 0.`);
  }
  if (f.cmoneda.trim().length > 4) e.push('La moneda tiene máximo 4 caracteres.');
  return e;
}

/** Cuerpo para agregar un proveedor al plan. */
export function proveedorFormToPayload(f: ProveedorPlanForm): Record<string, unknown> {
  const n = (v: string) => (v.trim() === '' ? undefined : Number(v));
  return {
    cci_rif: Number(f.cci_rif),
    cclave_num: Number(f.cclave_num),
    fdesde: f.fdesde,
    fhasta: f.fhasta || undefined,
    itiposerv: f.itiposerv.trim() || undefined,
    mcostoext: n(f.mcostoext),
    mcosto: n(f.mcosto),
    cmoneda: f.cmoneda.trim() || '$',
  };
}

export function clavesDelProveedor(p: ProveedorCatalogo): number[] {
  const out = p.claves.map((c) => Number(c.cclave_num)).filter((n) => Number.isInteger(n) && n >= 0);
  return [...new Set(out)].sort((a, b) => a - b);
}

// ── Alta de un proveedor en el catálogo de Sis2000 (maclient_prov) ───────────

/** Empresa de maclient (solo los datos que nest-api deja ver). */
export interface ClienteBusqueda {
  cci_rif: number;
  cid: string;
  xcliente: string;
  tipo_documento: string;
}

export interface TipoServicioCatalogo {
  itiposerv: string;
  cantidad: number;
}

export interface ProveedorCatalogoCreado {
  cci_rif: number;
  cclave_num: number;
  itiposerv: string;
  xdescripcion: string;
  mcosto: number;
  mcostoext: number;
  cmoneda: string;
  imodalidad: string;
}

export interface AltaProveedorForm {
  cci_rif: string;
  xdescripcion: string;
  /** Código elegido del selector, o OTRO_TIPO para escribir uno nuevo en `tipoOtro`. */
  tipo: string;
  tipoOtro: string;
  mcostoext: string;
  cmoneda: string;
  imodalidad: string;
}

export const OTRO_TIPO = '__otro__';

export const ALTA_PROVEEDOR_VACIA = (): AltaProveedorForm => ({
  cci_rif: '',
  xdescripcion: '',
  tipo: '',
  tipoOtro: '',
  mcostoext: '',
  cmoneda: '$',
  imodalidad: '',
});

/** Tipo de servicio efectivo del formulario (un carácter). */
export const tipoServicioDeAlta = (f: AltaProveedorForm) => (f.tipo === OTRO_TIPO ? f.tipoOtro : f.tipo).trim();

/** RIF/cédula mientras se escribe: letra inicial (V, E, J, G, P, C), dígitos y guiones; máximo 12 caracteres. */
export function limpiarRifEntrada(texto: string): string {
  const t = texto.toUpperCase().replace(/[^VEJGPC0-9\s-]/g, '');
  return t.slice(0, 12);
}

/** Error del RIF a buscar, o null si sirve: J-12345678-9, V-12345678, 123456789 (6 a 10 dígitos). */
export function errorRifBusqueda(texto: string): string | null {
  const t = texto.trim().toUpperCase();
  if (!t) return null;
  const m = t.match(/^([VEJGPC])?[\s-]*(\d+)(?:[\s-]+(\d))?$/);
  if (!m) return 'Formato del RIF: letra y número, por ejemplo J-12345678-9.';
  const digitos = m[2] + (m[3] ?? '');
  if (digitos.length < 6 || digitos.length > 10) return 'El RIF debe tener entre 6 y 10 dígitos.';
  return null;
}

/** Un carácter de código (tipo de servicio, modalidad): letra o número, en mayúscula. */
export const limpiarCodigo1 = (texto: string) => texto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);

/** Errores del formulario de alta (vacío = válido). */
export function validarAltaProveedorForm(f: AltaProveedorForm): string[] {
  const e: string[] = [];
  if (!(Number(f.cci_rif) > 0)) e.push('Busca y elige la empresa por su RIF.');
  const desc = f.xdescripcion.trim();
  if (!desc) e.push('Escribe la descripción del servicio.');
  else if (desc.length > 120) e.push('La descripción no puede pasar de 120 caracteres.');
  if (tipoServicioDeAlta(f).length !== 1) e.push('Elige el tipo de servicio (un solo carácter).');
  const costo = f.mcostoext.trim();
  if (costo !== '' && !(Number(costo) >= 0)) e.push('El costo debe ser un número mayor o igual a 0.');
  else if (costo !== '' && !/^\d{1,12}(\.\d{1,2})?$/.test(costo)) e.push('El costo admite hasta 12 dígitos y 2 decimales.');
  if (f.cmoneda.trim().length > 4) e.push('La moneda tiene máximo 4 caracteres.');
  if (f.imodalidad.trim().length > 1) e.push('La modalidad es un solo carácter.');
  if (tipoServicioDeAlta(f) && !/^[A-Za-z0-9]$/.test(tipoServicioDeAlta(f))) e.push('El tipo de servicio es una letra o un número.');
  return e;
}

/** Cuerpo del alta en el catálogo. */
export function altaProveedorToPayload(f: AltaProveedorForm): Record<string, unknown> {
  return {
    cci_rif: Number(f.cci_rif),
    xdescripcion: f.xdescripcion.trim(),
    itiposerv: tipoServicioDeAlta(f),
    mcostoext: f.mcostoext.trim() === '' ? undefined : Number(f.mcostoext),
    cmoneda: f.cmoneda.trim() || '$',
    imodalidad: f.imodalidad.trim() || undefined,
  };
}

/** El proveedor recién creado como entrada del catálogo, para dejarlo elegido y asociarlo al plan. */
export function catalogoDesdeAlta(cliente: ClienteBusqueda, creado: ProveedorCatalogoCreado): ProveedorCatalogo {
  return {
    cci_rif: cliente.cci_rif,
    cid: cliente.cid,
    xcliente: cliente.xcliente,
    claves: [{ ...creado }],
  };
}

/** Texto en español para los errores del alta (400/409/403) cuando nest-api no trae uno propio. */
export function mensajeAltaProveedor(status: number | undefined, detalle: string): string {
  if (detalle.trim()) return detalle.trim();
  if (status === 409) return 'Ya existe un proveedor igual para esa empresa, o la escritura del catálogo está desactivada.';
  if (status === 400) return 'Revisa los datos: la empresa debe existir como cliente en Sis2000.';
  if (status === 403) return 'No tienes permiso para dar de alta proveedores.';
  return 'No se pudo crear el proveedor en el catálogo.';
}
