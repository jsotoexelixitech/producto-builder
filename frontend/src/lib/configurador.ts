// Configurador reutilizable de planes (fase 1, auto primero). Contrato: .antigravity/CONTRATO-CONFIGURADOR-AUTO.md.
// Funciones puras y sin dependencias: se prueban con `npm test -w frontend` (node --test).
// Lo propio de cada familia (auto, personas, cosas) llega como «secciones» desde GET ramos/:cramo: aquí no se decide
// nada por número de ramo.

/** 'cosas' = respuesta de la fase 1 (hoy 'patrimonial'); 'fianzas' es solo lectura (sin emisión Nexus). */
export type FamiliaRamo = 'auto' | 'personas' | 'cosas' | 'patrimonial' | 'fianzas';

const FAMILIAS: FamiliaRamo[] = ['auto', 'personas', 'cosas', 'patrimonial', 'fianzas'];
/** Familia conocida o 'cosas' (lo que el configurador trata como ramo de cosas). */
export const familiaValida = (v: unknown): FamiliaRamo => {
  const f = String(v ?? '').trim() as FamiliaRamo;
  return FAMILIAS.includes(f) ? f : 'cosas';
};
/** Patrimonial y cosas son lo mismo para la pantalla (cosas es el nombre de la fase 1). */
export const esPatrimonial = (f: FamiliaRamo | null | undefined) => f === 'patrimonial' || f === 'cosas';

export interface RamoConfigurador {
  cramo: number;
  xdescripcion_l: string;
  familia: FamiliaRamo;
  secciones: string[];
  /** Personas con planes solo en la póliza plantilla de Técnica. */
  colectivo: boolean;
  /** Qué emisión de Nexus le sirve (null = ninguna). */
  emisionNexus: string | null;
  /** 'activo' | 'sin-planes' | 'inactivo' ('' si nest-api no lo manda). */
  estado: string;
  /** Fianzas u otro ramo que nest-api marca de solo lectura: se ocultan las acciones de escritura. */
  soloLectura: boolean;
  /** Avisos de nest-api para el ramo. */
  avisos: string[];
}

/** Secciones genéricas del contrato (§1), en su orden fijo. Solo se usan si nest-api no responde GET ramos/:cramo. */
export const SECCIONES_BASE = ['producto', 'plan', 'coberturas', 'tarifas', 'deducibles', 'frecuencias', 'quien-vende', 'comisiones', 'revision'];

/** Cómo se llama cada sección en pantalla; `tabla` va solo en la ayuda (no en el texto principal). */
export interface InfoSeccion {
  titulo: string;
  resumen: string;
  tabla: string;
  /** Qué es y para qué sirve, en lenguaje sencillo (sin nombres de tablas). */
  ayuda?: string;
  /** Ejemplo corto con números. */
  ejemplo?: string;
  /** true = lo que se guarda vale para TODOS los planes del ramo, no solo para este plan. */
  afectaRamo?: boolean;
}

const SECCION_INFO_BASE: Record<string, { titulo: string; resumen: string; tabla: string }> = {
  coberturas: { titulo: 'Coberturas', resumen: 'Qué cubre el plan, con qué suma y a qué tasa o prima', tabla: 'maplancob / maplantar' },
  tarifas: { titulo: 'Tarifas y tasas', resumen: 'Tasa o prima base de cada cobertura (una sola vigente por tarifa)', tabla: 'matarifa / matarifa_d' },
  deducibles: { titulo: 'Deducibles', resumen: 'Monto o % que asume el asegurado en cada siniestro', tabla: 'matarifa_d / maplancob (auto: descuento por deducible en macatvalores PLAN_DEDUCIBLE)' },
  frecuencias: { titulo: 'Formas de pago', resumen: 'Cómo se fracciona el pago: anual, semestral, trimestral, mensual…', tabla: 'maplanes_frec' },
  canales: { titulo: 'Quién lo vende', resumen: 'Productores y canales que pueden emitir el plan', tabla: 'mausuplan' },
  comisiones: { titulo: 'Comisiones', resumen: '% de la prima para el productor; sin comisión cargada queda en 0 %', tabla: 'maarancel' },
  'tipos-uso': { titulo: 'Tipo y uso del vehículo', resumen: 'Prima base de RCV y sumas por tipo y uso; afecta a todos los planes del ramo', tabla: 'macattip' },
  'tasas-antiguedad': { titulo: 'Tasa por antigüedad', resumen: 'Tasa de casco según los años del vehículo; fuera de tramo no cotiza', tabla: 'maplantar_ano' },
  producto: { titulo: 'Producto', resumen: 'Producto al que pertenece el plan y qué tipo de intermediario lo usa', tabla: 'maproductos' },
  'quien-vende': { titulo: 'Quién lo vende', resumen: 'Productores, canales y gestores incluidos o excluidos del plan', tabla: 'mausuplan' },
  'tasa-casco': { titulo: 'Tasa de casco', resumen: 'Tasa de casco por tipo, suma y antigüedad; afecta a todos los planes del ramo', tabla: 'macalcasco / macobtipo / marangosum / marangoano' },
  'tarifa-dias': {
    titulo: 'Tarifa por días',
    resumen: 'Prima según los días de vigencia: tabla del Binacional o tasa diaria por tipo de vehículo',
    tabla: 'maplantar_dias / macatvalores PLAN_TASA_DIARIA',
  },
  'edades-parentesco': { titulo: 'Edades por parentesco', resumen: 'Edad mínima y máxima de entrada por parentesco', tabla: 'mapledades_per' },
  'tablas-edad': { titulo: 'Tablas de edad', resumen: 'Prima o tasa por tramo de edad; fuera de tramo la prima queda en 0', tabla: 'mapltabedad' },
  proveedores: { titulo: 'Proveedores', resumen: 'Proveedores de servicio del plan (grúa, clínicas, asistencia…)', tabla: 'maplprov_per' },
  'descuentos-recargos': { titulo: 'Descuentos y recargos', resumen: 'Descuento por dispositivos de seguridad y recargo por sustancias peligrosas (por ramo)', tabla: 'madisseg / masustac' },
  condominio: { titulo: 'Condominio', resumen: 'Tasas por antigüedad del inmueble, reparto de la prima y rango de tasa del ramo', tabla: 'MATARIFA_ANTIGUEDAD_NEXUS / MATARIFA_REPARTO_NEXUS / MATARIFA_RANGO_NEXUS' },
  revision: { titulo: 'Revisión', resumen: '¿El plan se puede emitir? Revisa lo que falta, sin cambiar nada', tabla: '' },
  /** La revisión usa «plan» para la cabecera (código, producto): se corrige en el formulario del plan. */
  plan: { titulo: 'Datos del plan', resumen: 'Nombre, código, producto, moneda y estado', tabla: 'maplanes / maplanes_per' },
};

/**
 * Secciones que ya resuelve el asistente de planes existente (Combos: producto → coberturas → tarifas → datos del plan,
 * con formas de pago y quién lo vende). El flujo «Nuevo plan» sigue después con el resto de las secciones del ramo.
 */
export const SECCIONES_DEL_ASISTENTE_DE_PLAN = ['producto', 'plan', 'coberturas', 'tarifas', 'frecuencias', 'canales', 'quien-vende'];

/** Pasos del flujo «Nuevo plan» que se hacen en el asistente de planes (antes de que exista el plan). */
export const PASOS_PREVIOS_NUEVO_PLAN = [
  { id: 'producto', titulo: 'Producto', resumen: 'Ramo y producto del plan' },
  { id: 'coberturas-tarifas', titulo: 'Coberturas y tarifas', resumen: 'Qué cubre y cuánto cuesta (con deducible)' },
  { id: 'plan', titulo: 'Datos del plan', resumen: 'Nombre, vigencia, formas de pago y quién lo vende' },
];

/** Pasos que siguen después de guardar el plan: las secciones del ramo que no resuelve el asistente de planes. */
export function pasosDespuesDelPlan(secciones: string[]): string[] {
  return secciones.filter((s) => !SECCIONES_DEL_ASISTENTE_DE_PLAN.includes(s));
}

/** Ayudas en lenguaje sencillo por sección: qué es, para qué sirve y un ejemplo. */
const AYUDAS_SECCION: Record<string, { ayuda: string; ejemplo?: string; afectaRamo?: boolean }> = {
  coberturas: {
    ayuda: 'Lista lo que el plan paga cuando ocurre un siniestro, con la suma máxima y cómo se cobra cada una.',
    ejemplo: 'Casco con suma de 20.000 y tasa de 3 %.',
  },
  tarifas: { ayuda: 'Define el precio base de cada cobertura. Debe haber una sola tasa vigente por tarifa.', ejemplo: 'Responsabilidad civil con prima fija de 150.' },
  deducibles: {
    ayuda: 'Es la parte del daño que paga el asegurado de su bolsillo. En automóvil, elegir un deducible mayor puede dar un descuento en la prima.',
    ejemplo: 'Deducible de 5 % con descuento de 45 %: una prima de 432 baja a 237,60.',
  },
  frecuencias: { ayuda: 'Cómo puede pagar el cliente: de contado o en cuotas.', ejemplo: 'Anual, semestral o trimestral.' },
  canales: { ayuda: 'Quién puede ofrecer y emitir este plan, y quién queda excluido.', ejemplo: 'Todos los productores, menos uno.' },
  'quien-vende': {
    ayuda: 'Quién puede ofrecer y emitir este plan. Aquí también se marcan los productores que comparten una póliza (mancomunados).',
    ejemplo: 'Dos productores mancomunados: 60 % y 40 % de la póliza.',
  },
  comisiones: { ayuda: 'Porcentaje de la prima que gana el productor. Sin comisión cargada queda en 0 %.', ejemplo: '12 % de una prima de 1.000 = 120.' },
  'tipos-uso': {
    ayuda: 'Prima base y sumas según el tipo de vehículo y su uso. Vale para todos los planes del ramo, no solo para este.',
    ejemplo: 'Automóvil particular: prima base de RCV de 85.',
    afectaRamo: true,
  },
  'tasas-antiguedad': {
    ayuda: 'La tasa de casco cambia según los años del vehículo. Si el vehículo cae fuera de los tramos, no se puede cotizar.',
    ejemplo: '0 a 5 años: 3 %; 6 a 10 años: 4 %.',
  },
  'tasa-casco': {
    ayuda: 'Tasa de casco por tipo de vehículo, rango de suma y antigüedad. Vale para todos los planes del ramo, no solo para este.',
    ejemplo: 'Camioneta de 0 a 5 años con suma hasta 30.000: 3,5 %.',
    afectaRamo: true,
  },
  'tarifa-dias': {
    ayuda: 'Para planes que cobran según los días de vigencia: la prima sale de la suma, la tasa diaria y los días.',
    ejemplo: 'Suma 20.000, tasa diaria 0,072 %, 30 días = 432. Con deducible de 5 % (descuento de 45 %) = 237,60.',
  },
  'edades-parentesco': { ayuda: 'Edad mínima y máxima con que puede entrar cada tipo de asegurado.', ejemplo: 'Titular de 18 a 64 años; hijos de 0 a 25.' },
  'tablas-edad': { ayuda: 'Prima o tasa según la edad del asegurado. Si una edad no cae en ningún tramo, la prima queda en 0.', ejemplo: '30 a 39 años: prima de 120.' },
  proveedores: { ayuda: 'Proveedores de servicio del plan (grúa, clínicas, asistencia…). Se copia a cada póliza que se emita con este plan.', ejemplo: 'Grúa de la red de asistencia vial.' },
  'descuentos-recargos': {
    ayuda: 'Descuento si el vehículo tiene dispositivos de seguridad y recargo si transporta sustancias peligrosas. Vale para todos los planes del ramo.',
    ejemplo: 'Alarma satelital: 5 % de descuento.',
    afectaRamo: true,
  },
  condominio: { ayuda: 'Tasas según la antigüedad del inmueble y cómo se reparte la prima entre las partes del condominio.', ejemplo: 'Edificio de más de 20 años: tasa más alta.' },
  revision: { ayuda: 'Revisa sin cambiar nada si el plan tiene lo necesario para emitirse y te lleva a corregir lo que falta.', ejemplo: 'En rojo: sin comisión cargada.' },
  producto: { ayuda: 'El producto agrupa los planes y define qué tipo de intermediario los usa.', ejemplo: 'Producto «Auto Renta Seguro».' },
  plan: { ayuda: 'Nombre, código, vigencia y moneda del plan.', ejemplo: 'Código AUTO01, vigente hasta 31-12-2099.' },
};

export const SECCION_INFO: Record<string, InfoSeccion> = Object.fromEntries(
  Object.entries(SECCION_INFO_BASE).map(([k, v]) => [k, { ...v, ...(AYUDAS_SECCION[k] ?? {}) }]),
);

export function infoSeccion(seccion: string): InfoSeccion {
  return SECCION_INFO[seccion] ?? { titulo: seccion, resumen: '', tabla: '' };
}

const texto = (v: unknown) => (v == null ? '' : String(v).trim());
const numeroONull = (v: unknown): number | null => {
  if (v == null || texto(v) === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** Fecha de Sis2000 (Date ISO o texto) → AAAA-MM-DD. */
export const fechaIso = (v: unknown): string => {
  const t = texto(v);
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : t;
};

/** Normaliza GET ramos/:cramo; las secciones desconocidas se respetan (otra familia puede traer las suyas). */
export function normalizarRamo(r: Record<string, unknown>): RamoConfigurador {
  return {
    cramo: Number(r.cramo),
    xdescripcion_l: texto(r.xdescripcion_l ?? r.xdescripcion),
    familia: familiaValida(r.familia),
    secciones: (Array.isArray(r.secciones) ? r.secciones : []).map(texto).filter(Boolean),
    colectivo: r.colectivo === true,
    emisionNexus: texto(r.emisionNexus) || null,
    estado: texto(r.estado),
    soloLectura: r.soloLectura === true || familiaValida(r.familia) === 'fianzas',
    avisos: (Array.isArray(r.avisos) ? r.avisos : []).map(texto).filter(Boolean),
  };
}

/** Cobertura del plan tal como la usan los paneles (código, tarifa y nombre para mostrar). */
export interface CoberturaDelPlan {
  ccobertura: string;
  ctarifa: string;
  nombre: string;
}

/**
 * Coberturas del plan leído de Sis2000 (GET plans/:id/sis2000 → plan.coberturas) con el nombre del catálogo del ramo.
 */
export function coberturasDelPlan(
  plan: Record<string, unknown> | null | undefined,
  catalogo: Array<Record<string, unknown>> = [],
): CoberturaDelPlan[] {
  const lista = plan && Array.isArray(plan.coberturas) ? (plan.coberturas as Record<string, unknown>[]) : [];
  const nombres = new Map(catalogo.map((c) => [texto(c.ccobertura).toUpperCase(), texto(c.xdescripcion_l ?? c.xcobertura)]));
  const vistas = new Set<string>();
  const out: CoberturaDelPlan[] = [];
  for (const c of lista) {
    const ccobertura = texto(c.ccobertura ?? c.ccober);
    const ctarifa = texto(c.ctarifa);
    const k = `${ccobertura.toUpperCase()}|${ctarifa.toUpperCase()}`;
    if (!ccobertura || vistas.has(k)) continue;
    vistas.add(k);
    out.push({ ccobertura, ctarifa, nombre: nombres.get(ccobertura.toUpperCase()) || `Cobertura ${ccobertura}` });
  }
  return out;
}

// ── Tramos (desde / hasta / valor): tasas por antigüedad hoy, tabla de edad mañana ──

export interface TramoEditable {
  desde: string;
  hasta: string;
  valor: string;
}

export interface ErrorTramo {
  /** Fila (0…n-1); -1 = la tabla completa. */
  indice: number;
  campo: 'desde' | 'hasta' | 'valor' | 'tabla';
  mensaje: string;
}

export interface OpcionesTramos {
  /** Inicio por defecto del primer tramo (tramo nuevo y carga rápida). Si no hay `inicios`, el primero debe empezar aquí. */
  inicio?: number;
  /** Inicios permitidos del primer tramo (antigüedad: -1 o 0). Sin valor se usa `inicio`; sin ninguno, empieza donde sea. */
  inicios?: number[];
  /** Menor valor de desde/hasta (por defecto 0; antigüedad: -1 = vehículo del año siguiente). */
  minimo?: number;
  /** Aviso (no error) si el último tramo termina antes de este valor. */
  avisoSiTerminaAntesDe?: number;
  /** Texto del aviso; `{hasta}` se reemplaza por el último «hasta». */
  textoAviso?: string;
  /** Nombre del valor para los mensajes («la tasa», «la prima»). */
  nombreValor?: string;
  /** Unidad de desde/hasta para los mensajes («años»). */
  unidad?: string;
  /** El valor debe ser mayor que 0 (por defecto sí). */
  valorPositivo?: boolean;
  /** Tope del valor (p. ej. 100 si es %). */
  valorMaximo?: number;
}

const esEntero = (v: string) => /^\d+$/.test(v.trim());
const esEnteroDesde = (v: string, minimo: number) => /^-?\d+$/.test(v.trim()) && Number(v) >= minimo;

/**
 * Valida tramos sin huecos ni solapes: enteros, hasta ≥ desde, el siguiente empieza en hasta + 1 y el valor es un
 * número mayor que 0. Los tramos se revisan en el orden en que están (el editor los ordena al agregar).
 */
export function validarTramos(tramos: TramoEditable[], opciones: OpcionesTramos = {}): ErrorTramo[] {
  const { inicio, inicios, minimo = 0, nombreValor = 'el valor', unidad = '', valorPositivo = true, valorMaximo } = opciones;
  const permitidos = inicios ?? (inicio !== undefined ? [inicio] : undefined);
  const u = unidad ? ` ${unidad}` : '';
  const errores: ErrorTramo[] = [];
  if (!tramos.length) return [{ indice: -1, campo: 'tabla', mensaje: 'Agrega al menos un tramo.' }];
  const entero = (v: string) => esEnteroDesde(v, minimo);
  tramos.forEach((t, i) => {
    const n = i + 1;
    let desdeOk = entero(t.desde);
    const hastaOk = entero(t.hasta);
    if (!desdeOk) errores.push({ indice: i, campo: 'desde', mensaje: `Tramo ${n}: «desde» debe ser un número entero de ${minimo} o más.` });
    if (!hastaOk) errores.push({ indice: i, campo: 'hasta', mensaje: `Tramo ${n}: «hasta» debe ser un número entero de ${minimo} o más.` });
    const desde = Number(t.desde);
    const hasta = Number(t.hasta);
    if (desdeOk && hastaOk && hasta < desde) {
      errores.push({ indice: i, campo: 'hasta', mensaje: `Tramo ${n}: «hasta» (${hasta}${u}) no puede ser menor que «desde» (${desde}${u}).` });
    }
    if (i === 0 && desdeOk && permitidos && !permitidos.includes(desde)) {
      errores.push({ indice: 0, campo: 'desde', mensaje: `El primer tramo debe empezar en ${permitidos.join(' o ')}${u}.` });
      desdeOk = false;
    }
    if (i > 0 && desdeOk && entero(tramos[i - 1].hasta)) {
      const esperado = Number(tramos[i - 1].hasta) + 1;
      if (desde > esperado) {
        errores.push({
          indice: i,
          campo: 'desde',
          mensaje: `Hay un hueco entre el tramo ${n - 1} y el ${n}: falta de ${esperado} a ${desde - 1}${u}. El tramo ${n} debe empezar en ${esperado}.`,
        });
      } else if (desde < esperado) {
        errores.push({
          indice: i,
          campo: 'desde',
          mensaje: `El tramo ${n} se solapa con el ${n - 1}: debe empezar en ${esperado}${u} (el anterior termina en ${esperado - 1}).`,
        });
      }
    }
    const v = t.valor.trim().replace(',', '.');
    if (!v || !Number.isFinite(Number(v))) {
      errores.push({ indice: i, campo: 'valor', mensaje: `Tramo ${n}: escribe ${nombreValor}.` });
    } else if (valorPositivo && Number(v) <= 0) {
      errores.push({ indice: i, campo: 'valor', mensaje: `Tramo ${n}: ${nombreValor} debe ser mayor que 0.` });
    } else if (valorMaximo !== undefined && Number(v) > valorMaximo) {
      errores.push({ indice: i, campo: 'valor', mensaje: `Tramo ${n}: ${nombreValor} no puede ser mayor que ${valorMaximo}.` });
    }
  });
  return errores;
}

/**
 * Avisos que no impiden guardar: si el último tramo termina antes de `avisoSiTerminaAntesDe` (antigüedad: los
 * vehículos más viejos no podrán cotizar el plan).
 */
export function avisosTramos(tramos: TramoEditable[], opciones: OpcionesTramos = {}): string[] {
  const { avisoSiTerminaAntesDe: tope, minimo = 0, unidad = '' } = opciones;
  if (tope === undefined || !tramos.length) return [];
  const hastas = tramos.map((t) => t.hasta).filter((h) => esEnteroDesde(h, minimo)).map(Number);
  if (!hastas.length) return [];
  const ultimo = Math.max(...hastas);
  if (ultimo >= tope) return [];
  const u = unidad ? ` ${unidad}` : '';
  return [(opciones.textoAviso ?? `El último tramo llega hasta {hasta}${u}.`).replace(/\{hasta\}/g, String(ultimo))];
}

/** Tramo siguiente al último (empieza en hasta + 1, mismo ancho). */
export function siguienteTramo(tramos: TramoEditable[], inicio = 0): TramoEditable {
  const ultimo = tramos[tramos.length - 1];
  const entero = (v: string) => /^-?\d+$/.test(v.trim());
  if (!ultimo || !entero(ultimo.hasta)) return { desde: String(inicio), hasta: '', valor: '' };
  const desde = Number(ultimo.hasta) + 1;
  const ancho = entero(ultimo.desde) ? Math.max(0, Number(ultimo.hasta) - Number(ultimo.desde)) : 0;
  return { desde: String(desde), hasta: String(desde + ancho), valor: '' };
}

/** Tramos de `ancho` en `ancho` entre desde y hasta, con el mismo valor (vacío si no se da). */
export function generarTramosPorAncho(desde: number, hasta: number, ancho: number, valor = '', minimo = 0): TramoEditable[] {
  if (![desde, hasta, ancho].every(Number.isInteger) || desde < minimo || hasta < desde || ancho < 1) return [];
  const out: TramoEditable[] = [];
  for (let d = desde; d <= hasta && out.length < 100; d += ancho) {
    out.push({ desde: String(d), hasta: String(Math.min(d + ancho - 1, hasta)), valor });
  }
  return out;
}

// ── Tasas por antigüedad (maplantar_ano) ──

export interface TasaAntiguedad {
  ccober: string;
  ctarifa: string;
  nantiguedad_desde: number;
  nantiguedad_hasta: number;
  pprima: number;
  iestado: string;
}

export function normalizarTasa(r: Record<string, unknown>): TasaAntiguedad {
  return {
    ccober: texto(r.ccober ?? r.ccobertura),
    ctarifa: texto(r.ctarifa),
    nantiguedad_desde: Number(r.nantiguedad_desde ?? 0),
    nantiguedad_hasta: Number(r.nantiguedad_hasta ?? 0),
    pprima: Number(r.pprima ?? 0),
    iestado: texto(r.iestado).toUpperCase() || 'V',
  };
}

/** Tramos vigentes de una cobertura y tarifa, ordenados y listos para editar. */
export function tramosVigentes(filas: TasaAntiguedad[], ccober: string, ctarifa: string): TramoEditable[] {
  return filas
    .filter((f) => f.iestado === 'V' && f.ccober.toUpperCase() === ccober.toUpperCase() && f.ctarifa.toUpperCase() === ctarifa.toUpperCase())
    .sort((a, b) => a.nantiguedad_desde - b.nantiguedad_desde)
    .map((f) => ({ desde: String(f.nantiguedad_desde), hasta: String(f.nantiguedad_hasta), valor: String(f.pprima) }));
}

/** Cuerpo del PUT tasas-antiguedad. */
export function cuerpoTasas(tramos: TramoEditable[]) {
  return {
    tramos: tramos.map((t) => ({ desde: Number(t.desde), hasta: Number(t.hasta), pprima: Number(t.valor.trim().replace(',', '.')) })),
  };
}

// ── Comisiones (maarancel) ──

export interface Comision {
  ctipoprod: number;
  cproductor: number;
  ccober: string;
  ctarifa: string;
  fdesde: string;
  fhasta: string | null;
  pcomision: number | null;
  iestado: string;
  aplicaA: 'plan' | 'ramo';
}

export function normalizarComision(r: Record<string, unknown>): Comision {
  return {
    ctipoprod: Number(r.ctipoprod ?? 0),
    cproductor: Number(r.cproductor ?? 0),
    ccober: texto(r.ccober) || '0',
    ctarifa: texto(r.ctarifa) || '0',
    fdesde: fechaIso(r.fdesde),
    fhasta: r.fhasta ? fechaIso(r.fhasta) : null,
    pcomision: numeroONull(r.pcomision),
    iestado: texto(r.iestado).toUpperCase() || 'V',
    aplicaA: texto(r.aplicaA) === 'ramo' ? 'ramo' : 'plan',
  };
}

export interface ComisionForm {
  ctipoprod: string;
  cproductor: string;
  ccober: string;
  ctarifa: string;
  fdesde: string;
  pcomision: string;
}

/** Errores por campo del alta de comisión (vacío = se puede guardar). */
export function validarComision(f: ComisionForm): Partial<Record<keyof ComisionForm, string>> {
  const e: Partial<Record<keyof ComisionForm, string>> = {};
  if (!esEntero(f.ctipoprod)) e.ctipoprod = 'Elige el tipo de intermediario (número entero).';
  if (f.cproductor.trim() && !esEntero(f.cproductor)) e.cproductor = 'El código del productor es un número; 0 = todos.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fdesde.trim())) e.fdesde = 'Indica desde cuándo aplica (AAAA-MM-DD).';
  const p = f.pcomision.trim().replace(',', '.');
  if (!p || !Number.isFinite(Number(p))) e.pcomision = 'Escribe el porcentaje de comisión.';
  else if (Number(p) < 0 || Number(p) > 100) e.pcomision = 'La comisión es un porcentaje entre 0 y 100.';
  else if ((p.split('.')[1] ?? '').length > 2) e.pcomision = 'La comisión admite hasta 2 decimales.';
  if (f.ccober.trim().length > 4) e.ccober = 'El código de cobertura tiene hasta 4 caracteres.';
  if (f.ctarifa.trim().length > 4) e.ctarifa = 'El código de tarifa tiene hasta 4 caracteres.';
  return e;
}

export function cuerpoComision(f: ComisionForm) {
  return {
    ctipoprod: Number(f.ctipoprod),
    cproductor: f.cproductor.trim() ? Number(f.cproductor) : 0,
    ccober: f.ccober.trim() || '0',
    ctarifa: f.ctarifa.trim() || '0',
    fdesde: f.fdesde.trim(),
    pcomision: Number(f.pcomision.trim().replace(',', '.')),
  };
}

/** «Todas», «Todos» o el código. */
export const comodin = (v: string | number, todos = 'Todas') => (String(v).trim() === '0' || String(v).trim() === '' ? todos : String(v).trim());

// ── Deducibles (matarifa_d / maplancob) ──

export type TipoDeducible = '' | 'D' | 'F';

export interface DeducibleForm {
  bfraded: TipoDeducible;
  mdedu_fran: string;
  mdedu_franext: string;
  pdedu_fran: string;
}

export const DEDUCIBLE_VACIO: DeducibleForm = { bfraded: '', mdedu_fran: '', mdedu_franext: '', pdedu_fran: '' };

export function deducibleDeFila(r: Record<string, unknown> | null | undefined): DeducibleForm {
  if (!r) return { ...DEDUCIBLE_VACIO };
  const tipo = texto(r.bfraded).toUpperCase();
  const t = (v: unknown) => (numeroONull(v) == null ? '' : String(numeroONull(v)));
  return {
    bfraded: tipo === 'D' || tipo === 'F' ? tipo : '',
    mdedu_fran: t(r.mdedu_fran),
    mdedu_franext: t(r.mdedu_franext),
    pdedu_fran: t(r.pdedu_fran),
  };
}

export function validarDeducible(f: DeducibleForm): Partial<Record<keyof DeducibleForm, string>> {
  const e: Partial<Record<keyof DeducibleForm, string>> = {};
  if (!f.bfraded) return e;
  const n = (v: string) => Number(v.trim().replace(',', '.'));
  const vacio = (v: string) => !v.trim();
  for (const k of ['mdedu_fran', 'mdedu_franext'] as const) {
    if (!vacio(f[k]) && (!Number.isFinite(n(f[k])) || n(f[k]) < 0)) e[k] = 'El monto no puede ser negativo.';
  }
  if (!vacio(f.pdedu_fran) && (!Number.isFinite(n(f.pdedu_fran)) || n(f.pdedu_fran) < 0 || n(f.pdedu_fran) > 100)) {
    e.pdedu_fran = 'El porcentaje va entre 0 y 100.';
  }
  if (vacio(f.mdedu_fran) && vacio(f.mdedu_franext) && vacio(f.pdedu_fran)) {
    e.mdedu_fran = 'Indica el monto o el porcentaje del deducible (o elige «Sin deducible»).';
  }
  return e;
}

/** Cuerpo para la API. `paraEditar`: «Sin deducible» manda bfraded null y montos en 0 (quita el deducible). */
export function cuerpoDeducible(f: DeducibleForm, paraEditar = false): Record<string, unknown> {
  const n = (v: string) => (v.trim() ? Number(v.trim().replace(',', '.')) : undefined);
  if (!f.bfraded) {
    return paraEditar ? { bfraded: null, mdedu_fran: 0, mdedu_franext: 0, pdedu_fran: 0 } : {};
  }
  const out: Record<string, unknown> = { bfraded: f.bfraded };
  for (const k of ['mdedu_fran', 'mdedu_franext', 'pdedu_fran'] as const) {
    const v = n(f[k]);
    if (v !== undefined) out[k] = v;
    else if (paraEditar) out[k] = 0;
  }
  return out;
}

export function textoDeducible(f: DeducibleForm, moneda = '$'): string {
  if (!f.bfraded) return 'Sin deducible';
  const partes = [
    f.mdedu_fran ? `Bs ${Number(f.mdedu_fran).toLocaleString('es-VE')}` : '',
    f.mdedu_franext ? `${moneda} ${Number(f.mdedu_franext).toLocaleString('es-VE')}` : '',
    f.pdedu_fran ? `${Number(f.pdedu_fran).toLocaleString('es-VE')} %` : '',
  ].filter(Boolean);
  return `${f.bfraded === 'F' ? 'Franquicia' : 'Deducible'}${partes.length ? `: ${partes.join(' · ')}` : ''}`;
}

/** Tasa vigente de una tarifa: la 'V' con fdesde más reciente (si no hay, la más reciente). */
export function detalleVigente(detalles: Array<Record<string, unknown>>): Record<string, unknown> | null {
  if (!detalles.length) return null;
  const orden = [...detalles].sort((a, b) => fechaIso(b.fdesde).localeCompare(fechaIso(a.fdesde)));
  return orden.find((d) => texto(d.iestado).toUpperCase() === 'V') ?? orden[0];
}

// ── Advertencias que piden confirmar (tipo y uso repetido en otro ramo) ──

/**
 * Advertencias que hay que confirmar antes de que nest-api grabe: respuesta con `grabado: false` (tipo y uso repetido
 * en otro ramo, tasa por antigüedad en una cobertura que no es de casco) o cuerpo de un error con advertencias.
 * [] = no hay nada que confirmar (si grabó, las advertencias son solo informativas).
 */
export function advertenciasPorConfirmar(respuestaOError: unknown, yaConfirmado: boolean): string[] {
  if (yaConfirmado || !respuestaOError || typeof respuestaOError !== 'object') return [];
  const o = respuestaOError as Record<string, unknown>;
  const fuente = (o.cuerpo && typeof o.cuerpo === 'object' ? (o.cuerpo as Record<string, unknown>) : o) as Record<string, unknown>;
  if (fuente.grabado === true || (fuente.grabado === undefined && !o.cuerpo)) return [];
  const adv = Array.isArray(fuente.advertencias) ? fuente.advertencias : [];
  return adv.map((a) => (typeof a === 'string' ? a : texto((a as Record<string, unknown>)?.mensaje) || JSON.stringify(a))).filter(Boolean);
}

// ── Revisión del plan ──

export type NivelRevision = 'error' | 'aviso' | 'ok';

export interface ItemRevision {
  codigo: string;
  nivel: NivelRevision;
  mensaje: string;
  seccion: string;
}

export interface RevisionPlan {
  familia: FamiliaRamo;
  listo: boolean;
  items: ItemRevision[];
}

export function normalizarRevision(r: Record<string, unknown>): RevisionPlan {
  const items = (Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : []).map((i): ItemRevision => {
    const nivel = texto(i.nivel);
    return {
      codigo: texto(i.codigo),
      // 'info' (p. ej. ramo sin numeración de recibos) se muestra como aviso: no impide emitir.
      nivel: nivel === 'error' || nivel === 'aviso' ? nivel : nivel === 'info' ? 'aviso' : 'ok',
      mensaje: texto(i.mensaje),
      seccion: texto(i.seccion),
    };
  });
  return {
    familia: familiaValida(r.familia),
    listo: r.listo === true,
    items,
  };
}

/** Errores primero, después avisos y al final lo que está bien. */
export function ordenarRevision(items: ItemRevision[]): ItemRevision[] {
  const peso: Record<NivelRevision, number> = { error: 0, aviso: 1, ok: 2 };
  return [...items].sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

export function contarRevision(items: ItemRevision[]): Record<NivelRevision, number> {
  return items.reduce(
    (acc, i) => ({ ...acc, [i.nivel]: acc[i.nivel] + 1 }),
    { error: 0, aviso: 0, ok: 0 } as Record<NivelRevision, number>,
  );
}

/**
 * Comisiones vigentes del ramo (cplan '0', comodín) que ya cubren la combinación del formulario: cada campo coincide o
 * es comodín (0 / vacío) en alguno de los dos lados. Sirve para avisar antes de duplicar una comisión que el plan ya
 * hereda del ramo. Solo filas 'V' (las 'N' no se tocan ni cuentan).
 */
export function comodinesRamoQueCubren(filas: Comision[], f: ComisionForm): Comision[] {
  const c = cuerpoComision(f);
  const cubre = (a: string | number, b: string | number) => {
    const x = String(a).trim() || '0';
    const y = String(b).trim() || '0';
    return x === y || x === '0' || y === '0';
  };
  if (!String(f.ctipoprod).trim()) return [];
  return filas.filter(
    (r) =>
      r.aplicaA === 'ramo' &&
      r.iestado === 'V' &&
      cubre(r.ctipoprod, c.ctipoprod) &&
      cubre(r.cproductor, c.cproductor) &&
      cubre(r.ccober, c.ccober) &&
      cubre(r.ctarifa, c.ctarifa),
  );
}

/**
 * Parentesco y edad para la cotización de prueba de un plan de personas (spCalculoPer): el primer parentesco de la
 * primera cobertura y una edad dentro de su rango (la mínima, o 18 si el rango la incluye). null si no hay parentescos.
 */
export function parentescoParaCotizar(coberturas: unknown): { cparen: number; nedad: number } | null {
  if (!Array.isArray(coberturas)) return null;
  for (const c of coberturas as Array<{ parentescos?: unknown }>) {
    const ps = Array.isArray(c?.parentescos) ? (c.parentescos as Array<Record<string, unknown>>) : [];
    for (const p of ps) {
      const cparen = Number(p?.cparen);
      if (!Number.isInteger(cparen) || cparen <= 0) continue;
      const min = Number.isInteger(Number(p?.nedad_min)) ? Number(p.nedad_min) : 0;
      const max = Number.isInteger(Number(p?.nedad_max)) ? Number(p.nedad_max) : 120;
      return { cparen, nedad: min <= 18 && 18 <= max ? 18 : min };
    }
  }
  return null;
}
