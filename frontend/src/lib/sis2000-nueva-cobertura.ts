// Formulario "Nueva cobertura" (macoberturas + matarifa + matarifa_d) para nest-api v1/configurador.
// Una cobertura sin tarifa vigente no se puede usar en un plan, por eso se crean juntas.
import { miles } from '@/lib/errores';
import { cuerpoDeducible, DEDUCIBLE_VACIO, validarDeducible, type DeducibleForm } from '@/lib/configurador';
import {
  validarSumaConfig,
  type Sis2000NestRow,
  type TipoSumaAsegurada,
} from '@/lib/sis2000-nest-api';

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
  /** FIJA = como hoy. CALCULADA = la suma llega al emitir (unidades × valor por unidad). */
  tipoSuma: TipoSumaAsegurada;
  /** Nombre genérico de la unidad en el sistema (opcional). */
  unidadCalculo: string;
  /** Palabra que sale en el cuadro póliza (obligatoria si CALCULADA). */
  etiquetaCuadro: string;
  /** Deducible de la tasa (opcional; «Sin deducible» no envía nada). */
  deducible: DeducibleForm;
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

/**
 * Reaseguro sugerido para una cobertura nueva: el par contrato + ramo de reaseguro más usado por las coberturas
 * activas del ramo (vacío si ninguna lo tiene). Es obligatorio: sin él la emisión graba ccontrea NULL.
 */
export function reaseguroSugerido(existentes: Sis2000NestRow[]): { ccontrea: string; cramorea: string } {
  const cuenta = new Map<string, number>();
  for (const c of existentes) {
    const k = texto(c.ccontrea);
    const r = texto(c.cramorea);
    if (!/^[1-9]\d*$/.test(k) || !/^[1-9]\d*$/.test(r) || texto(c.iestado) === 'I') continue;
    cuenta.set(`${k}|${r}`, (cuenta.get(`${k}|${r}`) ?? 0) + 1);
  }
  const [mejor] = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  if (!mejor) return { ccontrea: '', cramorea: '' };
  const [ccontrea, cramorea] = mejor[0].split('|');
  return { ccontrea, cramorea };
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
    ...reaseguroSugerido(existentes),
    ctarifa: '1',
    xtarifam: '',
    fdesde: hoyLocalIso(),
    fhasta: '2099-12-31',
    msumamin: '',
    msumamax: '',
    modo: 'tasa',
    pprima: '',
    mprima: '',
    tipoSuma: 'FIJA',
    unidadCalculo: '',
    etiquetaCuadro: '',
    deducible: { ...DEDUCIBLE_VACIO },
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
  if (!cod) e.ccobertura = 'Falta el código de la cobertura (se sugiere el siguiente libre del ramo).';
  else if (!/^[A-Za-z0-9]{1,4}$/.test(cod)) e.ccobertura = 'Usa hasta 4 letras o números, sin espacios ni símbolos.';
  else if (existentes.some((c) => texto(c.ccobertura).toUpperCase() === cod.toUpperCase())) {
    e.ccobertura = `El código ${cod} ya lo usa otra cobertura del ramo. Usa otro (por ejemplo, el siguiente número libre).`;
  }

  if (!f.xdescripcion_l.trim()) e.xdescripcion_l = 'Escribe el nombre de la cobertura como debe salir en la póliza.';
  else if (f.xdescripcion_l.trim().length > 60) e.xdescripcion_l = `Tiene ${f.xdescripcion_l.trim().length} caracteres; el máximo es 60. Acórtalo.`;
  if (f.xdescripcion_c.trim().length > 15) e.xdescripcion_c = 'El nombre corto admite hasta 15 caracteres.';
  if (f.xabreviatura.trim().length > 5) e.xabreviatura = 'La abreviatura admite hasta 5 caracteres.';
  if (!f.cmoneda.trim()) e.cmoneda = 'Elige la moneda de la suma y la prima.';

  for (const campo of ['cramoint', 'ccoberturaint'] as const) {
    const v = f[campo].trim();
    if (v && (!esEntero(v) || Number(v) > 32767)) e[campo] = 'Debe ser un número entero sin decimales (o déjalo vacío).';
  }
  // Reaseguro obligatorio: sin contrato ni ramo de reaseguro la emisión graba ccontrea NULL y falla.
  for (const campo of ['ccontrea', 'cramorea'] as const) {
    const v = f[campo].trim();
    if (!v) e[campo] = campo === 'ccontrea' ? 'Indica el contrato de reaseguro (lo da Reaseguro): sin él la póliza no se puede emitir.' : 'Indica el ramo de reaseguro del contrato (lo da Reaseguro).';
    else if (!esEntero(v) || Number(v) < 1 || Number(v) > 32767) e[campo] = 'Debe ser un número entero mayor que 0.';
  }

  const ctar = f.ctarifa.trim();
  if (!ctar) e.ctarifa = 'Falta el código de la tarifa (lo normal es 1).';
  else if (!/^[A-Za-z0-9]{1,4}$/.test(ctar)) e.ctarifa = 'Usa hasta 4 letras o números (lo normal es 1).';
  const xtm = (f.xtarifam.trim() || nombreCortoPorDefecto(f)).trim();
  if (!xtm) e.xtarifam = 'Escribe un nombre interno para la tarifa (o el nombre de la cobertura).';
  else if (xtm.length > 15) e.xtarifam = 'El nombre interno de la tarifa admite hasta 15 caracteres.';

  if (!FECHA.test(f.fdesde)) e.fdesde = 'Elige desde qué fecha vale este precio.';
  if (f.fhasta && !FECHA.test(f.fhasta)) e.fhasta = 'La fecha no es válida; elígela en el calendario o déjala vacía.';
  else if (f.fhasta && FECHA.test(f.fdesde) && f.fhasta < f.fdesde) {
    e.fhasta = 'La fecha «hasta» es anterior a «desde». Corrígela o déjala vacía si no tiene fin.';
  }

  // Con suma calculada al emitir la suma máxima y la tasa/prima de la tarifa son opcionales (0 si vacías).
  const calculada = f.tipoSuma === 'CALCULADA';
  Object.assign(e, validarSumaConfig(f));
  if (calculada) {
    if (f.msumamax.trim() && (!esNumero(f.msumamax) || Number(f.msumamax) < 0)) e.msumamax = 'La suma máxima no puede ser negativa (déjala vacía o en 0).';
  } else if (!f.msumamax.trim()) {
    e.msumamax = 'Escribe la suma asegurada máxima (por ejemplo, 50.000).';
  } else if (!esNumero(f.msumamax) || Number(f.msumamax) <= 0) {
    e.msumamax = 'La suma asegurada máxima debe ser mayor a 0.';
  }
  if (f.msumamin.trim()) {
    if (!esNumero(f.msumamin) || Number(f.msumamin) < 0) e.msumamin = 'La suma mínima no puede ser negativa (déjala vacía para 0).';
    else if (esNumero(f.msumamax) && Number(f.msumamin) > Number(f.msumamax)) {
      e.msumamin = `La suma mínima (${miles(Number(f.msumamin))}) no puede ser mayor que la máxima (${miles(Number(f.msumamax))}). Inviértelas o, si es una suma fija, pon el mismo monto en ambas.`;
    }
  }
  if (!e.msumamax && decimales(f.msumamax) > 2) e.msumamax = 'La suma admite hasta 2 decimales.';
  if (!e.msumamin && decimales(f.msumamin) > 2) e.msumamin = 'La suma admite hasta 2 decimales.';
  if (f.modo === 'tasa') {
    if (calculada && !f.pprima.trim()) {
      // opcional
    } else if (!esNumero(f.pprima) || Number(f.pprima) <= 0) e.pprima = 'Escribe la tasa en % y mayor a 0 (por ejemplo, 0.5 para 0,5 %). Si cobra un monto fijo, elige «Prima fija».';
    else if (Number(f.pprima) > 100) e.pprima = `La tasa es un porcentaje: ${miles(Number(f.pprima))} % es más de 100 %. ¿Querías escribir una prima fija?`;
    else if (decimales(f.pprima) > 6) e.pprima = 'La tasa admite hasta 6 decimales.';
  } else if (calculada && !f.mprima.trim()) {
    // opcional
  } else if (!esNumero(f.mprima) || Number(f.mprima) <= 0) {
    e.mprima = 'Escribe la prima fija, mayor a 0 (por ejemplo, 25). Si cobra un % de la suma, elige «Tasa %».';
  } else if (decimales(f.mprima) > 2) {
    e.mprima = 'La prima fija admite hasta 2 decimales.';
  }
  const deducible = Object.values(validarDeducible(f.deducible ?? DEDUCIBLE_VACIO))[0];
  if (deducible) e.deducible = deducible;
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
    msumamax: f.msumamax.trim() ? Number(f.msumamax) : 0,
    pprima: f.modo === 'tasa' && f.pprima.trim() ? Number(f.pprima) : 0,
    mprima: f.modo === 'prima' && f.mprima.trim() ? Number(f.mprima) : 0,
    ...cuerpoDeducible(f.deducible ?? DEDUCIBLE_VACIO),
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

/** Cuerpo de PUT /core/sis2000/suma-config/:cramo/:ccobertura (Postgres del configurador, no Sis2000). */
export function payloadSumaConfig(f: Pick<NuevaCoberturaForm, 'tipoSuma' | 'unidadCalculo' | 'etiquetaCuadro'>) {
  return {
    tipoSuma: f.tipoSuma,
    unidadCalculo: f.unidadCalculo.trim() || undefined,
    etiquetaCuadro: f.etiquetaCuadro.trim() || undefined,
  };
}
