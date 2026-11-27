import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clavesDeRuta, construirMigas } from '../src/lib/migas.ts';

describe('migas de pan Sis2000', () => {
  it('no hay migas fuera de /sis2000 ni en la raíz', () => {
    assert.deepEqual(construirMigas('/'), []);
    assert.deepEqual(construirMigas('/sis2000'), []);
  });
  it('detalles de tarifa con nombres legibles', () => {
    const m = construirMigas('/sis2000/ramo/18/coberturas/RCV01/tarifas/T1/detalles', {
      ramo: 'RCV',
      cobertura: 'Daños a cosas',
      tarifa: 'Tarifa anual',
    });
    assert.deepEqual(
      m.map((x) => x.label),
      ['Sis2000', 'Ramos', 'RCV (18)', 'Daños a cosas', 'Tarifa anual', 'Detalles'],
    );
    assert.equal(m[2].href, '/sis2000/ramo/18/coberturas');
    assert.equal(m[5].href, undefined);
  });
  it('sin nombres usa el código', () => {
    const m = construirMigas('/sis2000/ramo/18/coberturas/A/tarifas/new');
    assert.deepEqual(m.map((x) => x.label), ['Sis2000', 'Ramos', 'Ramo 18', 'Cobertura A', 'Nueva tarifa']);
  });
  it('claves de la ruta', () => {
    assert.deepEqual(clavesDeRuta('/sis2000/ramo/9/coberturas/X%20Y'), { cramo: '9', ccobertura: 'X Y', ctarifa: null });
  });
});
