// Punto 3 del configurador: comodín de comisiones, cotización de personas y reaseguro obligatorio en la edición.
// (sis2000-nueva-cobertura usa alias @/ y no carga con node --test: su validación se cubre con tsc y el build.)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { comodinesRamoQueCubren, parentescoParaCotizar, type Comision, type ComisionForm } from '../src/lib/configurador.ts';
import { coberturaEditable, validarCoberturaEditable } from '../src/lib/cobertura-ficha.ts';

const fila = (x: Partial<Comision>): Comision => ({
  ctipoprod: 0, cproductor: 0, ccober: '0', ctarifa: '0', fdesde: '2026-01-01', fhasta: null, pcomision: 10, iestado: 'V', aplicaA: 'ramo', ...x,
});
const form = (x: Partial<ComisionForm>): ComisionForm => ({ ctipoprod: '1', cproductor: '', ccober: '1', ctarifa: '', fdesde: '2026-11-24', pcomision: '12', ...x });

describe('comodinesRamoQueCubren', () => {
  it("avisa si una fila 'V' del ramo (comodín) ya cubre la combinación", () => {
    assert.equal(comodinesRamoQueCubren([fila({})], form({})).length, 1);
    assert.equal(comodinesRamoQueCubren([fila({ ccober: '1' })], form({})).length, 1);
  });

  it("no cuenta filas del plan, 'N' ni otra cobertura", () => {
    const filas = [fila({ aplicaA: 'plan' }), fila({ iestado: 'N' }), fila({ ccober: '2' })];
    assert.deepEqual(comodinesRamoQueCubren(filas, form({})), []);
  });
});

describe('parentescoParaCotizar', () => {
  it('primer parentesco y edad dentro del rango', () => {
    const cobs = [{ parentescos: [{ cparen: 1, nedad_min: 0, nedad_max: 64 }] }];
    assert.deepEqual(parentescoParaCotizar(cobs), { cparen: 1, nedad: 18 });
    assert.deepEqual(parentescoParaCotizar([{ parentescos: [{ cparen: 3, nedad_min: 25, nedad_max: 64 }] }]), { cparen: 3, nedad: 25 });
    assert.equal(parentescoParaCotizar([{ parentescos: [] }]), null);
    assert.equal(parentescoParaCotizar(null), null);
  });
});

describe('reaseguro obligatorio', () => {
  it('edición: vaciar el reaseguro es un error', () => {
    const base = coberturaEditable({ cramo: 1, ccobertura: '1', xdescripcion_l: 'MUERTE', ccontrea: 6005, cramorea: 102, iestado: 'V' });
    assert.deepEqual(validarCoberturaEditable(base), {});
    assert.ok(validarCoberturaEditable({ ...base, ccontrea: '' }).ccontrea);
  });
});
