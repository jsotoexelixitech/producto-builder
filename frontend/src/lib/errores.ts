// Traductor central de errores del configurador: convierte lo que responde el builder / nest-api / Sis2000 en un
// mensaje claro para el usuario de negocio, sin perder el detalle técnico (para soporte).
// Funciones puras y sin dependencias: se prueban con `npm test -w frontend` (node --test).

export type TipoError =
  | 'validacion'
  | 'sesion'
  | 'permiso'
  | 'no-disponible'
  | 'no-encontrado'
  | 'duplicado'
  | 'sis2000'
  | 'red'
  | 'tiempo'
  | 'servidor';

/** Un campo que el servidor rechazó, con su nombre en lenguaje simple. */
export interface CampoRechazado {
  /** Propiedad del DTO (p. ej. msumamax). */
  propiedad: string;
  /** Posición en una lista (coberturas.0.msumamax → 0), si viene. */
  indice?: number;
  /** «Suma asegurada máxima: no puede ser negativa.» */
  mensaje: string;
}

export interface ErrorEntendible {
  tipo: TipoError;
  /** Qué se intentaba hacer («No se pudo crear la cobertura»), si se conoce. */
  titulo?: string;
  /** Mensaje principal, claro y con la salida. */
  mensaje: string;
  campos: CampoRechazado[];
  /** Tiene sentido pulsar «Reintentar» (red, tiempo agotado, servidor ocupado). */
  reintentable: boolean;
  detalle: { status?: number; endpoint?: string; crudo: string };
}

/** Lo que se lee de un error (ApiError del builder o cualquier Error). */
interface ErrorLeido {
  status?: number;
  message?: string;
  ruta?: string;
  metodo?: string;
  mensajes?: string[];
}

export interface OpcionesError {
  /** Qué se intentaba guardar, con artículo: «una cobertura», «un plan», «un producto». */
  que?: string;
  /** Qué se intentaba hacer, para el encabezado del aviso («No se pudo guardar el proveedor»). */
  titulo?: string;
  /** Nombres propios de propiedades para esta pantalla (se suman a los generales). */
  etiquetas?: Record<string, string>;
  /** Mensaje propio para «ya existe» (409) cuando no es un código repetido (p. ej. una comisión vigente igual). */
  duplicado?: string;
}

/** Nombres en lenguaje simple de las propiedades de los DTO de v1/configurador. */
export const ETIQUETAS_PROPIEDAD: Record<string, string> = {
  cramo: 'Ramo',
  cproducto: 'Código del producto',
  ccobertura: 'Código de la cobertura',
  ccober: 'Código de la cobertura',
  ctarifa: 'Código de la tarifa',
  xdescripcion_l: 'Nombre',
  xdescripcion_c: 'Nombre corto',
  xabreviatura: 'Abreviatura',
  xtarifam: 'Nombre interno de la tarifa',
  xtarifa: 'Nombre de la tarifa',
  cmoneda: 'Moneda',
  msumamin: 'Suma asegurada mínima',
  msumamax: 'Suma asegurada máxima',
  msuma: 'Suma asegurada',
  pprima: 'Tasa %',
  mprima: 'Prima fija',
  fdesde: 'Fecha desde',
  fhasta: 'Fecha hasta',
  cplan: 'Código del plan',
  xplan: 'Nombre del plan',
  xobservacion: 'Observaciones',
  productores: 'Productores',
  canales: 'Canales',
  frecuencias: 'Formas de pago',
  coberturas: 'Coberturas',
  parentescos: 'Parentescos',
  cparen: 'Parentesco',
  csexo: 'Sexo',
  nedad_min: 'Edad mínima',
  nedad_max: 'Edad máxima',
  ctablatar: 'Tabla de precios por edad',
  ctablaedad: 'Código de la tabla',
  xtablaedad: 'Nombre de la tabla',
  tramos: 'Tramos de edad',
  cci_rif: 'Proveedor',
  cclave_num: 'Clave del proveedor',
  mcosto: 'Costo',
  mcostoext: 'Costo en divisa',
  itiposerv: 'Tipo de servicio',
  ccontrea: 'Contrato de reaseguro',
  cramorea: 'Ramo de reaseguro',
  cramoint: 'Ramo interno',
  ccoberturaint: 'Cobertura interna',
  bfraded: 'Tipo de deducible',
  mdedu_fran: 'Deducible (monto)',
  mdedu_franext: 'Deducible (monto en divisa)',
  pdedu_fran: 'Deducible (%)',
  mmax_desem: 'Desembolso máximo',
  mmax_desemext: 'Desembolso máximo en divisa',
  ctipoprod: 'Tipo de intermediario',
  cproductor: 'Productor',
  pcomision: 'Comisión %',
  ctipo: 'Tipo de vehículo',
  ccategotr: 'Uso del vehículo',
  mprimbas: 'Prima base RCV',
  mprimext: 'Prima base RCV en divisa',
  msumacosas: 'Suma daños a cosas',
  msumapers: 'Suma daños a personas',
  msumacosasext: 'Suma daños a cosas en divisa',
  msumapersext: 'Suma daños a personas en divisa',
  ptasaexc: 'Tasa de exceso %',
  pdescuento: 'Descuento %',
  desde: 'Desde',
  hasta: 'Hasta',
};

/** Montos con separador de miles: 10000 → «10.000», 2500.5 → «2.500,5». */
export function miles(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString('es-VE', { maximumFractionDigits: 6 }) : String(n);
}

/** Quita prefijos técnicos de un mensaje de SQL Server / mssql / Nest («RequestError: », «Msg 50001, Level 16…»). */
export function limpiarTextoServidor(texto: string): string {
  return texto
    .replace(/^(RequestError|Error|HttpException|BadRequestException|ConnectionError)\s*:\s*/i, '')
    .replace(/Msg\s+\d+,\s*Level\s+\d+,\s*State\s+\d+(,\s*(Procedure\s+\S+,\s*)?Line\s+\d+)?\s*/gi, '')
    .replace(/^\s*\(?\s*\b\d{5}\b\s*\)?\s*[:-]\s*/, '') // THROW 50001: …
    .replace(/\s+/g, ' ')
    .trim();
}

/** true si el texto se puede mostrar tal cual a un usuario (español, corto, sin trazas). */
export function esLegible(texto: string): boolean {
  const t = texto.trim();
  if (!t || t.length > 280) return false;
  if (/Cannot (GET|POST|PUT|PATCH|DELETE) \/|Internal server error|ECONN|ETIMEDOUT|at \S+ \(|\{.*":/i.test(t)) return false;
  if (/^\{|^\[/.test(t)) return false;
  return /[áéíóúñ¿¡]|\b(el|la|los|las|no|ya|del|que|con|debe|existe|falta|plan|cobertura|tarifa|tabla|ramo|producto)\b/i.test(t);
}

const REGLAS_VALIDADOR: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/should not be empty|must not be empty/i, () => 'es obligatorio.'],
  [/must not be less than (-?[\d.]+)/i, (m) => (Number(m[1]) === 0 ? 'no puede ser un valor negativo.' : `debe ser ${miles(Number(m[1]))} o más.`)],
  [/must not be greater than (-?[\d.]+)/i, (m) => `no puede ser mayor que ${miles(Number(m[1]))}.`],
  [/must be shorter than or equal to (\d+) characters/i, (m) => `admite como máximo ${m[1]} caracteres.`],
  [/must be longer than or equal to (\d+) characters/i, (m) => `debe tener al menos ${m[1]} caracteres.`],
  [/maximal allowed number of decimal places|conforming to the specified constraints/i, () => 'tiene más decimales de los permitidos (montos 2, tasas 6).'],
  [/must be an integer/i, () => 'debe ser un número entero.'],
  [/must be a number/i, () => 'debe ser un número.'],
  [/must be a boolean/i, () => 'debe ser sí o no.'],
  [/must be a string/i, () => 'debe ser un texto.'],
  [/must be one of the following values|must be a valid enum/i, () => 'tiene un valor que no está permitido.'],
  [/must match .*regular expression/i, () => 'tiene un formato inválido (revisa espacios, letras y fechas AAAA-MM-DD).'],
  [/must contain at least (\d+) elements?/i, (m) => (m[1] === '1' ? 'debe tener al menos uno.' : `debe tener al menos ${m[1]}.`)],
  [/must be an array/i, () => 'debe ser una lista.'],
  [/should not exist/i, () => 'no se acepta en este formulario.'],
];

/** «coberturas.0.msumamax must not be less than 0» → campo con mensaje simple; null si no es de class-validator. */
export function traducirMensajeValidador(texto: string, etiquetas: Record<string, string> = {}): CampoRechazado | null {
  const m = /^((?:[A-Za-z_]+\.\d+\.)*)([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/.exec(texto.trim());
  if (!m) return null;
  const regla = REGLAS_VALIDADOR.find(([re]) => re.test(m[3]));
  if (!regla) return null;
  const propiedad = m[2];
  const indices = [...m[1].matchAll(/\.(\d+)\./g)].map((x) => Number(x[1]));
  const lista = /^([A-Za-z_]+)\./.exec(m[1])?.[1];
  const etiqueta = etiquetas[propiedad] ?? ETIQUETAS_PROPIEDAD[propiedad] ?? propiedad;
  const prefijo =
    lista && indices.length
      ? `${(etiquetas[lista] ?? ETIQUETAS_PROPIEDAD[lista] ?? lista).replace(/s$/, '')} ${indices[0] + 1}, `
      : '';
  const regex = regla[0];
  const texto2 = regla[1](m[3].match(regex) as RegExpMatchArray);
  return { propiedad, indice: indices[0], mensaje: `${prefijo}${etiqueta}: ${texto2}` };
}

/** Reglas para errores de SQL Server / Sis2000 (texto → mensaje claro). */
const REGLAS_SIS2000: Array<[RegExp, string, boolean]> = [
  [/FOREIGN KEY|REFERENCE constraint/i, 'Sis2000 no encontró un dato relacionado (ramo, producto, tarifa o tabla). Revisa que lo elegido exista.', false],
  [/cannot insert the value NULL|no admite valores NULL/i, 'Falta un dato obligatorio para Sis2000. Revisa que todos los campos estén llenos.', false],
  [/truncat|String or binary data/i, 'Algún texto es más largo de lo que admite Sis2000. Acorta el código o el nombre.', false],
  [/deadlock|interbloqueo/i, 'Sis2000 está ocupado con otra operación. Espera unos segundos y pulsa «Reintentar».', true],
];

function leer(e: unknown): ErrorLeido {
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    return {
      status: typeof o.status === 'number' ? o.status : undefined,
      message: typeof o.message === 'string' ? o.message : undefined,
      ruta: typeof o.ruta === 'string' ? o.ruta : undefined,
      metodo: typeof o.metodo === 'string' ? o.metodo : undefined,
      mensajes: Array.isArray(o.mensajes) ? (o.mensajes as unknown[]).map(String) : undefined,
    };
  }
  return { message: typeof e === 'string' ? e : '' };
}

/**
 * Error de cualquier llamada del configurador → mensaje claro + campos + si se puede reintentar + detalle técnico.
 * `que` personaliza los duplicados («Ya existe una cobertura con ese código»).
 */
export function entenderError(e: unknown, opciones: OpcionesError = {}): ErrorEntendible {
  const l = leer(e);
  const crudo = (l.mensajes?.length ? l.mensajes.join(' | ') : l.message ?? '').trim();
  const status = l.status;
  const endpoint = l.ruta ? `${l.metodo ?? 'GET'} ${l.ruta}` : undefined;
  const detalle = { status, endpoint, crudo: crudo || '(sin mensaje)' };
  const limpio = limpiarTextoServidor(crudo);
  const legible = esLegible(limpio) ? limpio : '';
  const salida = (tipo: TipoError, mensaje: string, reintentable = false, campos: CampoRechazado[] = []): ErrorEntendible => ({
    titulo: opciones.titulo,
    tipo,
    mensaje,
    campos,
    reintentable,
    detalle,
  });

  // Red caída: fetch no llegó al servidor del configurador, o el configurador no llegó a nest-api.
  if (status === 0 || /Failed to fetch|NetworkError|Load failed|ECONNREFUSED|fetch failed|No se pudo conectar con nest-api/i.test(crudo)) {
    return salida('red', 'No hay conexión con el servidor. Revisa tu conexión y pulsa «Reintentar»; lo que llenaste no se pierde.', true);
  }
  if (status === 504 || /timeout|ETIMEDOUT|tiempo de espera|aborted|TimeoutError/i.test(crudo)) {
    return salida(
      'tiempo',
      'Sis2000 tardó demasiado en responder. Antes de reintentar, revisa si el cambio quedó guardado (por ejemplo, buscando el plan o la cobertura).',
      true,
    );
  }
  if (status === 401) {
    return salida('sesion', 'Tu sesión venció. Vuelve a iniciar sesión; lo llenado en Combos queda guardado en este navegador.');
  }
  if (status === 403) {
    // Bandera de escritura apagada en el servidor (CONFIGURADOR_*_ESCRITURA): no es falta de permiso del usuario.
    if (legible && /desactivad|apagad|bandera|no est[aá] habilitad|_ESCRITURA/i.test(crudo)) {
      // «(CONFIGURADOR_X_ESCRITURA=1 para habilitarla)» queda solo en el detalle técnico.
      const sinVariable = legible.replace(/\s*\([A-Z0-9_]+=\d[^)]*\)/g, '').replace(/\s+\./g, '.').trim();
      return salida('no-disponible', `${sinVariable} Por ahora solo se puede consultar; pide a soporte que lo active en este ambiente.`);
    }
    return salida('permiso', legible ? `No tienes permiso: ${legible}` : 'No tienes permiso para esta operación. Pide acceso al administrador del configurador.');
  }
  if (status === 404) {
    if (!legible || /Cannot (GET|POST|PUT|PATCH|DELETE)/i.test(crudo)) {
      return salida('no-disponible', 'Esta función no está disponible en este ambiente (falta actualizar el servicio). Avísale a soporte.');
    }
    return salida('no-encontrado', legible);
  }
  if (status === 409 || /PRIMARY KEY|UNIQUE KEY|duplicate key|clave duplicada|ya existe/i.test(crudo)) {
    return salida(
      'duplicado',
      opciones.duplicado ?? `Ya existe ${opciones.que ?? 'un registro'} con ese código. Usa otro código o elige el que ya existe.`,
    );
  }

  // Validación del DTO (class-validator): se traduce cada mensaje y se asocia al campo.
  const partes = l.mensajes?.length ? l.mensajes : crudo.split(/\s*\|\s*/);
  const campos = partes
    .map((p) => traducirMensajeValidador(p, opciones.etiquetas))
    .filter((c): c is CampoRechazado => Boolean(c));
  if (campos.length && (status === undefined || status === 400 || status === 422)) {
    return salida(
      'validacion',
      campos.length === 1 ? `Revisa este dato: ${campos[0].mensaje}` : `Revisa estos ${campos.length} datos:`,
      false,
      campos,
    );
  }

  for (const [re, texto, reintentar] of REGLAS_SIS2000) {
    if (re.test(crudo)) return salida('sis2000', texto, reintentar);
  }
  if (status === 502 || status === 503) {
    return salida('servidor', legible ? legible : 'El servicio de Sis2000 no está respondiendo. Pulsa «Reintentar» en unos minutos.', true);
  }
  // Mensaje del SP o de nest-api ya en español (THROW 5xxxx, reglas del configurador): se muestra limpio.
  if (legible) return salida('sis2000', legible, status === undefined || status >= 500);
  return salida(
    'servidor',
    'Ocurrió un error inesperado. Pulsa «Reintentar»; si se repite, pasa el «detalle técnico» a soporte.',
    true,
  );
}

/** Mensaje en una sola línea (para listas o avisos cortos). */
export function mensajeDeError(e: unknown, opciones: OpcionesError = {}): string {
  const r = entenderError(e, opciones);
  return r.campos.length > 1 ? `${r.mensaje} ${r.campos.map((c) => c.mensaje).join(' ')}` : r.mensaje;
}
