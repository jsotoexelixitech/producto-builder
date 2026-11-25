// Pruebas de las ayudas del panel lateral: estimado de prima, checklist y resumen. Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aNumeroEs, estimarPrimaAuto } from '../src/lib/ayudas/prima-auto.ts';
import { construirChecklist } from '../src/lib/ayudas/checklist.ts';
import { resumenEnPalabras } from '../src/lib/ayudas/resumen-plan.ts';

describe('estimado de prima de auto', () => {
  it('suma x tasa diaria x días, y descuento por deducible', () => {
    const e = estimarPrimaAuto({ suma: 20000, tasaDiariaPct: 0.072, dias: 30, descuentoPct: 45 });
    assert.deepEqual(e, { primaBase: 432, descuento: 194.4, primaFinal: 237.6 });
  });
  it('rústico y pick-up', () => {
    const r = estimarPrimaAuto({ suma: 20000, tasaDiariaPct: 0.09, dias: 30, descuentoPct: 45 });
    assert.equal(r?.primaBase, 540);
    assert.equal(r?.primaFinal, 297);
    const p = estimarPrimaAuto({ suma: 20000, tasaDiariaPct: 0.106, dias: 30, descuentoPct: 45 });
    assert.equal(p?.primaBase, 636);
    assert.equal(p?.primaFinal, 349.8);
  });
  it('sin deducible no descuenta', () => {
    assert.deepEqual(estimarPrimaAuto({ suma: 20000, tasaDiariaPct: 0.072, dias: 30 }), { primaBase: 432, descuento: 0, primaFinal: 432 });
  });
  it('datos inválidos dan null', () => {
    assert.equal(estimarPrimaAuto({ suma: 0, tasaDiariaPct: 0.07, dias: 30 }), null);
    assert.equal(estimarPrimaAuto({ suma: 100, tasaDiariaPct: NaN, dias: 30 }), null);
    assert.equal(estimarPrimaAuto({ suma: 100, tasaDiariaPct: 0.07, dias: 0 }), null);
    assert.equal(estimarPrimaAuto({ suma: 100, tasaDiariaPct: 0.07, dias: 30, descuentoPct: 120 }), null);
  });
  it('lee números con coma o punto', () => {
    assert.equal(aNumeroEs('0,072'), 0.072);
    assert.equal(aNumeroEs('0.072'), 0.072);
    assert.equal(aNumeroEs('20.000'), 20000);
    assert.equal(aNumeroEs('20.000,50'), 20000.5);
    assert.ok(Number.isNaN(aNumeroEs('abc')));
    assert.ok(Number.isNaN(aNumeroEs('')));
  });
});

describe('checklist «¿Se puede emitir?»', () => {
  it('cuenta lo hecho y dice qué falta', () => {
    const c = construirChecklist(
      [
        { indice: 0, titulo: 'Producto', faltas: [] },
        { indice: 1, titulo: 'Coberturas', faltas: ['Marca al menos una cobertura', 'Otra cosa'] },
      ],
      [
        { indice: 5, titulo: 'Deducibles', estado: 'hecho' },
        { indice: 6, titulo: 'Pagos', estado: 'bloqueado' },
      ],
    );
    assert.equal(c.hechos, 2);
    assert.equal(c.total, 4);
    assert.equal(c.porcentaje, 50);
    assert.equal(c.puedeEmitir, false);
    assert.equal(c.items[1].estado, 'falta');
    assert.equal(c.items[1].detalle, 'Marca al menos una cobertura (y 1 más)');
    assert.equal(c.items[3].estado, 'bloqueado');
  });
  it('todo hecho = se puede emitir; sin items no', () => {
    assert.equal(construirChecklist([{ indice: 0, titulo: 'Producto', faltas: [] }], []).puedeEmitir, true);
    assert.equal(construirChecklist([], []).puedeEmitir, false);
  });
});

describe('resumen en palabras', () => {
  const base = { modoEdicion: false, cplan: 'RENTA1', nombrePlan: 'Renta Seguro', producto: 'Auto Renta Seguro', personas: false, coberturas: 1, moneda: '$', formasDePago: 1 };
  it('plan nuevo', () => {
    assert.equal(
      resumenEnPalabras(base),
      'Se creará el plan RENTA1 («Renta Seguro») en el producto Auto Renta Seguro, con 1 cobertura, 1 forma de pago, moneda $.',
    );
  });
  it('edición, varias coberturas y sin código', () => {
    assert.match(resumenEnPalabras({ ...base, modoEdicion: true, coberturas: 3, formasDePago: 2 }), /^Se guardarán los cambios del plan RENTA1.*3 coberturas, 2 formas de pago/);
    assert.match(resumenEnPalabras({ ...base, cplan: '', nombrePlan: '', coberturas: 0 }), /\(todavía sin código\).*sin coberturas marcadas/);
  });
});
