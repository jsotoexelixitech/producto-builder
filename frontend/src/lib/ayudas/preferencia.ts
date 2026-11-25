// Preferencia «Vista con ayudas / Vista clásica». Funciones puras (el almacenamiento se pasa de fuera): se prueban en node.
export const CLAVE_AYUDAS = 'ipb:ayudas-visuales';

export interface AlmacenTexto {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/** Por defecto CON ayudas; solo «0» (vista clásica) la apaga. Si el almacenamiento falla, queda con ayudas. */
export function leerPreferenciaAyudas(almacen: AlmacenTexto | null | undefined): boolean {
  try {
    return almacen?.getItem(CLAVE_AYUDAS) !== '0';
  } catch {
    return true;
  }
}

export function guardarPreferenciaAyudas(almacen: AlmacenTexto | null | undefined, activas: boolean): void {
  try {
    almacen?.setItem(CLAVE_AYUDAS, activas ? '1' : '0');
  } catch {
    // sin almacenamiento (ventana privada, bloqueado): la vista sigue funcionando, solo no se recuerda
  }
}
