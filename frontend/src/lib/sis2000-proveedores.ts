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
  itiposerv: '1',
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
    itiposerv: n(f.itiposerv),
    mcostoext: n(f.mcostoext),
    mcosto: n(f.mcosto),
    cmoneda: f.cmoneda.trim() || '$',
  };
}

export function clavesDelProveedor(p: ProveedorCatalogo): number[] {
  const out = p.claves.map((c) => Number(c.cclave_num)).filter((n) => Number.isInteger(n) && n >= 0);
  return [...new Set(out)].sort((a, b) => a - b);
}
