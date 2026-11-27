import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validarJsonObjeto } from '../src/lib/validar-json.ts';

describe('validarJsonObjeto', () => {
  it('acepta un objeto', () => assert.equal(validarJsonObjeto('{"a":1}'), null));
  it('rechaza vacío, arreglos y sintaxis rota', () => {
    assert.match(validarJsonObjeto('  ') ?? '', /vacío/);
    assert.match(validarJsonObjeto('[1]') ?? '', /objeto/);
    assert.match(validarJsonObjeto('{"a":') ?? '', /no es válido/);
  });
});
