import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { filasCotizacion, listaDe } from '../src/partner-bridge/cotizacion.mapper';

describe('filasCotizacion', () => {
  it('personas (spCalculoPer): ccobertura → ccober, sin comisión, con la tasa de mamonedas', () => {
    const filas = filasCotizacion({
      familia: 'personas',
      ptasamon: 916.6477,
      cmoneda: '$',
      detalle: [{ ccobertura: 1, xcobertura: ' MUERTE ', msumaasegext: 1000, mprima: 9166.48, mprimaext: 10 }],
    });
    assert.equal(filas.length, 1);
    assert.equal(filas[0].ccober, '1');
    assert.equal(filas[0].xcobertura, 'MUERTE');
    assert.equal(filas[0].mprimaext, 10);
    assert.equal(filas[0].mcomisionext, 0);
    assert.equal(filas[0].ptasamon, 916.6477);
  });

  it('cosas (spCalculoRiesgoGeneral): conserva ccober y la comisión', () => {
    const [f] = filasCotizacion({ familia: 'cosas', ptasamon: 1, detalle: [{ ccober: '3', mprimaext: 5, mcomisionext: 1 }] });
    assert.equal(f.ccober, '3');
    assert.equal(f.mcomisionext, 1);
  });

  it('sin detalle → []', () => {
    assert.deepEqual(filasCotizacion(null), []);
  });
});

describe('listaDe', () => {
  it('saca contratos y ramos de reaseguro del objeto de nest-api', () => {
    const data = { contratos: [{ ccont: 6005 }], ramos: [{ cramorea: 102 }] };
    assert.deepEqual(listaDe(data, 'contratos'), [{ ccont: 6005 }]);
    assert.deepEqual(listaDe(data, 'ramos'), [{ cramorea: 102 }]);
    assert.deepEqual(listaDe(undefined, 'ramos'), []);
  });
});
