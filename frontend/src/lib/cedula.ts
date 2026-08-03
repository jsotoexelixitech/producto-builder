/** Formato venezolano: V-12345678, E-12345678, J-123456789, G-123456789, P-123456789 */
const CEDULA_DISPLAY = /^[VEJGP]-?\d{6,9}$/i;
const CEDULA_NORMALIZED = /^[VEJGP]-\d{6,9}$/;

export function formatCedulaInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^VEJGP0-9-]/g, '');
  if (!cleaned) return '';

  const letterMatch = cleaned.match(/^([VEJGP])/);
  if (!letterMatch) {
    const digitsOnly = cleaned.replace(/\D/g, '').slice(0, 9);
    return digitsOnly ? `V-${digitsOnly}` : '';
  }

  const letter = letterMatch[1];
  const digits = cleaned.slice(letter.length).replace(/\D/g, '').slice(0, 9);
  if (!digits) return `${letter}-`;
  return `${letter}-${digits}`;
}

export function normalizeCedula(value: string): string {
  const formatted = formatCedulaInput(value);
  if (!formatted || formatted.endsWith('-')) return formatted;
  return formatted;
}

export function isValidCedulaFormat(value: string): boolean {
  const n = normalizeCedula(value.trim());
  return CEDULA_NORMALIZED.test(n);
}

export function validateCedulaField(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length < 5) return 'Debe tener al menos 5 caracteres.';
  if (!isValidCedulaFormat(trimmed)) {
    return 'Formato: V-12345678 (letra V, E, J, G o P, guion y 6 a 9 dígitos).';
  }
  if (!CEDULA_DISPLAY.test(trimmed.replace(/\s/g, ''))) {
    return 'Formato: V-12345678 (letra V, E, J, G o P, guion y 6 a 9 dígitos).';
  }
  return undefined;
}
