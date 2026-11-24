// Ficha de una cobertura del ramo en el asistente de planes («Ver / editar»): datos legibles de macoberturas,
// resumen de sus tarifas (matarifa + matarifa_d), avisos y los cambios que se mandan al editarla.
// Funciones puras y sin dependencias: se prueban con `npm test -w frontend` (node --test).

import { deducibleDeFila, fechaIso, type DeducibleForm } from './configurador.ts';

type Fila = Record<string, unknown>;

const texto = (v: unknown) => (v == null ? '' : String(v).trim());
const numeroONull = (v: unknown): number | null => {
  if (v == null || texto(v) === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const esSi = (v: unknown): boolean | null => {
  if (v == null || texto(v) === '') return null;
  if (typeof v === 'boolean') return v;
  return ['T', 'S', '1', 'TRUE', 'Y'].includes(texto(v).toUpperCase());
};
/** Código entero mayor que 0 (0 o vacío = no tiene). */
const codigo = (v: unknown): number | null => {
  const n = numeroONull(v);
  return n != null && n > 0 ? n : null;
};

// ── Cobertura (macoberturas) ──

export interface DatosCobertura {
  ccobertura: string;
  nombreLargo: string;
  nombreCorto: string;
  abreviatura: string;
  moneda: string;
  /** Dato de la cobertura en macoberturas (null = no viene). */
  obligatoria: boolean | null;
  activa: boolean;
  contratoReaseguro: number | null;
  ramoReaseguro: number | null;
  ramoInterno: number | null;
  coberturaInterna: number | null;
}

export function datosCobertura(fila: Fila | null | undefined): DatosCobertura {
  const f = fila ?? {};
  return {
    ccobertura: texto(f.ccobertura),
    nombreLargo: texto(f.xdescripcion_l ?? f.xcobertura),
    nombreCorto: texto(f.xdescripcion_c),
    abreviatura: texto(f.xabreviatura),
    moneda: texto(f.cmoneda),
    obligatoria: esSi(f.bobligatoria),
    activa: texto(f.iestado).toUpperCase() !== 'I',
    contratoReaseguro: codigo(f.ccontrea),
    ramoReaseguro: codigo(f.cramorea),
    ramoInterno: codigo(f.cramoint),
    coberturaInterna: codigo(f.ccoberturaint),
  };
}

// ── Tarifas (matarifa + matarifa_d) ──

export interface TasaVigencia {
  fdesde: string;
  fhasta: string;
  /** V (o A) = vigente; I = inactiva. */
  activa: boolean;
  tasa: number | null;
  prima: number | null;
  sumaMin: number | null;
  sumaMax: number | null;
  deducible: DeducibleForm;
  /** Fila tal cual (para el editor). */
  fila: Fila;
}

export interface ResumenTarifa {
  ctarifa: string;
  nombre: string;
  /** matarifa.iestado V: la única que el plan acepta. */
  vigente: boolean;
  obligatoria: boolean;
  /** Tasa vigente hoy (o la más reciente si ninguna lo está). */
  actual: TasaVigencia | null;
  /** La tasa `actual` está vigente hoy. */
  actualVigenteHoy: boolean;
  /** Tasas activas (V/A) cuyo rango cubre hoy. */
  vigentesHoy: number;
  /** Resto del historial: más reciente primero, sin `actual`. */
  historial: TasaVigencia[];
}

export function tasaDeFila(d: Fila): TasaVigencia {
  const estado = texto(d.iestado).toUpperCase();
  return {
    fdesde: fechaIso(d.fdesde),
    fhasta: d.fhasta ? fechaIso(d.fhasta) : '',
    activa: estado === 'V' || estado === 'A' || estado === '',
    tasa: numeroONull(d.pprima),
    prima: numeroONull(d.mprima),
    sumaMin: numeroONull(d.msumamin),
    sumaMax: numeroONull(d.msumamax),
    deducible: deducibleDeFila(d),
    fila: d,
  };
}

const cubreHoy = (t: TasaVigencia, hoy: string) => t.activa && t.fdesde <= hoy && (!t.fhasta || t.fhasta >= hoy);

/** Obligatoriedad de la tarifa (matarifa.bobligatoria); la cobertura 1 es la básica y va siempre. */
export function tarifaObligatoria(tarifa: Fila | undefined, ccobertura: string): boolean {
  if (texto(ccobertura) === '1') return true;
  return esSi(tarifa?.bobligatoria) === true;
}

export function resumenTarifa(tarifa: Fila, hoy: string, ccobertura = ''): ResumenTarifa {
  const detalles = (Array.isArray(tarifa.detalles) ? (tarifa.detalles as Fila[]) : []).map(tasaDeFila);
  const orden = [...detalles].sort((a, b) => b.fdesde.localeCompare(a.fdesde));
  const deHoy = orden.filter((t) => cubreHoy(t, hoy));
  const actual = deHoy[0] ?? orden[0] ?? null;
  return {
    ctarifa: texto(tarifa.ctarifa),
    nombre: texto(tarifa.xtarifam ?? tarifa.xtarifa ?? tarifa.xdescripcion_l),
    vigente: texto(tarifa.iestado).toUpperCase() === 'V',
    obligatoria: tarifaObligatoria(tarifa, ccobertura || texto(tarifa.ccober ?? tarifa.ccobertura)),
    actual,
    actualVigenteHoy: deHoy.length > 0,
    vigentesHoy: deHoy.length,
    historial: orden.filter((t) => t !== actual),
  };
}

/** Tarifas vigentes primero; dentro, en el orden en que llegan. */
export function resumenTarifas(tarifas: Fila[], hoy: string, ccobertura = ''): ResumenTarifa[] {
  const out = tarifas.map((t) => resumenTarifa(t, hoy, ccobertura));
  return [...out.filter((t) => t.vigente), ...out.filter((t) => !t.vigente)];
}

// ── Avisos ──

export type NivelAviso = 'error' | 'aviso';

export interface AvisoCobertura {
  nivel: NivelAviso;
  texto: string;
}

export interface EntradaAvisos {
  cobertura: Fila;
  /** null = todavía no se leyeron (no se avisa nada de tarifas). */
  tarifas: Fila[] | null;
  hoy: string;
  /** Suma calculada al emitir: no hace falta suma máxima en la tarifa. */
  calculada?: boolean;
  /** Personas: el precio sale de la tabla por edad (no se avisa por tasa/prima en 0). */
  personas?: boolean;
}

const etiquetaTarifa = (t: ResumenTarifa, varias: boolean) =>
  varias ? `La tarifa ${t.ctarifa}${t.nombre ? ` (${t.nombre})` : ''}` : 'Su tarifa';

/** Lo que falta o no cuadra en la cobertura, primero lo que impide usarla. */
export function avisosCobertura({ cobertura, tarifas, hoy, calculada = false, personas = false }: EntradaAvisos): AvisoCobertura[] {
  const avisos: AvisoCobertura[] = [];
  const c = datosCobertura(cobertura);
  if (!c.activa) avisos.push({ nivel: 'aviso', texto: 'La cobertura está inactiva en el ramo: no aparece para planes nuevos.' });
  if (!c.nombreLargo) avisos.push({ nivel: 'aviso', texto: 'La cobertura no tiene nombre.' });
  if (tarifas) {
    const resumen = resumenTarifas(tarifas, hoy, c.ccobertura);
    const vigentes = resumen.filter((t) => t.vigente);
    if (!resumen.length) {
      avisos.push({ nivel: 'error', texto: 'No tiene tarifas: no se puede usar en un plan hasta que Técnica le cargue una.' });
    } else if (!vigentes.length) {
      avisos.push({ nivel: 'error', texto: 'Sin tarifa vigente: no se puede usar todavía (todas sus tarifas están inactivas).' });
    } else if (vigentes.length > 1) {
      avisos.push({
        nivel: 'aviso',
        texto: `Tiene ${vigentes.length} tarifas vigentes: el asistente toma la primera. Revisa cuál corresponde a este plan.`,
      });
    }
    const varias = vigentes.length > 1;
    for (const t of vigentes) {
      const quien = etiquetaTarifa(t, varias);
      if (!t.actual) {
        avisos.push({ nivel: 'error', texto: `${quien} no tiene ninguna tasa cargada (suma, tasa o prima).` });
        continue;
      }
      if (!t.actualVigenteHoy) {
        const ultima = t.actual.fhasta ? ` (la última venció el ${fechaLegible(t.actual.fhasta)})` : '';
        avisos.push({ nivel: 'error', texto: `${quien} no tiene una tasa vigente hoy${ultima}.` });
      } else if (t.vigentesHoy > 1) {
        avisos.push({ nivel: 'aviso', texto: `${quien} tiene ${t.vigentesHoy} tasas vigentes a la vez: se usa la de fecha más reciente.` });
      }
      const a = t.actual;
      if (!calculada && !personas && !(Number(a.sumaMax) > 0)) {
        avisos.push({ nivel: 'aviso', texto: `${quien} no tiene suma asegurada máxima.` });
      }
      if (a.sumaMin != null && a.sumaMax != null && a.sumaMax > 0 && a.sumaMin > a.sumaMax) {
        avisos.push({ nivel: 'aviso', texto: `${quien}: la suma mínima es mayor que la máxima.` });
      }
      if (!personas && !(Number(a.tasa) > 0) && !(Number(a.prima) > 0)) {
        avisos.push({ nivel: 'aviso', texto: `${quien} no tiene tasa ni prima: la cobertura saldría sin costo.` });
      }
    }
  }
  if (c.contratoReaseguro == null) {
    avisos.push({ nivel: 'aviso', texto: 'Sin contrato de reaseguro: pide a Técnica que lo indique si la cobertura lo lleva.' });
  }
  return [...avisos.filter((a) => a.nivel === 'error'), ...avisos.filter((a) => a.nivel === 'aviso')];
}

/** AAAA-MM-DD → dd/mm/aaaa (lo demás tal cual). */
export function fechaLegible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto(iso);
}

// ── Edición de la cobertura (PATCH v1/configurador/coberturas) ──

/** Lo que se puede cambiar de una cobertura desde el asistente (lo demás no lo acepta nest-api al editar). */
export interface CoberturaEditable {
  xdescripcion_l: string;
  xdescripcion_c: string;
  xabreviatura: string;
  activa: boolean;
  ccontrea: string;
  cramorea: string;
}

export function coberturaEditable(fila: Fila | null | undefined): CoberturaEditable {
  const c = datosCobertura(fila);
  return {
    xdescripcion_l: c.nombreLargo,
    xdescripcion_c: c.nombreCorto,
    xabreviatura: c.abreviatura,
    activa: c.activa,
    ccontrea: c.contratoReaseguro == null ? '' : String(c.contratoReaseguro),
    cramorea: c.ramoReaseguro == null ? '' : String(c.ramoReaseguro),
  };
}

export const ETIQUETAS_COBERTURA: Record<keyof CoberturaEditable, string> = {
  xdescripcion_l: 'Nombre',
  xdescripcion_c: 'Nombre corto',
  xabreviatura: 'Abreviatura',
  activa: 'Estado',
  ccontrea: 'Contrato de reaseguro',
  cramorea: 'Ramo de reaseguro',
};

export type ErroresCobertura = Partial<Record<keyof CoberturaEditable, string>>;

export function validarCoberturaEditable(f: CoberturaEditable): ErroresCobertura {
  const e: ErroresCobertura = {};
  if (!f.xdescripcion_l.trim()) e.xdescripcion_l = 'El nombre es obligatorio.';
  else if (f.xdescripcion_l.trim().length > 60) e.xdescripcion_l = `Tiene ${f.xdescripcion_l.trim().length} caracteres; el máximo es 60. Acórtalo.`;
  // Mismos límites que el alta de cobertura (sis2000-nueva-cobertura).
  if (f.xdescripcion_c.trim().length > 15) e.xdescripcion_c = 'El nombre corto admite hasta 15 caracteres.';
  if (f.xabreviatura.trim().length > 5) e.xabreviatura = 'La abreviatura admite hasta 5 caracteres.';
  // Reaseguro obligatorio: vaciarlo rompe la emisión (ccontrea NULL).
  for (const k of ['ccontrea', 'cramorea'] as const) {
    const v = f[k].trim();
    if (!v) e[k] = k === 'ccontrea' ? 'El contrato de reaseguro es obligatorio: sin él la póliza no se puede emitir.' : 'El ramo de reaseguro es obligatorio.';
    else if (!/^[1-9]\d*$/.test(v)) e[k] = 'Debe ser un número entero mayor que 0.';
  }
  return e;
}

export interface CambioCobertura {
  campo: keyof CoberturaEditable;
  etiqueta: string;
  antes: string;
  despues: string;
}

const mostrar = (k: keyof CoberturaEditable, v: string | boolean) =>
  k === 'activa' ? (v ? 'Activa' : 'Inactiva') : texto(v) || '(vacío)';
const normal = (k: keyof CoberturaEditable, v: string | boolean): string | boolean =>
  typeof v === 'boolean' ? v : k.startsWith('x') ? v.trim().toUpperCase() : v.trim();

/** Campos que cambiaron (los nombres se guardan en mayúsculas, como el resto de Sis2000). */
export function cambiosCobertura(antes: CoberturaEditable, despues: CoberturaEditable): CambioCobertura[] {
  return (Object.keys(ETIQUETAS_COBERTURA) as Array<keyof CoberturaEditable>)
    .filter((k) => normal(k, antes[k]) !== normal(k, despues[k]))
    .map((k) => ({ campo: k, etiqueta: ETIQUETAS_COBERTURA[k], antes: mostrar(k, antes[k]), despues: mostrar(k, normal(k, despues[k])) }));
}

/**
 * Cuerpo del PUT /core/sis2000/coberturas/:cramo/:ccobertura solo con lo que cambió. Un texto vacío no se manda
 * (nest-api no borra un nombre corto o una abreviatura: los trata como «sin cambio»); un código vacío va en 0.
 */
export function cuerpoCambiosCobertura(antes: CoberturaEditable, despues: CoberturaEditable): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of cambiosCobertura(antes, despues)) {
    const v = despues[c.campo];
    if (c.campo === 'activa') out.iestado = v ? 'V' : 'I';
    else if (c.campo === 'ccontrea' || c.campo === 'cramorea') out[c.campo] = texto(v) ? Number(texto(v)) : 0;
    else if (texto(v)) out[c.campo] = texto(v).toUpperCase();
  }
  return out;
}

// ── En este plan ──

/** Lo que el asistente tiene armado para la cobertura en el plan (montos como texto del input). */
export interface CoberturaEnPlan {
  /** Marcada en el asistente o ya es del plan que se edita. */
  incluida: boolean;
  /** Ya es parte del plan que se edita (no se quita desde el asistente). */
  delPlan: boolean;
  ctarifa: string;
  msumamin: string;
  msumamax: string;
  pprima: string;
  mprima: string;
  modo: 'tasa' | 'prima';
  obligatoria: boolean;
  /** Personas: tabla de tasas por edad ('' = la del plan). */
  ctablatar?: string;
}
