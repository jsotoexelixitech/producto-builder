// Pruebas del mapa del plan y de la serie de tarifas por edad. Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirMapa, serieTarifaEdad } from '../src/lib/ayudas/mapa-plan.ts';

describe('mapa del plan', () => {
  it('une producto, plan, coberturas y tarifas (una tarifa repetida es un solo nodo)', () => {
    const { nodos, aristas } = construirMapa({
      producto: 'Auto Renta Seguro',
      plan: 'RENTA1 · Renta',
      coberturas: [
        { codigo: 'A', nombre: 'Casco', tarifa: 'T1' },
        { codigo: 'B', nombre: 'RC', tarifa: 'T1' },
        { codigo: 'C', nombre: 'Sin tarifa', tarifa: '' },
      ],
      tablasEdad: [],
    });
    assert.equal(nodos.filter((n) => n.tipo === 'cobertura').length, 3);
    assert.equal(nodos.filter((n) => n.tipo === 'tarifa').length, 1);
    assert.equal(aristas.length, 1 + 3 + 2);
    assert.ok(aristas.every((a) => nodos.some((n) => n.id === a.origen) && nodos.some((n) => n.id === a.destino)));
  });
  it('sin coberturas igual arma producto y plan', () => {
    const { nodos } = construirMapa({ producto: '', plan: '', coberturas: [], tablasEdad: [] });
    assert.equal(nodos.length, 2);
    assert.equal(nodos[0].etiqueta, 'Producto sin elegir');
  });
});

describe('serie de tarifa por edad', () => {
  it('ordena por edad y no grafica sin tramos', () => {
    const s = serieTarifaEdad({ codigo: 'T', nombre: 'T', tramos: [{ desde: 30, hasta: 39, tasa: 0.5 }, { desde: 0, hasta: 29, tasa: 0.3, prima: 10 }] });
    assert.deepEqual(s.map((p) => p.tramo), ['0–29', '30–39']);
    assert.equal(s[0].prima, 10);
    assert.deepEqual(serieTarifaEdad(undefined), []);
    assert.deepEqual(serieTarifaEdad({ codigo: 'T', nombre: 'T', tramos: [] }), []);
  });
});
