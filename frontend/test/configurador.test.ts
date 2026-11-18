// Pruebas del configurador reutilizable (fase 1). Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  advertenciasPorConfirmar,
  contarRevision,
  cuerpoComision,
  cuerpoDeducible,
  cuerpoTasas,
  deducibleDeFila,
  detalleVigente,
  generarTramosPorAncho,
  normalizarComision,
  normalizarRamo,
  normalizarRevision,
  normalizarTasa,
  ordenarRevision,
  siguienteTramo,
  tramosVigentes,
  validarComision,
  validarDeducible,
  validarTramos,
} from '../src/lib/configurador.ts';

const t = (desde: string, hasta: string, valor = '1') => ({ desde, hasta, valor });

describe('validarTramos', () => {
  it('acepta tramos continuos que empiezan en 0', () => {
    assert.deepEqual(validarTramos([t('0', '5'), t('6', '10'), t('11', '99')], { inicio: 0 }), []);
  });
  it('detecta hueco, solape, hasta < desde, inicio y valor', () => {
    const e = validarTramos([t('1', '5'), t('7', '10'), t('10', '8'), t('9', '12', '0')], { inicio: 0, unidad: 'años', nombreValor: 'la tasa' });
    const textos = e.map((x) => x.mensaje).join(' | ');
    assert.match(textos, /primer tramo debe empezar en 0/);
    assert.match(textos, /hueco entre el tramo 1 y el 2: falta de 6 a 6/);
    assert.match(textos, /tramo 3 se solapa con el 2/);
    assert.match(textos, /«hasta» \(8 años\) no puede ser menor/);
    assert.match(textos, /la tasa debe ser mayor que 0/);
    assert.ok(e.every((x) => x.indice >= 0));
  });
  it('sin inicio fijo (tabla de edad) puede empezar en cualquier edad', () => {
    assert.deepEqual(validarTramos([t('18', '64'), t('65', '74')]), []);
  });
  it('tabla vacía', () => {
    assert.equal(validarTramos([])[0].campo, 'tabla');
  });
  it('siguiente tramo y generar por ancho', () => {
    assert.deepEqual(siguienteTramo([t('0', '4')]), { desde: '5', hasta: '9', valor: '' });
    assert.deepEqual(siguienteTramo([]), { desde: '0', hasta: '', valor: '' });
    assert.deepEqual(
      generarTramosPorAncho(0, 11, 5, '2').map((x) => `${x.desde}-${x.hasta}`),
      ['0-4', '5-9', '10-11'],
    );
  });
});

describe('tasas por antigüedad', () => {
  it('toma solo los tramos V de la cobertura y tarifa, en orden', () => {
    const filas = [
      { ccober: '1', ctarifa: '1', nantiguedad_desde: 6, nantiguedad_hasta: 99, pprima: 3, iestado: 'V' },
      { ccober: '1', ctarifa: '1', nantiguedad_desde: 0, nantiguedad_hasta: 5, pprima: 2.5, iestado: 'V' },
      { ccober: '1', ctarifa: '1', nantiguedad_desde: 0, nantiguedad_hasta: 99, pprima: 9, iestado: 'I' },
      { ccober: '2', ctarifa: '1', nantiguedad_desde: 0, nantiguedad_hasta: 99, pprima: 4, iestado: 'V' },
    ].map(normalizarTasa);
    const tramos = tramosVigentes(filas, '1', '1');
    assert.deepEqual(tramos, [t('0', '5', '2.5'), t('6', '99', '3')]);
    assert.deepEqual(cuerpoTasas([t('0', '5', '2,5')]), { tramos: [{ desde: 0, hasta: 5, pprima: 2.5 }] });
  });
});

describe('comisiones', () => {
  it('valida porcentaje 0–100 y fecha', () => {
    const base = { ctipoprod: '1', cproductor: '', ccober: '', ctarifa: '', fdesde: '2026-11-18', pcomision: '10' };
    assert.deepEqual(validarComision(base), {});
    assert.ok(validarComision({ ...base, pcomision: '120' }).pcomision);
    assert.ok(validarComision({ ...base, fdesde: '18/11/2026' }).fdesde);
    assert.deepEqual(cuerpoComision(base), { ctipoprod: 1, cproductor: 0, ccober: '0', ctarifa: '0', fdesde: '2026-11-18', pcomision: 10 });
  });
  it('normaliza filas de nest-api (fechas ISO y aplicaA)', () => {
    const c = normalizarComision({ ctipoprod: 1, cproductor: 0, ccober: '0 ', ctarifa: '0', fdesde: '2026-01-01T00:00:00.000Z', pcomision: '12.50', iestado: 'V', aplicaA: 'ramo' });
    assert.equal(c.fdesde, '2026-01-01');
    assert.equal(c.pcomision, 12.5);
    assert.equal(c.aplicaA, 'ramo');
  });
});

describe('deducibles', () => {
  it('lee la fila, valida y arma el cuerpo (quitar = null solo al editar)', () => {
    const f = deducibleDeFila({ bfraded: 'd', mdedu_fran: 500, pdedu_fran: null });
    assert.deepEqual(f, { bfraded: 'D', mdedu_fran: '500', mdedu_franext: '', pdedu_fran: '' });
    assert.deepEqual(validarDeducible(f), {});
    assert.ok(validarDeducible({ ...f, mdedu_fran: '' }).mdedu_fran);
    assert.ok(validarDeducible({ ...f, pdedu_fran: '150' }).pdedu_fran);
    assert.deepEqual(cuerpoDeducible(f), { bfraded: 'D', mdedu_fran: 500 });
    assert.deepEqual(cuerpoDeducible({ ...f, bfraded: '' }), {});
    assert.deepEqual(cuerpoDeducible({ ...f, bfraded: '' }, true), { bfraded: null, mdedu_fran: 0, mdedu_franext: 0, pdedu_fran: 0 });
  });
  it('tasa vigente = la V más reciente', () => {
    const d = detalleVigente([
      { fdesde: '2025-01-01', iestado: 'V' },
      { fdesde: '2026-06-01', iestado: 'I' },
      { fdesde: '2026-01-01', iestado: 'V' },
    ]);
    assert.equal(d?.fdesde, '2026-01-01');
  });
});

describe('advertencias por confirmar', () => {
  it('en la respuesta, en el cuerpo de un error o nada si ya se confirmó / se guardó', () => {
    assert.deepEqual(advertenciasPorConfirmar({ grabado: false, advertencias: ['Par en ramo 26'] }, false), ['Par en ramo 26']);
    assert.deepEqual(advertenciasPorConfirmar({ cuerpo: { advertencias: [{ mensaje: 'x' }] } }, false), ['x']);
    assert.deepEqual(advertenciasPorConfirmar({ grabado: true, advertencias: ['a'] }, false), []);
    assert.deepEqual(advertenciasPorConfirmar({ advertencias: ['a'] }, false), []);
    assert.deepEqual(advertenciasPorConfirmar({ grabado: false, advertencias: ['a'] }, true), []);
  });
});

describe('ramo y revisión', () => {
  it('familia desconocida = cosas; las secciones se respetan tal cual', () => {
    const r = normalizarRamo({ cramo: 18, xdescripcion_l: 'AUTOMÓVIL', familia: 'auto', secciones: ['coberturas', 'tipos-uso', 'revision'] });
    assert.equal(r.familia, 'auto');
    assert.deepEqual(r.secciones, ['coberturas', 'tipos-uso', 'revision']);
    assert.equal(normalizarRamo({ cramo: 99, familia: 'otra' }).familia, 'cosas');
  });
  it('ordena errores, avisos y ok, y los cuenta', () => {
    const rev = normalizarRevision({
      familia: 'auto',
      listo: false,
      items: [
        { codigo: 'a', nivel: 'ok', mensaje: 'bien', seccion: 'comisiones' },
        { codigo: 'b', nivel: 'error', mensaje: 'mal', seccion: 'tipos-uso' },
        { codigo: 'c', nivel: 'aviso', mensaje: 'ojo', seccion: 'tarifas' },
      ],
    });
    assert.deepEqual(ordenarRevision(rev.items).map((i) => i.codigo), ['b', 'c', 'a']);
    assert.deepEqual(contarRevision(rev.items), { error: 1, aviso: 1, ok: 1 });
  });
});
