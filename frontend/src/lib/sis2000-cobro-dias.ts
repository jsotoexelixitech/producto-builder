/**
 * Tipo de emisión «Cobro por días» del plan: prima diaria por cobertura × días de vigencia (con calendario al emitir).
 * Aditivo: si el plan no lo activa, emite como siempre (por frecuencia).
 */

export interface CobroDiasPrima {
  ccober: string;
  prima_diaria: number;
}

export interface CobroDiasConfig {
  cramo: number;
  cplan: string;
  activo: boolean;
  dias_min: number;
  dias_max: number;
  cmoneda: string | null;
  primas: CobroDiasPrima[];
  prima_diaria_total: number;
}

export interface CobroDiasCotizacion {
  dias: number;
  prima_diaria_total: number;
  prima_total: number;
  coberturas: Array<{ ccober: string; prima_diaria: number; prima: number }>;
}

/** Lo que se edita en pantalla (montos como texto del input). */
export interface CobroDiasForm {
  activo: boolean;
  dias_min: string;
  dias_max: string;
  cmoneda: string;
  primas: Record<string, string>;
}

export const COBRO_DIAS_FORM_DEFAULT = (cmoneda = '$'): CobroDiasForm => ({
  activo: false,
  dias_min: '1',
  dias_max: '15',
  cmoneda,
  primas: {},
});

export const claveCober = (v: unknown) => String(v ?? '').trim().toUpperCase();

export function cobroDiasAForm(c: CobroDiasConfig | null, cmonedaDefault = '$'): CobroDiasForm {
  if (!c) return COBRO_DIAS_FORM_DEFAULT(cmonedaDefault);
  const primas: Record<string, string> = {};
  for (const p of c.primas ?? []) primas[claveCober(p.ccober)] = String(p.prima_diaria ?? '');
  return {
    activo: c.activo === true,
    dias_min: String(c.dias_min ?? 1),
    dias_max: String(c.dias_max ?? 15),
    cmoneda: String(c.cmoneda ?? cmonedaDefault).trim() || cmonedaDefault,
    primas,
  };
}

const numero = (v: string) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

export function totalDiario(f: CobroDiasForm, coberturas: string[]): number {
  return coberturas.reduce((s, c) => s + (numero(f.primas[c] ?? '') || 0), 0);
}

/** Errores del formulario (vacío = se puede guardar). Desactivado no exige nada. */
export function validarCobroDias(f: CobroDiasForm, coberturas: string[]): string[] {
  if (!f.activo) return [];
  const e: string[] = [];
  const min = numero(f.dias_min);
  const max = numero(f.dias_max);
  if (!Number.isInteger(min) || min < 1) e.push('Los días mínimos deben ser un número entero mayor o igual a 1.');
  if (!Number.isInteger(max) || max < 1) e.push('Los días máximos deben ser un número entero mayor o igual a 1.');
  else if (Number.isInteger(min) && max < min) e.push('Los días máximos no pueden ser menores que los mínimos.');
  if (!f.cmoneda.trim()) e.push('Elige la moneda.');
  if (!coberturas.length) e.push('El plan no tiene coberturas a las que poner prima diaria.');
  const negativas = coberturas.filter((c) => {
    const n = numero(f.primas[c] ?? '');
    return (f.primas[c] ?? '').trim() !== '' && (Number.isNaN(n) || n < 0);
  });
  if (negativas.length) e.push(`Prima diaria inválida en: ${negativas.join(', ')}.`);
  if (!(totalDiario(f, coberturas) > 0)) e.push('Al menos una cobertura debe tener prima diaria mayor que 0.');
  return e;
}

/** Cuerpo del PUT. Desactivado conserva lo escrito para poder reactivarlo después. */
export function cobroDiasFormAPayload(f: CobroDiasForm, coberturas: string[]) {
  return {
    activo: f.activo,
    dias_min: Math.trunc(numero(f.dias_min)) || 1,
    dias_max: Math.trunc(numero(f.dias_max)) || 15,
    cmoneda: f.cmoneda.trim() || undefined,
    primas: coberturas.map((c) => ({ ccober: c, prima_diaria: numero(f.primas[c] ?? '') || 0 })),
  };
}

/** Días inclusivos entre dos fechas YYYY-MM-DD (igual que nest-api); NaN si falta alguna. */
export function diasEntre(fdesde: string, fhasta: string): number {
  if (!fdesde || !fhasta) return NaN;
  const a = Date.parse(`${fdesde}T00:00:00Z`);
  const b = Date.parse(`${fhasta}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}
