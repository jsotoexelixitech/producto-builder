// Auto configurable (tasa diaria por tipo de vehículo y descuento por deducible). Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coberturasUnicas,
  cuerpoDeducibles,
  cuerpoTasaDiaria,
  deduciblesDeConfig,
  deduciblesValidos,
  normalizarParametroAuto,
  sinErrores,
  tasaAnualTexto,
  tasaDiariaDeConfig,
  validarDeducibles,
  validarTasaDiaria,
} from '../src/lib/configurador-auto.ts';

describe('tasa diaria', () => {
  const config = { cramo: 18, coberturas: ['1', '2', '28'], tasas: { '1': 0.072, '2': 0.09, '9': 0.106 }, tasa_defecto: null, dias_min: 1, dias_max: 365 };

  it('lee el JSON del contrato y arma el mismo cuerpo de vuelta', () => {
    const f = tasaDiariaDeConfig(config);
    assert.deepEqual(f.tasas, { '1': '0.072', '2': '0.09', '9': '0.106' });
    assert.ok(sinErrores(validarTasaDiaria(f)));
    assert.deepEqual(cuerpoTasaDiaria(f), {
      coberturas: ['1', '2', '28'],
      tasas: [{ ctipo: 1, tasa: 0.072 }, { ctipo: 2, tasa: 0.09 }, { ctipo: 9, tasa: 0.106 }],
      tasa_defecto: null,
      dias_min: 1,
      dias_max: 365,
    });
  });

  it('acepta coma decimal y deja fuera los tipos vacíos', () => {
    const f = { ...tasaDiariaDeConfig(null), coberturas: ['1'], tasas: { '1': '0,072', '2': '' } };
    assert.deepEqual(cuerpoTasaDiaria(f).tasas, [{ ctipo: 1, tasa: 0.072 }]);
  });

  it('valida coberturas, tasas > 0 y días mín ≤ máx', () => {
    const e = validarTasaDiaria({ coberturas: [], tasas: { '1': '0' }, tasa_defecto: '', dias_min: '10', dias_max: '5' });
    assert.ok(e.coberturas);
    assert.ok(e.porTipo?.['1']);
    assert.match(String(e.dias_max), /menor/);
    assert.ok(validarTasaDiaria({ coberturas: ['1'], tasas: {}, tasa_defecto: '', dias_min: '1', dias_max: '1' }).tasas);
    assert.ok(sinErrores(validarTasaDiaria({ coberturas: ['1'], tasas: {}, tasa_defecto: '0.08', dias_min: '1', dias_max: '1' })));
  });

  it('tasa anual equivalente = diaria × 365 (solo ayuda)', () => {
    assert.equal(tasaAnualTexto('0.072'), '26,28');
    assert.equal(tasaAnualTexto('0,106'), '38,69');
    assert.equal(tasaAnualTexto(''), '');
  });
});

describe('descuento por deducible', () => {
  it('lee, valida y arma el cuerpo ordenado por deducible', () => {
    const f = deduciblesDeConfig({ coberturas: ['1'], opciones: [{ pdeducible: 5, pdescuento: 45 }, { pdeducible: 3, pdescuento: 25 }], obligatorio: false });
    assert.ok(deduciblesValidos(validarDeducibles(f)));
    assert.deepEqual(cuerpoDeducibles(f), {
      coberturas: ['1'],
      aplica: 'PARCIAL',
      opciones: [{ pdeducible: 3, pdescuento: 25 }, { pdeducible: 5, pdescuento: 45 }],
      obligatorio: false,
    });
  });

  it('marca repetidos, fuera de rango y lista vacía', () => {
    const v = validarDeducibles({ coberturas: ['1'], aplica: 'PARCIAL', obligatorio: false, opciones: [{ pdeducible: '3', pdescuento: '25' }, { pdeducible: '3', pdescuento: '120' }] });
    assert.equal(v.filas[1].pdeducible, 'Deducible repetido.');
    assert.ok(v.filas[1].pdescuento);
    assert.ok(!deduciblesValidos(validarDeducibles({ coberturas: [], aplica: '', obligatorio: false, opciones: [] })));
  });
});

describe('envoltorio y coberturas', () => {
  it('normaliza la respuesta del GET (dominio sin crear, fila de otro ramo)', () => {
    const p = normalizarParametroAuto({ dominioCreado: false, existe: false, activo: null, config: null, otroRamo: null });
    assert.equal(p.dominioCreado, false);
    assert.equal(normalizarParametroAuto({ otroRamo: 28 }).otroRamo, 28);
  });

  it('una casilla por cobertura aunque el plan la tenga con varias tarifas', () => {
    assert.deepEqual(coberturasUnicas([{ ccobertura: '1', nombre: 'Amplia' }, { ccobertura: '1', nombre: 'Amplia (t2)' }, { ccobertura: '28', nombre: 'Parcial' }]), [
      { ccobertura: '1', nombre: 'Amplia' },
      { ccobertura: '28', nombre: 'Parcial' },
    ]);
  });
});
