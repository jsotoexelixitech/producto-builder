/**
 * Ayudantes del configurador de planes de personas: carga rápida de tramos de edad, pegado desde Excel,
 * reparto de una prima entre coberturas y ejemplos de cobro por días. Todo es puro (sin llamadas a la API).
 */

/** Tramo tal como se edita en pantalla (montos como texto del input). */
export interface TramoTexto {
  desde: string;
  hasta: string;
  tasa: string;
  prima: string;
}

/** Tramos típicos de un plan de personas (niños / adultos / mayores). */
export const TRAMOS_ESTANDAR: Array<[number, number]> = [
  [0, 17],
  [18, 64],
  [65, 74],
];

/** Genera tramos vacíos (sin precio) para los rangos dados. */
export function generarTramos(rangos: Array<[number, number]>, prima = '', tasa = ''): TramoTexto[] {
  return rangos.map(([d, h]) => ({ desde: String(d), hasta: String(h), tasa, prima }));
}

/**
 * Tramos de `ancho` años entre `desde` y `hasta` (el último puede quedar más corto). Ej.: 0–74 cada 5 años.
 * Devuelve [] si los datos no tienen sentido.
 */
export function tramosPorAncho(desde: number, hasta: number, ancho: number): Array<[number, number]> {
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) || !Number.isInteger(ancho)) return [];
  if (desde < 0 || hasta < desde || ancho < 1) return [];
  const out: Array<[number, number]> = [];
  for (let d = desde; d <= hasta && out.length < 200; d += ancho) out.push([d, Math.min(d + ancho - 1, hasta)]);
  return out;
}

/** Número escrito con coma o punto decimal y separadores de miles («1.234,56», «1,234.56», «0,449»). */
export function leerNumero(valor: string): string {
  let t = valor.trim().replace(/\s/g, '').replace(/[$%]/g, '');
  if (!t) return '';
  const coma = t.lastIndexOf(',');
  const punto = t.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    // El último separador es el decimal.
    t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (coma >= 0) {
    t = t.replace(',', '.');
  }
  return Number.isFinite(Number(t)) ? t : valor.trim();
}

export interface ResultadoPegado {
  tramos: TramoTexto[];
  /** Filas que no se pudieron leer (número de línea + texto). */
  ignoradas: string[];
}

/**
 * Lee texto pegado de Excel (columnas separadas por tabulador, punto y coma o varios espacios). Columnas:
 * edad mínima, edad máxima, y luego el precio. `columnas` dice qué es la 3.ª y 4.ª columna:
 * - 'prima': 3.ª = prima fija.
 * - 'tasa': 3.ª = tasa %.
 * - 'suma-prima': 3.ª = suma asegurada (se ignora en la tabla), 4.ª = prima fija.
 * - 'suma-tasa': 3.ª = suma asegurada (se ignora), 4.ª = tasa %.
 * Las filas de encabezado (sin números) se ignoran solas.
 */
export function leerPegado(
  texto: string,
  columnas: 'prima' | 'tasa' | 'suma-prima' | 'suma-tasa',
): ResultadoPegado {
  const tramos: TramoTexto[] = [];
  const ignoradas: string[] = [];
  texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .forEach((linea, i) => {
      if (!linea) return;
      const celdas = linea.split(/\t|;|\s{2,}/).map((c) => c.trim()).filter((c) => c !== '');
      const desde = celdas[0]?.replace(/\D/g, '') ?? '';
      const hasta = celdas[1]?.replace(/\D/g, '') ?? '';
      const conSuma = columnas.startsWith('suma');
      const precio = leerNumero(celdas[conSuma ? 3 : 2] ?? '');
      if (!/^\d+$/.test(desde) || !/^\d+$/.test(hasta) || !precio || !Number.isFinite(Number(precio))) {
        // Encabezados («Edad mín», «Edad máx»…) no cuentan como error.
        if (/\d/.test(linea)) ignoradas.push(`Línea ${i + 1}: ${linea}`);
        return;
      }
      const esTasa = columnas === 'tasa' || columnas === 'suma-tasa';
      tramos.push({ desde, hasta, tasa: esTasa ? precio : '', prima: esTasa ? '' : precio });
    });
  return { tramos, ignoradas };
}

/** Redondeo a 2 decimales sin el error de coma flotante (1.005 → 1.01). */
export function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Reparte `total` entre `n` partes iguales a 2 decimales; el centavo que sobra o falta va a la última parte, así la
 * suma da exactamente el total. Ej.: 1,53 entre 2 → 0,76 y 0,77.
 */
export function repartirIgual(total: number, n: number): number[] {
  if (!(n > 0) || !Number.isFinite(total)) return [];
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  const partes = Array.from({ length: n }, () => base);
  partes[n - 1] += centavos - base * n;
  return partes.map((c) => c / 100);
}

/**
 * Reparte `total` según porcentajes (no hace falta que sumen 100: se usan como pesos). Cada parte se redondea a 2
 * decimales y la diferencia de centavos se ajusta en la última. [] si no hay pesos positivos.
 */
export function repartirPorcentaje(total: number, porcentajes: number[]): number[] {
  const suma = porcentajes.reduce((s, p) => s + (p > 0 ? p : 0), 0);
  if (!(suma > 0) || !Number.isFinite(total)) return [];
  const centavos = Math.round(total * 100);
  const partes = porcentajes.map((p) => Math.round((centavos * (p > 0 ? p : 0)) / suma));
  const diferencia = centavos - partes.reduce((s, c) => s + c, 0);
  partes[partes.length - 1] += diferencia;
  return partes.map((c) => c / 100);
}

/** Días de ejemplo para mostrar el cobro por días: 1, 3, 7 y el máximo (sin repetir, ordenados). */
export function diasDeEjemplo(diasMax: number, diasMin = 1): number[] {
  const base = [1, 3, 7].filter((d) => d >= diasMin && (!(diasMax > 0) || d <= diasMax));
  if (diasMax > 0) base.push(diasMax);
  return [...new Set(base)].sort((a, b) => a - b);
}

/** Formato de montos de La Mundial (es-VE, 2 decimales). */
export const formatoMonto2 = (n: number) =>
  n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Traduce los errores técnicos más comunes de Sis2000/nest-api a un mensaje para un usuario de negocio. Si no
 * reconoce el error, devuelve el texto original (con un prefijo amable).
 */
export function traducirErrorSis2000(mensaje: string): string {
  const m = (mensaje ?? '').trim();
  if (!m) return 'Sis2000 no respondió. Intenta de nuevo en unos minutos.';
  const reglas: Array<[RegExp, string]> = [
    [/PRIMARY KEY|duplicate key|clave duplicada|ya existe/i, 'Ya existe un registro con ese código en Sis2000. Usa otro código o elige el existente.'],
    [/FOREIGN KEY|REFERENCE constraint/i, 'Sis2000 no encontró un dato relacionado (ramo, producto, tarifa o tabla). Revisa que lo elegido exista.'],
    [/cannot insert the value NULL|no admite valores NULL/i, 'Falta un dato obligatorio para Sis2000. Revisa que todos los campos del plan estén llenos.'],
    [/truncat|String or binary data/i, 'Algún texto es más largo de lo que admite Sis2000. Acorta el código o el nombre.'],
    [/timeout|ETIMEDOUT|tiempo de espera/i, 'Sis2000 tardó demasiado en responder. Revisa si el plan se creó antes de intentar otra vez.'],
    [/ECONNREFUSED|fetch failed|Failed to fetch|NetworkError/i, 'No hay conexión con el servidor del configurador. Revisa tu conexión e intenta de nuevo.'],
    [/deadlock|bloque/i, 'Sis2000 está ocupado con otra operación. Espera un momento e intenta de nuevo.'],
    [/\b401\b|\b403\b|no autorizado|forbidden|scope/i, 'No tienes permiso para esta operación en Sis2000. Pide acceso al administrador.'],
  ];
  for (const [patron, texto] of reglas) {
    if (patron.test(m)) return `${texto} (Detalle: ${m})`;
  }
  return m;
}
