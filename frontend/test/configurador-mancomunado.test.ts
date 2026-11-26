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

describe('mancomunado pendiente al crear el plan', () => {
  const ok = { activo: true, filas: [f(80080, '60'), f(1001, '40')] };

  it('reglas: mínimo 2, sin repetidos, suma 100 y solo si está activo', async () => {
    const m = await import('../src/lib/configurador-mancomunado.ts');
    assert.equal(m.errorPendienteMancomunado({ activo: false, filas: [f(1, '5')] }), null);
    assert.equal(m.errorPendienteMancomunado(ok), null);
    assert.match(m.errorPendienteMancomunado({ activo: true, filas: [f(1, '100')] }) ?? '', /al menos 2/);
    assert.match(m.errorPendienteMancomunado({ activo: true, filas: [f(1, '50'), f(1, '50')] }) ?? '', /repetido/);
    assert.match(m.errorPendienteMancomunado({ activo: true, filas: [f(1, '50'), f(2, '40')] }) ?? '', /suman 90/);
    assert.equal(m.resumenMancomunado(m.PENDIENTE_MANC_VACIO), 'No');
    assert.match(m.resumenMancomunado(ok), /80080 60 %, 1001 40 %/);
  });

  it('crea el plan primero y después hace el PUT; sin cambios no llama a nada', async () => {
    const m = await import('../src/lib/configurador-mancomunado.ts');
    const orden: string[] = [];
    const crearPlan = async () => { orden.push('crear plan'); };
    await crearPlan();
    const r = await m.aplicarMancomunadoPendiente(ok, m.PENDIENTE_MANC_VACIO, {
      guardar: async (c) => { orden.push(`PUT ${JSON.stringify(c)}`); },
      desactivar: async () => { orden.push('DELETE'); },
    });
    assert.equal(r.estado, 'guardado');
    assert.deepEqual(orden, ['crear plan', 'PUT {"productores":[{"cproductor":80080,"ppart":60},{"cproductor":1001,"ppart":40}]}']);
    const nada = await m.aplicarMancomunadoPendiente(m.PENDIENTE_MANC_VACIO, m.PENDIENTE_MANC_VACIO, { guardar: async () => assert.fail(), desactivar: async () => assert.fail() });
    assert.equal(nada.estado, 'sin-cambios');
  });

  it('en edición: apagar lo que había hace DELETE', async () => {
    const m = await import('../src/lib/configurador-mancomunado.ts');
    let borrado = false;
    const r = await m.aplicarMancomunadoPendiente(m.PENDIENTE_MANC_VACIO, ok, { guardar: async () => assert.fail(), desactivar: async () => { borrado = true; } });
    assert.equal(r.estado, 'desactivado');
    assert.ok(borrado);
  });

  it('409 (dominio no creado) no lanza: aviso claro y lo elegido no se pierde', async () => {
    const m = await import('../src/lib/configurador-mancomunado.ts');
    const r = await m.aplicarMancomunadoPendiente(ok, m.PENDIENTE_MANC_VACIO, {
      guardar: async () => { throw Object.assign(new Error('conflicto'), { status: 409 }); },
      desactivar: async () => undefined,
    });
    assert.equal(r.estado, 'fallo');
    assert.match(r.aviso ?? '', /PLAN_MANCOMUNADO.*script del DBA/);
    assert.equal(ok.filas.length, 2);
  });

  it('otro error: aviso con el motivo', async () => {
    const m = await import('../src/lib/configurador-mancomunado.ts');
    const r = await m.aplicarMancomunadoPendiente(ok, m.PENDIENTE_MANC_VACIO, { guardar: async () => { throw new Error('sin conexión'); }, desactivar: async () => undefined });
    assert.match(r.aviso ?? '', /sin conexión/);
  });
});
