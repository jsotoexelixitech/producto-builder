// Formulario "Nueva cobertura" (macoberturas + matarifa + matarifa_d) para nest-api v1/configurador.
// Una cobertura sin tarifa vigente no se puede usar en un plan, por eso se crean juntas.
import type { Sis2000NestRow } from '@/lib/sis2000-nest-api';

export type ModoPrima = 'tasa' | 'prima';

/** Valores del formulario tal como se escriben (texto). */
export interface NuevaCoberturaForm {
  ccobertura: string;
  xdescripcion_l: string;
  xdescripcion_c: string;
  xabreviatura: string;
  cmoneda: string;
  obligatoria: boolean;
  /** Cobertura del ramo de la que se copian ramo/cobertura internos (vacío = ninguna). */
  basadaEn: string;
  cramoint: string;
  ccoberturaint: string;
  ccontrea: string;
  cramorea: string;
  ctarifa: string;
  xtarifam: string;
  fdesde: string;
  fhasta: string;
  msumamin: string;
  msumamax: string;
  modo: ModoPrima;
  pprima: string;
  mprima: string;
}

export type ErroresNuevaCobertura = Partial<Record<keyof NuevaCoberturaForm, string>>;

const texto = (v: unknown) => (v == null ? '' : String(v).trim());

/** Fecha local YYYY-MM-DD (toISOString es UTC). */
export function hoyLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Siguiente código numérico libre del ramo (máx. + 1); '' si no cabe en 4 dígitos. */
export function siguienteCodigoCobertura(existentes: Sis2000NestRow[]): string {
  let max = 0;
  for (const c of existentes) {
    const cod = texto(c.ccobertura);
    if (/^\d+$/.test(cod)) max = Math.max(max, Number(cod));
  }
  const siguiente = String(max + 1);
  return siguiente.length <= 4 ? siguiente : '';
}

export function formNuevaCobertura(
  existentes: Sis2000NestRow[],
  cmoneda = '$',
): NuevaCoberturaForm {
  const base = existentes.find((c) => texto(c.ccobertura) === '1' && texto(c.cramoint));
  return {
    ccobertura: siguienteCodigoCobertura(existentes),
    xdescripcion_l: '',
    xdescripcion_c: '',
    xabreviatura: '',
    cmoneda,
    obligatoria: false,
    basadaEn: base ? '1' : '',
    cramoint: base ? texto(base.cramoint) : '',
    ccoberturaint: base ? texto(base.ccoberturaint) : '',
    ccontrea: '',
    cramorea: '',
    ctarifa: '1',
    xtarifam: '',
    fdesde: hoyLocalIso(),
    fhasta: '2099-12-31',
    msumamin: '',
    msumamax: '',
    modo: 'tasa',
    pprima: '',
    mprima: '',
  };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const esNumero = (v: string) => v.trim() !== '' && Number.isFinite(Number(v));
const esEntero = (v: string) => /^\d+$/.test(v.trim());
/** nest-api valida decimales: montos con 2, tasa con 6. */
const decimales = (v: string) => (v.trim().split('.')[1] ?? '').length;

/** Errores por campo (vacío = se puede guardar). */
export function validarNuevaCobertura(
  f: NuevaCoberturaForm,
  existentes: Sis2000NestRow[],
): ErroresNuevaCobertura {
  const e: ErroresNuevaCobertura = {};
  const cod = f.ccobertura.trim();
  if (!cod) e.ccobertura = 'Indica el código de la cobertura.';
  else if (!/^[A-Za-z0-9]{1,4}$/.test(cod)) e.ccobertura = 'Hasta 4 letras o números, sin espacios.';
  else if (existentes.some((c) => texto(c.ccobertura).toUpperCase() === cod.toUpperCase())) {
    e.ccobertura = `La cobertura ${cod} ya existe en este ramo.`;
  }

  if (!f.xdescripcion_l.trim()) e.xdescripcion_l = 'Indica el nombre de la cobertura.';
  else if (f.xdescripcion_l.trim().length > 60) e.xdescripcion_l = 'Máximo 60 caracteres.';
  if (f.xdescripcion_c.trim().length > 15) e.xdescripcion_c = 'Máximo 15 caracteres.';
  if (f.xabreviatura.trim().length > 5) e.xabreviatura = 'Máximo 5 caracteres.';
  if (!f.cmoneda.trim()) e.cmoneda = 'Elige la moneda.';

  for (const campo of ['cramoint', 'ccoberturaint', 'ccontrea', 'cramorea'] as const) {
    const v = f[campo].trim();
    if (v && (!esEntero(v) || Number(v) > 32767)) e[campo] = 'Número entero (o déjalo vacío).';
  }

  const ctar = f.ctarifa.trim();
  if (!ctar) e.ctarifa = 'Indica el código de la tarifa.';
  else if (!/^[A-Za-z0-9]{1,4}$/.test(ctar)) e.ctarifa = 'Hasta 4 letras o números.';
  const xtm = (f.xtarifam.trim() || nombreCortoPorDefecto(f)).trim();
  if (!xtm) e.xtarifam = 'Indica el nombre corto de la tarifa.';
  else if (xtm.length > 15) e.xtarifam = 'Máximo 15 caracteres.';

  if (!FECHA.test(f.fdesde)) e.fdesde = 'Fecha inválida.';
  if (f.fhasta && !FECHA.test(f.fhasta)) e.fhasta = 'Fecha inválida.';
  else if (f.fhasta && FECHA.test(f.fdesde) && f.fhasta < f.fdesde) {
    e.fhasta = 'Debe ser igual o posterior a «Vigente desde».';
  }

  if (!esNumero(f.msumamax) || Number(f.msumamax) <= 0) e.msumamax = 'La suma máxima debe ser mayor a 0.';
  if (f.msumamin.trim()) {
    if (!esNumero(f.msumamin) || Number(f.msumamin) < 0) e.msumamin = 'Debe ser 0 o mayor.';
    else if (esNumero(f.msumamax) && Number(f.msumamin) > Number(f.msumamax)) {
      e.msumamin = 'No puede superar la suma máxima.';
    }
  }
  if (!e.msumamax && decimales(f.msumamax) > 2) e.msumamax = 'Máximo 2 decimales.';
  if (!e.msumamin && decimales(f.msumamin) > 2) e.msumamin = 'Máximo 2 decimales.';
  if (f.modo === 'tasa') {
    if (!esNumero(f.pprima) || Number(f.pprima) <= 0) e.pprima = 'La tasa debe ser mayor a 0.';
    else if (Number(f.pprima) > 100) e.pprima = 'La tasa es un porcentaje (máx. 100).';
    else if (decimales(f.pprima) > 6) e.pprima = 'Máximo 6 decimales.';
  } else if (!esNumero(f.mprima) || Number(f.mprima) <= 0) {
    e.mprima = 'La prima fija debe ser mayor a 0.';
  } else if (decimales(f.mprima) > 2) {
    e.mprima = 'Máximo 2 decimales.';
  }
  return e;
}

/** Nombre corto de la tarifa si no se escribe: descripción corta o los primeros 15 del nombre. */
export function nombreCortoPorDefecto(f: NuevaCoberturaForm): string {
  return (f.xdescripcion_c.trim() || f.xdescripcion_l.trim()).slice(0, 15).trim();
}

const entero = (v: string) => (v.trim() ? Number(v.trim()) : undefined);

/** Cuerpo de POST /core/sis2000/coberturas (→ CrearCoberturaDto). */
export function payloadCobertura(cramo: number, f: NuevaCoberturaForm): Record<string, unknown> {
  return {
    cramo,
    ccobertura: f.ccobertura.trim().toUpperCase(),
    xdescripcion_l: f.xdescripcion_l.trim().toUpperCase(),
    xdescripcion_c: f.xdescripcion_c.trim().toUpperCase() || undefined,
    xabreviatura: f.xabreviatura.trim().toUpperCase() || undefined,
    bobligatoria: f.obligatoria,
    cmoneda: f.cmoneda.trim(),
    cramoint: entero(f.cramoint),
    ccoberturaint: entero(f.ccoberturaint),
    ccontrea: entero(f.ccontrea),
    cramorea: entero(f.cramorea),
  };
}

/** Cuerpo de POST /core/sis2000/tarifas con su detalle vigente (→ CrearTarifaDto). */
export function payloadTarifa(cramo: number, f: NuevaCoberturaForm): Record<string, unknown> {
  const detalle: Record<string, unknown> = {
    fdesde: f.fdesde,
    fhasta: f.fhasta || undefined,
    msumamin: f.msumamin.trim() ? Number(f.msumamin) : 0,
    msumamax: Number(f.msumamax),
    pprima: f.modo === 'tasa' ? Number(f.pprima) : 0,
    mprima: f.modo === 'prima' ? Number(f.mprima) : 0,
  };
  return {
    cramo,
    ccober: f.ccobertura.trim().toUpperCase(),
    ctarifa: f.ctarifa.trim().toUpperCase(),
    xtarifam: (f.xtarifam.trim() || nombreCortoPorDefecto(f)).toUpperCase(),
    xtarifa: f.xdescripcion_l.trim().toUpperCase(),
    bobligatoria: f.obligatoria,
    detalles: [detalle],
  };
}
