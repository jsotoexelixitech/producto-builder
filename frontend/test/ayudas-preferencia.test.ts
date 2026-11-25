// Pruebas de la preferencia «Vista con ayudas / Vista clásica». Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVE_AYUDAS, guardarPreferenciaAyudas, leerPreferenciaAyudas } from '../src/lib/ayudas/preferencia.ts';

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = { ...inicial };
  return { datos, getItem: (k: string) => datos[k] ?? null, setItem: (k: string, v: string) => void (datos[k] = v) };
}

describe('preferencia de ayudas', () => {
  it('por defecto va con ayudas', () => {
    assert.equal(leerPreferenciaAyudas(almacenFalso()), true);
    assert.equal(leerPreferenciaAyudas(null), true);
  });
  it('guarda y recuerda la vista clásica', () => {
    const a = almacenFalso();
    guardarPreferenciaAyudas(a, false);
    assert.equal(a.datos[CLAVE_AYUDAS], '0');
    assert.equal(leerPreferenciaAyudas(a), false);
    guardarPreferenciaAyudas(a, true);
    assert.equal(leerPreferenciaAyudas(a), true);
  });
  it('si el almacenamiento falla no rompe', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    assert.equal(leerPreferenciaAyudas(roto), true);
    assert.doesNotThrow(() => guardarPreferenciaAyudas(roto, false));
  });
});
