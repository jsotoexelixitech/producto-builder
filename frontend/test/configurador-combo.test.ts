// Pasos de «completar el plan» en el Combo. Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ETIQUETA_ESTADO, estadoGrupo, grupoDeSeccion, gruposCompletar, nombreProductoDelPlan, parentescosDelPlan, textoEdades,
} from '../src/lib/configurador-combo.ts';
import { SECCION_INFO, infoSeccion } from '../src/lib/configurador.ts';

const AUTO = ['producto', 'plan', 'coberturas', 'tarifas', 'deducibles', 'frecuencias', 'quien-vende', 'comisiones', 'tipos-uso', 'tasas-antiguedad', 'tasa-casco', 'tarifa-dias', 'descuentos-recargos', 'proveedores', 'revision'];
const PERSONAS = ['producto', 'plan', 'coberturas', 'deducibles', 'frecuencias', 'canales', 'comisiones', 'edades-parentesco', 'tablas-edad', 'proveedores', 'revision'];
const PATRIMONIAL = ['producto', 'plan', 'coberturas', 'tarifas', 'deducibles', 'frecuencias', 'quien-vende', 'comisiones', 'proveedores', 'condominio', 'revision'];
const FIANZAS = ['producto', 'plan', 'coberturas', 'revision'];
const ids = (g: ReturnType<typeof gruposCompletar>) => g.map((x) => x.id);

describe('grupos de completar por familia', () => {
  it('auto: vehículo y tarifa, deducibles, pagos, quién vende, proveedores y revisión', () => {
    const g = gruposCompletar('auto', AUTO);
    assert.deepEqual(ids(g), ['tarifa', 'deducibles', 'pagos', 'vende', 'proveedores', 'revision']);
    assert.equal(g[0].titulo, 'Vehículo y tarifa');
    assert.deepEqual(g[0].secciones, ['tipos-uso', 'tasas-antiguedad', 'tasa-casco', 'tarifa-dias', 'descuentos-recargos']);
    assert.equal(g[3].titulo, 'Quién lo vende y comisiones');
  });
  it('no repite lo que el combo ya hace (producto, plan, coberturas, tarifas)', () => {
    const todas = gruposCompletar('auto', AUTO).flatMap((x) => x.secciones);
    for (const s of ['producto', 'plan', 'coberturas', 'tarifas']) assert.ok(!todas.includes(s));
  });
  it('personas: edades y tablas; canales y quién vende salen una sola vez', () => {
    const g = gruposCompletar('personas', PERSONAS);
    assert.equal(g[0].titulo, 'Edades y tablas');
    assert.deepEqual(g[0].secciones, ['edades-parentesco', 'tablas-edad']);
    assert.deepEqual(g.find((x) => x.id === 'vende')?.secciones, ['canales', 'comisiones']);
    const dup = gruposCompletar('personas', [...PERSONAS, 'quien-vende']);
    assert.deepEqual(dup.find((x) => x.id === 'vende')?.secciones, ['quien-vende', 'comisiones']);
  });
  it('patrimonial: tarifa del ramo con condominio y sin pasos de vehículo', () => {
    const g = gruposCompletar('patrimonial', PATRIMONIAL);
    assert.equal(g[0].titulo, 'Tarifa del ramo');
    assert.deepEqual(g[0].secciones, ['condominio']);
    assert.ok(ids(g).includes('proveedores'));
    assert.equal(g.find((x) => x.id === 'proveedores')?.resumen, 'Proveedores de servicio del plan (grúa, clínicas, asistencia…)');
  });
  it('fianzas: solo lo que declara el ramo (revisión)', () => {
    assert.deepEqual(ids(gruposCompletar('fianzas', FIANZAS)), ['revision']);
  });
  it('una sección desconocida va a «Otras secciones» antes de la revisión', () => {
    const g = gruposCompletar('auto', ['coberturas', 'deducibles', 'nueva-seccion', 'revision']);
    assert.deepEqual(ids(g), ['deducibles', 'otros', 'revision']);
    assert.deepEqual(g[1].secciones, ['nueva-seccion']);
  });
  it('sin secciones del ramo usa las genéricas del contrato', () => {
    assert.deepEqual(ids(gruposCompletar(null, [])), ['deducibles', 'pagos', 'vende', 'revision']);
  });
  it('grupoDeSeccion: canales cae en quién lo vende; lo del combo no tiene grupo', () => {
    const g = gruposCompletar('auto', AUTO);
    assert.equal(grupoDeSeccion(g, 'tasa-casco'), 'tarifa');
    assert.equal(grupoDeSeccion(g, 'canales'), 'vende');
    assert.equal(grupoDeSeccion(g, 'coberturas'), null);
  });
});

describe('estado de cada paso', () => {
  const g = gruposCompletar('auto', AUTO);
  const base = { planListo: true, visitados: new Set<string>(), items: null, revisionListo: null };
  it('antes de guardar todos están bloqueados', () => {
    for (const x of g) assert.equal(estadoGrupo(x, { ...base, planListo: false }), 'bloqueado');
    assert.equal(ETIQUETA_ESTADO.bloqueado, 'Se habilita al guardar el plan');
  });
  it('sin dato de la revisión solo se sabe si se visitó', () => {
    assert.equal(estadoGrupo(g[1], base), 'sin-visitar');
    assert.equal(estadoGrupo(g[1], { ...base, visitados: new Set(['deducibles']) }), 'visitado');
  });
  it('con la revisión: error = falta, aviso = revisar, solo ok = hecho', () => {
    const items = [
      { codigo: 'a', nivel: 'error' as const, mensaje: '', seccion: 'comisiones' },
      { codigo: 'b', nivel: 'aviso' as const, mensaje: '', seccion: 'deducibles' },
      { codigo: 'c', nivel: 'ok' as const, mensaje: '', seccion: 'frecuencias' },
      { codigo: 'd', nivel: 'ok' as const, mensaje: '', seccion: 'tasa-casco' },
      { codigo: 'e', nivel: 'error' as const, mensaje: '', seccion: 'tasa-casco' },
    ];
    const e = { ...base, items };
    assert.equal(estadoGrupo(g.find((x) => x.id === 'vende')!, e), 'falta');
    assert.equal(estadoGrupo(g.find((x) => x.id === 'deducibles')!, e), 'revisar');
    assert.equal(estadoGrupo(g.find((x) => x.id === 'pagos')!, e), 'hecho');
    assert.equal(estadoGrupo(g.find((x) => x.id === 'tarifa')!, e), 'falta');
    assert.equal(estadoGrupo(g.find((x) => x.id === 'proveedores')!, e), 'sin-visitar');
  });
  it('la revisión lista = hecho; con errores = falta', () => {
    const rev = g.find((x) => x.id === 'revision')!;
    assert.equal(estadoGrupo(rev, { ...base, revisionListo: true, items: [] }), 'hecho');
    assert.equal(estadoGrupo(rev, { ...base, items: [{ codigo: 'a', nivel: 'error', mensaje: '', seccion: 'comisiones' }] }), 'falta');
  });
});

describe('ayudas de las secciones', () => {
  it('las del ramo completo se marcan y traen ejemplo', () => {
    for (const s of ['tipos-uso', 'tasa-casco', 'descuentos-recargos']) assert.equal(infoSeccion(s).afectaRamo, true);
    assert.notEqual(infoSeccion('deducibles').afectaRamo, true);
    assert.match(infoSeccion('tarifa-dias').ejemplo ?? '', /432/);
    assert.match(infoSeccion('tarifa-dias').ejemplo ?? '', /237,60/);
  });
  it('el texto visible no lleva nombres de tablas ni «vendedor»', () => {
    for (const info of Object.values(SECCION_INFO)) {
      const visible = `${info.ayuda ?? ''} ${info.ejemplo ?? ''}`;
      assert.doesNotMatch(visible, /\bma(plan|tarifa|cat|usu|arancel|prod)\w*|\w+_\w+/i);
      assert.doesNotMatch(visible, /vendedor/i);
    }
  });
});

describe('plan de personas con edades distintas por parentesco', () => {
  // VIAJE6 (ramo 25): Titular 0-74, Cónyuge 18-74, Hijo(a) 0-25, Padres 18-74; misma tabla por cobertura.
  const paren = (cparen: number, min: number, max: number, csexo = 'A') => ({ cparen, csexo, ctablatar: 'VIAJE70', nedad_min: min, nedad_max: max });
  const viaje6 = ['38', '39', '40'].map((ccobertura) => ({
    ccobertura,
    ctarifa: '1',
    parentescos: [paren(6, 18, 74), paren(1, 0, 74), paren(2, 18, 74), paren(3, 0, 25)],
  }));

  it('detecta que las edades varían y devuelve los parentescos tal como están, por código', () => {
    const r = parentescosDelPlan(viaje6);
    assert.equal(r.varian, true);
    assert.equal(r.igualesEnTodas, true);
    assert.deepEqual(r.lista, [
      { cparen: 1, csexo: 'A', nedad_min: 0, nedad_max: 74 },
      { cparen: 2, csexo: 'A', nedad_min: 18, nedad_max: 74 },
      { cparen: 3, csexo: 'A', nedad_min: 0, nedad_max: 25 },
      { cparen: 6, csexo: 'A', nedad_min: 18, nedad_max: 74 },
    ]);
  });
  it('mismas edades y sexo para todos: no varían (el formulario los edita como siempre)', () => {
    const r = parentescosDelPlan([{ ccobertura: '1', parentescos: [paren(1, 0, 74), paren(2, 0, 74)] }]);
    assert.equal(r.varian, false);
    assert.equal(r.igualesEnTodas, true);
  });
  it('el sexo distinto por parentesco también cuenta como variación', () => {
    assert.equal(parentescosDelPlan([{ ccobertura: '1', parentescos: [paren(1, 0, 74, 'M'), paren(2, 0, 74, 'F')] }]).varian, true);
  });
  it('coberturas con parentescos distintos: no son iguales en todas (eso sí impide guardar)', () => {
    const r = parentescosDelPlan([viaje6[0], { ccobertura: '41', parentescos: [paren(1, 0, 74)] }]);
    assert.equal(r.igualesEnTodas, false);
  });
  it('el orden de los parentescos en cada cobertura no importa', () => {
    const alReves = { ccobertura: '41', parentescos: [...viaje6[0].parentescos].reverse() };
    assert.equal(parentescosDelPlan([viaje6[0], alReves]).igualesEnTodas, true);
  });
  it('parentesco sin edades en Sis2000 (sin fila en mapledades_per): no revienta, van en 0', () => {
    const r = parentescosDelPlan([{ ccobertura: '1', parentescos: [{ cparen: 1, csexo: 'A' }, paren(2, 18, 74)] }]);
    assert.deepEqual(r.lista[0], { cparen: 1, csexo: 'A', nedad_min: 0, nedad_max: 0 });
    assert.equal(r.varian, true);
  });
  it('plan sin coberturas o sin parentescos: lista vacía y nada que conservar', () => {
    assert.deepEqual(parentescosDelPlan([]), { lista: [], varian: false, igualesEnTodas: true });
    assert.deepEqual(parentescosDelPlan([{ ccobertura: '1' }]), { lista: [], varian: false, igualesEnTodas: true });
  });
  it('texto de edades', () => {
    assert.equal(textoEdades({ nedad_min: 0, nedad_max: 74 }), 'de 0 a 74 años');
    assert.equal(textoEdades({ nedad_min: 18, nedad_max: 18 }), '18 años');
  });
});

describe('nombre del producto de un plan', () => {
  const catalogo = [
    { cproducto: '25', cramo: 5, nombre: 'Viajero' },
    { cproducto: '26', cramo: 5, nombre: 'Viajero Local' },
    { cproducto: '89', cramo: 25, nombre: 'Asistencia en viaje' },
  ];
  it('el producto está en otro ramo: su nombre y dónde está registrado', () => {
    assert.equal(nombreProductoDelPlan(catalogo, '26', 25), 'Viajero Local · registrado en ramo 5');
    assert.equal(nombreProductoDelPlan(catalogo, ' 26 ', 25), 'Viajero Local · registrado en ramo 5');
  });
  it('el producto no existe: lo dice en vez de parecer un nombre', () => {
    assert.equal(nombreProductoDelPlan(catalogo, '1', 25), 'Producto 1 (no está en el catálogo)');
  });
  it('si está en el ramo del plan, su nombre sin más', () => {
    assert.equal(nombreProductoDelPlan(catalogo, '89', 25), 'Asistencia en viaje');
  });
  it('registrado sin ramo', () => {
    assert.equal(nombreProductoDelPlan([{ cproducto: '7', cramo: 0, nombre: 'Suelto' }], '7', 25), 'Suelto · sin ramo en el catálogo');
  });
});
