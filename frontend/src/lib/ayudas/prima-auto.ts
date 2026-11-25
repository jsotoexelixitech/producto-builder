// Estimado de prima de auto con tasa diaria (funciones puras, se prueban con `npm test -w frontend`).
// Es solo una ayuda: la prima oficial la calcula Sis2000 al cotizar.

export interface EntradaEstimado {
  /** Suma asegurada. */
  suma: number;
  /** Tasa diaria en porcentaje: 0,072 significa 0,072 % por día. */
  tasaDiariaPct: number;
  /** Días de vigencia. */
  dias: number;
  /** Descuento por deducible en porcentaje (0 = sin deducible). */
  descuentoPct?: number;
}

export interface Estimado {
  /** suma × tasa/100 × días. */
  primaBase: number;
  /** Lo que baja la prima por el deducible. */
  descuento: number;
  /** Prima después del descuento. */
  primaFinal: number;
}

const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Número escrito por la persona («0,072» o «0.072») → número; NaN si no es un número. */
export function aNumeroEs(texto: string): number {
  const t = texto.trim().replace(/\s/g, '');
  if (!t) return NaN;
  // «1.234,56» y «20.000» (miles) → 1234.56 y 20000; «0,072» y «0.072» → 0.072
  const conMiles = t.includes(',') || /^[1-9]\d{0,2}(\.\d{3})+$/.test(t);
  const normal = conMiles ? t.replace(/\./g, '').replace(',', '.') : t;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}

/** Estimado de prima; null si falta algún dato o no es válido (suma o días en cero, tasa negativa, descuento fuera de 0 a 100). */
export function estimarPrimaAuto(e: EntradaEstimado): Estimado | null {
  const { suma, tasaDiariaPct, dias } = e;
  const descuentoPct = e.descuentoPct ?? 0;
  if (![suma, tasaDiariaPct, dias, descuentoPct].every(Number.isFinite)) return null;
  if (suma <= 0 || tasaDiariaPct < 0 || dias <= 0 || descuentoPct < 0 || descuentoPct > 100) return null;
  const primaBase = redondear((suma * tasaDiariaPct * dias) / 100);
  const descuento = redondear((primaBase * descuentoPct) / 100);
  return { primaBase, descuento, primaFinal: redondear(primaBase - descuento) };
}
