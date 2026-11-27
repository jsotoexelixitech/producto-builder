import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeValor } from '../src/lib/estado-chip.ts';

describe('estadoDeValor', () => {
  it('traduce los valores de Sis2000 y del configurador', () => {
    assert.equal(estadoDeValor('A'), 'activo');
    assert.equal(estadoDeValor(' i '), 'inactivo');
    assert.equal(estadoDeValor('DRAFT'), 'borrador');
    assert.equal(estadoDeValor('error'), 'errores');
    assert.equal(estadoDeValor(true), 'activo');
    assert.equal(estadoDeValor(null), 'otro');
    assert.equal(estadoDeValor('XYZ'), 'otro');
  });
});
