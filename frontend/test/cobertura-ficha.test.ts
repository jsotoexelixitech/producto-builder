// Pruebas de la ficha «Ver / editar» de una cobertura en el asistente de planes. Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  avisosCobertura,
  cambiosCobertura,
  coberturaEditable,
  cuerpoCambiosCobertura,
  datosCobertura,
  resumenTarifa,
  resumenTarifas,
  validarCoberturaEditable,
} from '../src/lib/cobertura-ficha.ts';

const HOY = '2026-11-18';
const cob = (extra: Record<string, unknown> = {}) => ({
  ccobertura: '5',
  xdescripcion_l: 'INCENDIO',
  xdescripcion_c: 'INC',
  xabreviatura: 'INC',
  cmoneda: '$',
  iestado: 'V',
  ccontrea: 3,
  cramorea: 18,
  ...extra,
});
const det = (fdesde: string, extra: Record<string, unknown> = {}) => ({
  fdesde,
  fhasta: null,
  iestado: 'V',
  msumamin: 1000,
  msumamax: 50000,
  pprima: 0.5,
  mprima: 0,
  ...extra,
});
const tarifa = (ctarifa: string, detalles: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
  ctarifa,
  xtarifam: `TARIFA ${ctarifa}`,
  iestado: 'V',
  bobligatoria: 'N',
  detalles,
  ...extra,
});
const textos = (a: { texto: string }[]) => a.map((x) => x.texto).join(' | ');

describe('datosCobertura', () => {
  it('lee macoberturas en lenguaje simple', () => {
    const d = datosCobertura(cob({ ccontrea: 0, cramoint: 18, ccoberturaint: 7, bobligatoria: 'S', iestado: 'I' }));
    assert.equal(d.nombreLargo, 'INCENDIO');
    assert.equal(d.contratoReaseguro, null);
    assert.equal(d.ramoInterno, 18);
    assert.equal(d.coberturaInterna, 7);
    assert.equal(d.obligatoria, true);
    assert.equal(d.activa, false);
  });
});

describe('resumenTarifa', () => {
  it('toma la tasa vigente hoy más reciente y deja el resto en el historial', () => {
    const r = resumenTarifa(
      tarifa('1', [det('2025-01-01', { fhasta: '2025-12-31' }), det('2026-01-01'), det('2026-06-01', { iestado: 'I' })]),
      HOY,
      '5',
    );
    assert.equal(r.actual?.fdesde, '2026-01-01');
    assert.equal(r.actualVigenteHoy, true);
    assert.equal(r.vigentesHoy, 1);
    assert.equal(r.historial.length, 2);
    assert.equal(r.historial[0].fdesde, '2026-06-01');
    assert.equal(r.obligatoria, false);
  });
  it('sin tasa vigente hoy muestra la más reciente', () => {
    const r = resumenTarifa(tarifa('1', [det('2024-01-01', { fhasta: '2024-12-31' })]), HOY);
    assert.equal(r.actualVigenteHoy, false);
    assert.equal(r.actual?.fdesde, '2024-01-01');
  });
  it('la cobertura 1 siempre es obligatoria y las vigentes van primero', () => {
    const lista = resumenTarifas([tarifa('2', [], { iestado: 'I' }), tarifa('1', [])], HOY, '1');
    assert.deepEqual(lista.map((t) => t.ctarifa), ['1', '2']);
    assert.equal(lista[0].obligatoria, true);
  });
  it('lee el deducible de la tasa', () => {
    const r = resumenTarifa(tarifa('1', [det('2026-01-01', { bfraded: 'D', mdedu_franext: 250 })]), HOY);
    assert.equal(r.actual?.deducible.bfraded, 'D');
    assert.equal(r.actual?.deducible.mdedu_franext, '250');
  });
});

describe('avisosCobertura', () => {
  it('cobertura completa: sin avisos', () => {
    assert.deepEqual(avisosCobertura({ cobertura: cob(), tarifas: [tarifa('1', [det('2026-01-01')])], hoy: HOY }), []);
  });
  it('sin tarifas o sin tarifa vigente es error', () => {
    assert.match(textos(avisosCobertura({ cobertura: cob(), tarifas: [], hoy: HOY })), /No tiene tarifas/);
    const a = avisosCobertura({ cobertura: cob(), tarifas: [tarifa('1', [det('2026-01-01')], { iestado: 'I' })], hoy: HOY });
    assert.equal(a[0].nivel, 'error');
    assert.match(a[0].texto, /Sin tarifa vigente/);
  });
  it('no avisa de tarifas mientras no se leyeron', () => {
    assert.deepEqual(avisosCobertura({ cobertura: cob(), tarifas: null, hoy: HOY }), []);
  });
  it('más de una vigente, suma máxima vacía, sin precio y tasa vencida', () => {
    const a = avisosCobertura({
      cobertura: cob(),
      tarifas: [
        tarifa('1', [det('2026-01-01', { msumamax: 0, pprima: 0, mprima: 0 })]),
        tarifa('2', [det('2024-01-01', { fhasta: '2024-12-31' })]),
      ],
      hoy: HOY,
    });
    const t = textos(a);
    assert.match(t, /Tiene 2 tarifas vigentes/);
    assert.match(t, /La tarifa 1 \(TARIFA 1\) no tiene suma asegurada máxima/);
    assert.match(t, /La tarifa 1 \(TARIFA 1\) no tiene tasa ni prima/);
    assert.match(t, /La tarifa 2 \(TARIFA 2\) no tiene una tasa vigente hoy \(la última venció el 31\/12\/2024\)/);
    // Los errores van primero.
    assert.equal(a[0].nivel, 'error');
  });
  it('dos tasas vigentes a la vez en la misma tarifa', () => {
    const a = avisosCobertura({ cobertura: cob(), tarifas: [tarifa('1', [det('2026-01-01'), det('2026-03-01')])], hoy: HOY });
    assert.match(textos(a), /Su tarifa tiene 2 tasas vigentes a la vez/);
  });
  it('suma calculada o personas no exigen suma máxima ni precio', () => {
    const tarifas = [tarifa('1', [det('2026-01-01', { msumamax: 0, pprima: 0 })])];
    assert.deepEqual(avisosCobertura({ cobertura: cob(), tarifas, hoy: HOY, personas: true }), []);
    assert.doesNotMatch(textos(avisosCobertura({ cobertura: cob(), tarifas, hoy: HOY, calculada: true })), /suma asegurada máxima/);
  });
  it('sin reaseguro e inactiva', () => {
    const t = textos(avisosCobertura({ cobertura: cob({ ccontrea: null, iestado: 'I' }), tarifas: null, hoy: HOY }));
    assert.match(t, /Sin contrato de reaseguro/);
    assert.match(t, /inactiva en el ramo/);
  });
});

describe('edición de la cobertura', () => {
  it('detecta cambios y arma solo lo que cambió', () => {
    const antes = coberturaEditable(cob());
    const despues = { ...antes, xdescripcion_l: ' incendio y aliados ', activa: false, ccontrea: '' };
    const cambios = cambiosCobertura(antes, despues);
    assert.deepEqual(cambios.map((c) => c.campo), ['xdescripcion_l', 'activa', 'ccontrea']);
    assert.equal(cambios[0].despues, 'INCENDIO Y ALIADOS');
    assert.deepEqual(cuerpoCambiosCobertura(antes, despues), { xdescripcion_l: 'INCENDIO Y ALIADOS', iestado: 'I', ccontrea: 0 });
  });
  it('mayúsculas y espacios no cuentan como cambio', () => {
    const antes = coberturaEditable(cob());
    assert.deepEqual(cambiosCobertura(antes, { ...antes, xdescripcion_c: ' inc ' }), []);
  });
  it('valida nombre, longitudes y códigos', () => {
    const e = validarCoberturaEditable({ ...coberturaEditable(cob()), xdescripcion_l: ' ', xabreviatura: 'ABCDEF', cramorea: '1a' });
    assert.ok(e.xdescripcion_l);
    assert.ok(e.xabreviatura);
    assert.ok(e.cramorea);
    assert.deepEqual(validarCoberturaEditable(coberturaEditable(cob())), {});
  });
});
