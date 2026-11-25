// Pruebas de la guía del Combo y del buscador Ctrl+K (partes puras). Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVE_GUIA_COMBO, guiaYaVista, marcarGuiaVista, pasosGuiaDisponibles, PASOS_GUIA } from '../src/lib/ayudas/guia.ts';
import { comandosDeRamos, comandosDisponibles, PANTALLAS, registrarComandos } from '../src/lib/ayudas/busqueda.ts';

describe('guía del Combo', () => {
  it('solo incluye los pasos cuyo elemento existe', () => {
    const solo = pasosGuiaDisponibles((s) => s.startsWith('nav'));
    assert.equal(solo.length, 1);
    assert.equal(pasosGuiaDisponibles(() => true).length, PASOS_GUIA.length);
    assert.equal(pasosGuiaDisponibles(() => false).length, 0);
  });
  it('recuerda que ya se vio y no se rompe sin almacenamiento', () => {
    const datos: Record<string, string> = {};
    const a = { getItem: (k: string) => datos[k] ?? null, setItem: (k: string, v: string) => void (datos[k] = v) };
    assert.equal(guiaYaVista(a), false);
    marcarGuiaVista(a);
    assert.equal(datos[CLAVE_GUIA_COMBO], '1');
    assert.equal(guiaYaVista(a), true);
    assert.equal(guiaYaVista(null), false);
  });
});

describe('buscador Ctrl+K', () => {
  it('arma comandos de ramos ya cargados', () => {
    const c = comandosDeRamos([{ cramo: 28, xdescripcion: 'Automóvil' }, { cramo: 0 }, { cramo: 7 }]);
    assert.equal(c.length, 2);
    assert.equal(c[0].titulo, 'Ramo 28 · Automóvil');
    assert.equal(c[0].ruta, '/sis2000/ramo/28/coberturas');
    assert.equal(c[1].titulo, 'Ramo 7');
  });
  it('junta pantallas con lo que registra la pantalla abierta y lo quita al salir', () => {
    const baja = registrarComandos('prueba', () => [{ id: 'x', grupo: 'Pasos del combo', titulo: 'Paso 1' }]);
    assert.equal(comandosDisponibles().length, PANTALLAS.length + 1);
    baja();
    assert.equal(comandosDisponibles().length, PANTALLAS.length);
  });
});
