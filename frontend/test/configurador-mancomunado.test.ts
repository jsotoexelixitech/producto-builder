// Mancomunados por plan: lectura del JSON, suma en vivo y validación (mismas reglas que nest-api).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cuerpoMancomunado, filasDeConfig, mancomunadoValido, sumaPorcentajes, validarMancomunado } from '../src/lib/configurador-mancomunado.ts';

const f = (cproductor: number, ppart: string) => ({ cproductor, ppart });

describe('mancomunado', () => {
  it('lee el JSON del contrato y arma el mismo cuerpo', () => {
    const filas = filasDeConfig({ cramo: 18, productores: [{ cproductor: 80080, ppart: 60 }, { cproductor: 1001, ppart: 40 }] });
    assert.deepEqual(filas, [f(80080, '60'), f(1001, '40')]);
    assert.ok(mancomunadoValido(validarMancomunado(filas)));
    assert.deepEqual(cuerpoMancomunado(filas), { productores: [{ cproductor: 80080, ppart: 60 }, { cproductor: 1001, ppart: 40 }] });
    assert.deepEqual(filasDeConfig(null), []);
  });

  it('la suma en vivo no acumula error de coma flotante y acepta coma decimal', () => {
    assert.equal(sumaPorcentajes([f(1, '33,3333'), f(2, '33.3333'), f(3, '33.3334')]), 100);
    assert.equal(sumaPorcentajes([f(1, '0.1'), f(2, '0.2'), f(3, 'x')]), 0.3);
  });

  it('rechaza menos de 2, repetidos, % <= 0, más de 4 decimales y suma distinta de 100', () => {
    assert.match(validarMancomunado([f(1, '100')]).general ?? '', /al menos 2/);
    assert.equal(validarMancomunado([f(1, '50'), f(1, '50')]).porProductor[1], 'Productor repetido.');
    assert.match(validarMancomunado([f(1, '0'), f(2, '100')]).porProductor[1], /mayor que 0/);
    assert.match(validarMancomunado([f(1, '50.12345'), f(2, '49.87655')]).porProductor[1], /decimales/);
    assert.match(validarMancomunado([f(1, '60'), f(2, '39.9999')]).general ?? '', /suman 99.9999/);
  });
});
