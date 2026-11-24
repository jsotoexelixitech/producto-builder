// Auto configurable por plan (.antigravity/CONTRATO-AUTO-CONFIGURABLE.md): tasa diaria por tipo de vehículo
// (macatvalores PLAN_TASA_DIARIA) y descuento por deducible (PLAN_DEDUCIBLE). Funciones puras de los formularios: leer
// la respuesta de nest-api, validar lo que escribe el usuario y armar el cuerpo del PUT. nest-api vuelve a validar.

type Obj = Record<string, unknown>;

/** Días por año para la tasa anual equivalente (solo ayuda: la prima la da la tasa diaria). */
export const DIAS_ANIO = 365;
/** Tope de días de alquiler que acepta nest-api. */
export const DIAS_MAX = 366;
/** 409 de nest-api en estos dominios: falta el script del DBA o el cplan ya tiene fila de otro ramo. */
export const TEXTO_409_AUTO =
  'Sis2000 no aceptó el cambio: el dominio todavía no está creado (falta el script del DBA) o este código de plan ya tiene esta configuración en otro ramo. Pide a Técnica que lo revise.';

const txt = (v: unknown) => String(v ?? '').trim();
const numero = (v: string) => (txt(v) === '' ? NaN : Number(txt(v).replace(',', '.')));

/** Lo que devuelve GET planes/:id/auto/<tipo> (envoltorio común de los dos dominios). */
export interface ParametroAuto {
  dominioCreado: boolean;
  existe: boolean;
  activo: boolean | null;
  config: Obj | null;
  errorJson: string | null;
  otroRamo: number | null;
}

export function normalizarParametroAuto(r: unknown): ParametroAuto {
  const o = r && typeof r === 'object' ? (r as Obj) : {};
  const activo = o.activo == null ? null : o.activo === true;
  return {
    dominioCreado: o.dominioCreado !== false,
    existe: o.existe === true,
    activo,
    config: o.config && typeof o.config === 'object' && !Array.isArray(o.config) ? (o.config as Obj) : null,
    errorJson: o.errorJson == null ? null : txt(o.errorJson),
    otroRamo: o.otroRamo == null ? null : Number(o.otroRamo),
  };
}

/** Coberturas guardadas en el JSON (códigos recortados). */
const coberturasDe = (c: Obj | null) => (Array.isArray(c?.coberturas) ? (c!.coberturas as unknown[]).map(txt).filter(Boolean) : []);

// ── Tasa diaria por tipo de vehículo ──────────────────────────────────────────

/** Formulario: tasa por ctipo como texto ('' = ese tipo no cotiza con tasa diaria). */
export interface TasaDiariaForm {
  coberturas: string[];
  tasas: Record<string, string>;
  tasa_defecto: string;
  dias_min: string;
  dias_max: string;
}

export const TASA_DIARIA_VACIA: TasaDiariaForm = { coberturas: [], tasas: {}, tasa_defecto: '', dias_min: '1', dias_max: '365' };

export function tasaDiariaDeConfig(c: Obj | null): TasaDiariaForm {
  if (!c) return { ...TASA_DIARIA_VACIA, tasas: {} };
  const tasas: Record<string, string> = {};
  if (c.tasas && typeof c.tasas === 'object') {
    for (const [k, v] of Object.entries(c.tasas as Obj)) tasas[txt(k)] = v == null ? '' : String(v);
  }
  return {
    coberturas: coberturasDe(c),
    tasas,
    tasa_defecto: c.tasa_defecto == null ? '' : String(c.tasa_defecto),
    dias_min: c.dias_min == null ? '' : String(c.dias_min),
    dias_max: c.dias_max == null ? '' : String(c.dias_max),
  };
}

export type ErroresTasaDiaria = Partial<Record<'coberturas' | 'tasas' | 'tasa_defecto' | 'dias_min' | 'dias_max', string>> & {
  porTipo?: Record<string, string>;
};

const errorTasa = (v: string) => {
  const n = numero(v);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return 'Debe ser mayor que 0 y como máximo 100 (%).';
  return undefined;
};

/** Mismas reglas que nest-api: alguna cobertura, alguna tasa (o por defecto), tasas > 0, días enteros 1..366 y mín ≤ máx. */
export function validarTasaDiaria(f: TasaDiariaForm): ErroresTasaDiaria {
  const e: ErroresTasaDiaria = {};
  if (!f.coberturas.length) e.coberturas = 'Marca al menos una cobertura.';
  const porTipo: Record<string, string> = {};
  const conTasa = Object.entries(f.tasas).filter(([, v]) => txt(v) !== '');
  for (const [ctipo, v] of conTasa) {
    const m = errorTasa(v);
    if (m) porTipo[ctipo] = m;
  }
  if (Object.keys(porTipo).length) e.porTipo = porTipo;
  if (txt(f.tasa_defecto) !== '') {
    const m = errorTasa(f.tasa_defecto);
    if (m) e.tasa_defecto = m;
  }
  if (!conTasa.length && txt(f.tasa_defecto) === '') e.tasas = 'Escribe la tasa de al menos un tipo de vehículo o una tasa por defecto.';
  const dia = (v: string) => {
    const n = numero(v);
    return Number.isInteger(n) && n >= 1 && n <= DIAS_MAX ? n : null;
  };
  const min = dia(f.dias_min);
  const max = dia(f.dias_max);
  if (min == null) e.dias_min = `Entero entre 1 y ${DIAS_MAX}.`;
  if (max == null) e.dias_max = `Entero entre 1 y ${DIAS_MAX}.`;
  if (min != null && max != null && min > max) e.dias_max = 'No puede ser menor que los días mínimos.';
  return e;
}

export const sinErrores = (e: object) => Object.keys(e).length === 0;

/** Cuerpo del PUT: tasas como lista { ctipo, tasa } (solo los tipos con valor). */
export function cuerpoTasaDiaria(f: TasaDiariaForm) {
  return {
    coberturas: [...new Set(f.coberturas.map(txt).filter(Boolean))],
    tasas: Object.entries(f.tasas)
      .filter(([, v]) => txt(v) !== '')
      .map(([ctipo, v]) => ({ ctipo: Number(ctipo), tasa: numero(v) }))
      .sort((a, b) => a.ctipo - b.ctipo),
    tasa_defecto: txt(f.tasa_defecto) === '' ? null : numero(f.tasa_defecto),
    dias_min: numero(f.dias_min),
    dias_max: numero(f.dias_max),
  };
}

/** Tasa anual equivalente (diaria × 365) como texto con 2 decimales; '' si no hay tasa válida. Solo como ayuda. */
export function tasaAnualTexto(diaria: string): string {
  const n = numero(diaria);
  if (!Number.isFinite(n) || n <= 0) return '';
  return (Math.round(n * DIAS_ANIO * 100) / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Descuento por deducible ───────────────────────────────────────────────────

export interface DeduciblesForm {
  coberturas: string[];
  opciones: Array<{ pdeducible: string; pdescuento: string }>;
  obligatorio: boolean;
  aplica: string;
}

export const DEDUCIBLES_VACIO: DeduciblesForm = { coberturas: [], opciones: [], obligatorio: false, aplica: 'PARCIAL' };

export function deduciblesDeConfig(c: Obj | null): DeduciblesForm {
  if (!c) return { ...DEDUCIBLES_VACIO, opciones: [] };
  return {
    coberturas: coberturasDe(c),
    opciones: (Array.isArray(c.opciones) ? (c.opciones as Obj[]) : []).map((o) => ({
      pdeducible: o?.pdeducible == null ? '' : String(o.pdeducible),
      pdescuento: o?.pdescuento == null ? '' : String(o.pdescuento),
    })),
    obligatorio: c.obligatorio === true,
    aplica: txt(c.aplica) || 'PARCIAL',
  };
}

const errorPorcentaje = (v: string) => {
  const n = numero(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 'Entre 0 y 100.';
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return 'Máximo 2 decimales.';
  return undefined;
};

/** Error de una celda de la tabla deducible → descuento (repetidos incluidos). */
export function errorOpcionDeducible(f: DeduciblesForm, i: number, campo: 'pdeducible' | 'pdescuento'): string | undefined {
  const o = f.opciones[i];
  const m = errorPorcentaje(o?.[campo] ?? '');
  if (m || campo === 'pdescuento') return m;
  const n = numero(o.pdeducible);
  return f.opciones.some((x, j) => j < i && numero(x.pdeducible) === n) ? 'Deducible repetido.' : undefined;
}

export function validarDeducibles(f: DeduciblesForm): { coberturas?: string; opciones?: string; filas: Array<Record<string, string>> } {
  const filas = f.opciones.map((_, i) => {
    const e: Record<string, string> = {};
    for (const c of ['pdeducible', 'pdescuento'] as const) {
      const m = errorOpcionDeducible(f, i, c);
      if (m) e[c] = m;
    }
    return e;
  });
  return {
    ...(f.coberturas.length ? {} : { coberturas: 'Marca al menos una cobertura.' }),
    ...(f.opciones.length ? {} : { opciones: 'Agrega al menos una opción de deducible.' }),
    filas,
  };
}

export const deduciblesValidos = (v: ReturnType<typeof validarDeducibles>) =>
  !v.coberturas && !v.opciones && v.filas.every((e) => !Object.keys(e).length);

export function cuerpoDeducibles(f: DeduciblesForm) {
  return {
    coberturas: [...new Set(f.coberturas.map(txt).filter(Boolean))],
    aplica: txt(f.aplica).toUpperCase() || 'PARCIAL',
    opciones: f.opciones.map((o) => ({ pdeducible: numero(o.pdeducible), pdescuento: numero(o.pdescuento) })).sort((a, b) => a.pdeducible - b.pdeducible),
    obligatorio: f.obligatorio,
  };
}

/** Coberturas del plan sin repetir por código (el plan puede listar la misma cobertura con varias tarifas). */
export function coberturasUnicas<T extends { ccobertura: string; nombre: string }>(coberturas: T[]): Array<{ ccobertura: string; nombre: string }> {
  const vistas = new Map<string, string>();
  for (const c of coberturas) if (!vistas.has(txt(c.ccobertura))) vistas.set(txt(c.ccobertura), c.nombre);
  return [...vistas.entries()].map(([ccobertura, nombre]) => ({ ccobertura, nombre }));
}
