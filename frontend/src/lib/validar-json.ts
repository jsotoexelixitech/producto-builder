/** Revisa que el texto sea un objeto JSON (misma comprobación que al guardar). Devuelve el problema o null. */
export function validarJsonObjeto(texto: string): string | null {
  if (!texto.trim()) return 'El JSON está vacío.';
  try {
    const v: unknown = JSON.parse(texto);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return 'Debe ser un objeto JSON, entre llaves { }.';
    return null;
  } catch (e) {
    return `El JSON no es válido: ${e instanceof Error ? e.message : 'revisa comas, comillas y llaves'}.`;
  }
}
