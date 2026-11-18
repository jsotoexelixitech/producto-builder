// Pruebas del configurador fase 2 «editar todo». Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  avisoCoberturaEdades,
  avisosRamo,
  cabeceraDePlan,
  cambiosCabecera,
  cuerpoCoberturaPersonas,
  cuerpoCoberturaPlan,
  cuerpoCondominio,
  cuerpoDescRec,
  cuerpoEdad,
  cuerpoFrecuencia,
  cuerpoProducto,
  cuerpoQuienVende,
  cuerpoTarifaDias,
  cuerpoVersionCasco,
  cuerpoVistaPreviaCasco,
  AJUSTE_CASCO_VACIO,
  errorAprobarCasco,
  esNoImplementado,
  esUltimaObligatoria,
  filtrarRamos,
  formDeCoberturaPlan,
  hayQuienVende,
  normalizarCoberturaPlan,
  normalizarFrecuencia,
  normalizarPaginaQuienVende,
  normalizarRamoCatalogo,
  normalizarResumenQuienVende,
  normalizarTasaCasco,
  parentescosSinEdad,
  partirCodigos,
  PRODUCTO_VACIO,
  productoDeFila,
  ramoPermiteCrearPlan,
  validarAjusteCasco,
  validarAltaQuienVende,
  validarCabecera,
  validarCoberturaPersonas,
  validarCoberturaPlan,
  validarCondominio,
  validarDescRec,
  validarEdad,
  validarFrecuencia,
  validarProducto,
  validarTarifaDias,
  type FilaTarifaDias,
} from '../src/lib/configurador-fase2.ts';
import { normalizarRamo, pasosDespuesDelPlan } from '../src/lib/configurador.ts';
import { entenderError } from '../src/lib/errores.ts';

describe('catálogo de ramos', () => {
  const fila = {
    cramo: 30,
    xdescripcion: 'FIANZAS',
    familia: 'fianzas',
    colectivo: false,
    emisionNexus: null,
    estado: 'activo',
    planes: 4,
    productos: 2,
    soloLectura: true,
    avisos: ['Sin flujo de emisión Nexus.'],
  };

  it('normaliza la fila de GET ramos con conteos, avisos y solo lectura', () => {
    const r = normalizarRamoCatalogo(fila);
    assert.equal(r.nombre, 'FIANZAS');
    assert.equal(r.planes, 4);
    assert.equal(r.soloLectura, true);
    assert.deepEqual(avisosRamo(r), ['Sin flujo de emisión Nexus.']);
    assert.equal(ramoPermiteCrearPlan(r), false);
  });

  it('avisos propios si nest-api no los manda: colectivo y sin planes', () => {
    const r = normalizarRamoCatalogo({ cramo: 4, familia: 'personas', colectivo: true, estado: 'sin-planes', planes: 0 });
    assert.deepEqual(avisosRamo(r), ['Colectivo: requiere póliza plantilla de Técnica.', 'Este ramo todavía no tiene planes.']);
    assert.equal(ramoPermiteCrearPlan(r), true);
  });

  it('filtra por familia (cosas = patrimonial) y por texto', () => {
    const ramos = [
      normalizarRamoCatalogo({ cramo: 18, xdescripcion: 'AUTOMOVIL', familia: 'auto' }),
      normalizarRamoCatalogo({ cramo: 28, xdescripcion: 'INCENDIO', familia: 'cosas' }),
      normalizarRamoCatalogo({ cramo: 16, xdescripcion: 'CONDOMINIO', familia: 'patrimonial' }),
    ];
    assert.deepEqual(filtrarRamos(ramos, { familia: 'patrimonial' }).map((r) => r.cramo), [28, 16]);
    assert.deepEqual(filtrarRamos(ramos, { q: 'auto' }).map((r) => r.cramo), [18]);
  });

  it('ramo de la ficha: solo lectura en fianzas y pasos tras el plan sin producto, plan ni quién vende', () => {
    assert.equal(normalizarRamo({ cramo: 30, familia: 'fianzas', secciones: [] }).soloLectura, true);
    assert.deepEqual(pasosDespuesDelPlan(['producto', 'plan', 'coberturas', 'frecuencias', 'quien-vende', 'comisiones', 'tasa-casco', 'revision']), [
      'comisiones',
      'tasa-casco',
      'revision',
    ]);
  });
});

describe('frecuencias', () => {
  it('letra válida, días obligatorios en D y repetida activa', () => {
    const existentes = [normalizarFrecuencia({ ifrecuencia: 'a ', iestado: 'V' })];
    assert.deepEqual(validarFrecuencia({ ifrecuencia: 'X', xfrecuencia: '', ndias: '' }), { ifrecuencia: 'Letra no válida: usa A, S, T, C, M, E, K, D.' });
    assert.ok(validarFrecuencia({ ifrecuencia: 'd', xfrecuencia: '', ndias: '' }).ndias);
    assert.ok(validarFrecuencia({ ifrecuencia: 'A', xfrecuencia: '', ndias: '' }, existentes).ifrecuencia);
    assert.deepEqual(cuerpoFrecuencia({ ifrecuencia: 'm', xfrecuencia: '', ndias: '' }), { ifrecuencia: 'M', xfrecuencia: 'Mensual' });
  });
});

describe('quién vende', () => {
  it('lista paginada y resumen con la forma real de nest-api', () => {
    const pag = normalizarPaginaQuienVende({ total: 3, limit: 50, offset: 0, filas: [{ id: 1, centidad: 'P', citem: null, todos: true, nombre: 'Todos', itipouso: 'A' }] });
    assert.equal(pag.total, 3);
    assert.equal(pag.filas[0].citem, null);
    const res = normalizarResumenQuienVende({ total: 3, grupos: [{ centidad: 'P', itipouso: 'A', filas: 2, conTodos: false }, { centidad: 'C', itipouso: 'A', filas: 1, conTodos: true }] });
    assert.deepEqual(res.map((g) => [g.centidad, g.cantidad, g.todos]), [
      ['C', 1, true],
      ['P', 2, false],
    ]);
    assert.equal(hayQuienVende(res), true);
    assert.equal(hayQuienVende([{ centidad: 'P', itipouso: 'E', cantidad: 4, todos: false }]), false);
  });

  it('alta masiva: códigos pegados, «todos» solo para incluir', () => {
    assert.deepEqual(partirCodigos('101, 102 103\n101;104'), ['101', '102', '103', '104']);
    assert.deepEqual(cuerpoQuienVende({ centidad: 'g', itipouso: 'e', todos: false, codigos: '7 8' }), { centidad: 'G', itipouso: 'E', items: ['7', '8'] });
    assert.deepEqual(cuerpoQuienVende({ centidad: 'C', itipouso: 'A', todos: true, codigos: '' }).items, null);
    assert.ok(validarAltaQuienVende({ centidad: 'R', itipouso: 'A', todos: true, codigos: '' }).centidad);
    assert.ok(validarAltaQuienVende({ centidad: 'P', itipouso: 'E', todos: true, codigos: '' }).itipouso);
  });
});

describe('producto y cabecera', () => {
  it('editar manda null en los opcionales vacíos; crear no los manda', () => {
    const f = { ...productoDeFila({ cproducto: 'AUTO01', cramo: 18, xdescripcion_l: 'Auto', iproductor: 1, xform: '' }), norden: '' };
    assert.equal(f.iproductor, true);
    const editar = cuerpoProducto(f, false);
    assert.equal(editar.xform, null);
    assert.equal(editar.norden, null);
    assert.equal('cproducto' in editar, false);
    const crear = cuerpoProducto({ ...f, cproducto: 'auto02' }, true);
    assert.equal('xform' in crear, false);
    assert.equal(crear.cproducto, 'AUTO02');
  });

  it('valida quién lo ve, URL y orden', () => {
    const e = validarProducto({ ...PRODUCTO_VACIO, iproductor: false, cramo: '18', xdescripcion_l: 'X', norden: '1.5', xurl_presentacion: 'ftp://x' }, false);
    assert.deepEqual(Object.keys(e).sort(), ['iproductor', 'norden', 'xurl_presentacion']);
  });

  it('cabecera: solo lo que cambió; producto de más de 6 no sirve en planes', () => {
    const antes = cabeceraDePlan({ xplan: 'Plan', cmoneda: 'USD', cproducto: 'AUTO01', iestado: 'V' });
    assert.deepEqual(cambiosCabecera(antes, { ...antes, xplan: 'Plan 2', iestado: 'I' }), { xplan: 'Plan 2', iestado: 'I' });
    assert.ok(validarCabecera({ ...antes, cproducto: 'PRODUCTO7' }).cproducto);
    assert.ok(validarCabecera({ ...antes, cmoneda: 'EUR' }, ['USD', 'BS']).cmoneda);
  });
});

describe('coberturas del plan', () => {
  it('prima o tasa excluyentes y suma mínima ≤ máxima', () => {
    const c = normalizarCoberturaPlan({ ccobertura: '1', ctarifa: '1', msumamin: 0, msumamax: 1000, mprima: 0, pprima: 2.5, bobligatoria: 'S' });
    const f = formDeCoberturaPlan(c);
    assert.equal(f.modo, 'tasa');
    assert.deepEqual(cuerpoCoberturaPlan(f, false), { msumamin: 0, msumamax: 1000, pprima: 2.5 });
    assert.ok(validarCoberturaPlan({ ...f, msumamin: '2000' }, false).msumamin);
    assert.ok(validarCoberturaPlan({ ...f, valor: '150' }, false).valor);
  });

  it('última obligatoria y personas con parentescos sin repetir', () => {
    const filas = [normalizarCoberturaPlan({ ccobertura: '1', bobligatoria: true }), normalizarCoberturaPlan({ ccobertura: '2' })];
    assert.equal(esUltimaObligatoria(filas, '1'), true);
    assert.equal(esUltimaObligatoria(filas, '2'), false);
    const v = validarCoberturaPersonas({ ccobertura: '5', ctarifa: '1', parentescos: [{ cparen: '1', ctablatar: 'T1' }, { cparen: '1', ctablatar: '' }] }, true);
    assert.ok(v.filas[1].cparen && v.filas[1].ctablatar);
    assert.deepEqual(cuerpoCoberturaPersonas({ ccobertura: '5', ctarifa: '1', parentescos: [{ cparen: '2', ctablatar: 't9' }] }, false), {
      parentescos: [{ cparen: 2, ctablatar: 'T9' }],
    });
  });
});

describe('edades por parentesco', () => {
  it('min ≤ max y cuerpo solo con lo escrito', () => {
    const f = { cparen: '1', cemin_ase: '18', cemax_ase: '10', cemin_gi: '', cemax_gi: '', msvitalicia: '', cereduccion: '', msreducida: '' };
    assert.ok(validarEdad(f).cemax_ase);
    assert.deepEqual(cuerpoEdad({ ...f, cemax_ase: '70', msvitalicia: '1000' }), { cemin_ase: 18, cemax_ase: 70, msvitalicia: 1000 });
  });

  it('aviso si la tabla de edad no cubre el rango y parentescos sin fila', () => {
    assert.equal(avisoCoberturaEdades(0, 70, [{ desde: 0, hasta: 40 }, { desde: 41, hasta: 75 }]), null);
    assert.match(String(avisoCoberturaEdades(0, 80, [{ desde: 0, hasta: 64 }], 'T1')), /falta desde 65/);
    assert.deepEqual(parentescosSinEdad(['1', '2', '2'], [{ cparen: '1' } as never]), ['2']);
  });
});

describe('descuentos, condominio y tarifa por días', () => {
  it('código opcional al agregar; % de 0 a 100', () => {
    assert.deepEqual(validarDescRec({ codigo: '', nombre: 'Alarma', porcentaje: '5' }, true), {});
    assert.ok(validarDescRec({ codigo: '3', nombre: 'Alarma', porcentaje: '120' }, true, [{ codigo: '3', nombre: '', porcentaje: '' }]).codigo);
    assert.deepEqual(cuerpoDescRec('dispositivos', { codigo: '', nombre: 'Alarma', porcentaje: '5' }, true), { xdisseg: 'Alarma', pdisseg: 5 });
    assert.deepEqual(cuerpoDescRec('sustancias', { codigo: '4', nombre: 'Gas', porcentaje: '2,5' }, false), { xsustanc: 'Gas', porcenta: 2.5 });
  });

  it('reparto P suma 100', () => {
    const filas = [
      { ccober: '1', ctarifa: '1', itipo: 'P', pvalor: '60', plimite: '' },
      { ccober: '2', ctarifa: '1', itipo: 'P', pvalor: '30', plimite: '' },
    ];
    assert.match(String(validarCondominio('reparto', filas).tabla), /sumar 100/);
    assert.deepEqual(cuerpoCondominio('reparto', [filas[0]]).filas, [{ ccober: '1', ctarifa: '1', itipo: 'P', pvalor: 60 }]);
  });

  it('bordes compartidos válidos, solape real inválido y fila anual en BINAC', () => {
    const f = (ctarifabi: string, min: string, max: string, anual = ''): FilaTarifaDias => ({
      ctarifabi,
      qdias: '1',
      bnacional: '1',
      cmoneda: 'USD',
      ndias_min: min,
      ndias_max: max,
      msuma: '',
      mprima: '10',
      mprima_anual: anual,
      mprima_dia: '',
    });
    assert.deepEqual(validarTarifaDias([f('1', '0', '3'), f('1', '3', '7')]).tabla, []);
    assert.equal(validarTarifaDias([f('1', '0', '5'), f('1', '3', '7')]).tabla.length, 1);
    assert.match(validarTarifaDias([f('1', '0', '3')], 'BINAC01').tabla.join(' '), /fila anual/);
    assert.deepEqual(validarTarifaDias([f('1', '0', '30', '120')], 'BINAC01').tabla, []);
    assert.equal(cuerpoTarifaDias([f('1', '0', '3')]).filas[0].bnacional, true);
  });
});

describe('tasa de casco por versiones', () => {
  it('lee vigente y en curso de la forma real', () => {
    const d = normalizarTasaCasco({
      versionado: true,
      requiereAprobacion: true,
      vigente: { id: 3, numero: 3, estado: 'APLICADA', situacion: 'VIGENTE', vigente_desde: '2026-10-01T00:00:00.000Z' },
      enCurso: [{ id: 4, numero: 4, estado: 'PENDIENTE', situacion: 'PENDIENTE', propuesta_por: 77, movimiento: 'INCREMENTO', porcentaje: 5 }],
      tasas: [{ cplan: 'A', ntasa: 1 }],
      avisos: ['global'],
    });
    assert.equal(d.vigente?.vigenteDesde, '2026-10-01');
    assert.equal(d.enCurso[0].propuestaPorId, '77');
    assert.equal(d.tasas.length, 1);
    assert.equal(errorAprobarCasco(d.enCurso[0], '77'), 'Quien propuso la versión no puede aprobarla: debe aprobarla otra persona.');
    assert.equal(errorAprobarCasco(d.enCurso[0], '78'), null);
  });

  it('ajuste: filtros solo del alcance y reglas del SP', () => {
    const f = { ...AJUSTE_CASCO_VACIO, cusuario: '12', porcentaje: '5', alcance: 'COMBINADA', rangos: '1, 2', edadDesde: '0', edadHasta: '5', coberturas: '1', motivo: 'Ajuste anual de tasas' };
    assert.deepEqual(validarAjusteCasco(f), {});
    assert.deepEqual(cuerpoVistaPreviaCasco(f), { movimiento: 'INCREMENTO', porcentaje: 5, alcance: 'COMBINADA', filtros: { ranges: [1, 2], ageFrom: 0, ageTo: 5 } });
    assert.ok(validarAjusteCasco({ ...f, movimiento: 'DISMINUCION', porcentaje: '100' }).porcentaje);
    assert.ok(validarAjusteCasco({ ...f, edadHasta: '25' }).edadDesde);
    assert.ok(validarAjusteCasco({ ...f, rigeAlAprobar: false }).vigenteDesde);
    const rest = cuerpoVersionCasco({ ...AJUSTE_CASCO_VACIO, origen: 'RESTAURACION', cusuario: '12', versionId: '9', motivo: 'Volver a la versión 9' });
    assert.deepEqual(rest, { origen: 'RESTAURACION', cusuario: 12, motivo: 'Volver a la versión 9', rige_al_aprobar: true, version_id: 9 });
  });

  it('501 = no disponible todavía', () => {
    const e = Object.assign(new Error('Guardar el condominio todavía no está disponible.'), { status: 501 });
    assert.equal(esNoImplementado(e), true);
    assert.equal(entenderError(e).tipo, 'no-disponible');
  });
});
