// Pruebas del traductor de errores del configurador. Correr: npm test -w frontend (node --test, sin compilar).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  entenderError,
  esLegible,
  limpiarTextoServidor,
  mensajeDeError,
  miles,
  traducirMensajeValidador,
} from '../src/lib/errores.ts';

/** Igual a ApiError del front (status, ruta, método y mensajes de validación). */
const apiError = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(message), { status, ruta: '/core/sis2000/plans', metodo: 'POST', ...extra });

describe('miles', () => {
  it('pone separador de miles y no inventa decimales', () => {
    assert.equal(miles(10000), '10.000');
    assert.equal(miles(2000), '2.000');
    assert.equal(miles(2500.5), '2.500,5');
  });
});

describe('traducirMensajeValidador', () => {
  it('traduce la propiedad y la regla', () => {
    const c = traducirMensajeValidador('msumamax must not be less than 0');
    assert.equal(c?.propiedad, 'msumamax');
    assert.equal(c?.mensaje, 'Suma asegurada máxima: no puede ser un valor negativo.');
  });
  it('indica la posición dentro de una lista', () => {
    const c = traducirMensajeValidador('coberturas.1.ctarifa should not be empty');
    assert.equal(c?.indice, 1);
    assert.equal(c?.mensaje, 'Cobertura 2, Código de la tarifa: es obligatorio.');
  });
  it('largo máximo', () => {
    assert.equal(
      traducirMensajeValidador('cplan must be shorter than or equal to 6 characters')?.mensaje,
      'Código del plan: admite como máximo 6 caracteres.',
    );
  });
  it('null si no es un mensaje de class-validator', () => {
    assert.equal(traducirMensajeValidador('El plan ya existe.'), null);
  });
});

describe('entenderError', () => {
  it('400 de validación: un campo por mensaje', () => {
    const e = entenderError(
      apiError(400, 'x', { mensajes: ['msumamin must not be less than 0', 'xdescripcion_l should not be empty'] }),
    );
    assert.equal(e.tipo, 'validacion');
    assert.equal(e.campos.length, 2);
    assert.equal(e.campos[1].propiedad, 'xdescripcion_l');
    assert.equal(e.reintentable, false);
    assert.equal(e.detalle.endpoint, 'POST /core/sis2000/plans');
  });
  it('sin conexión (status 0) se puede reintentar', () => {
    const e = entenderError(apiError(0, 'Failed to fetch'));
    assert.equal(e.tipo, 'red');
    assert.equal(e.reintentable, true);
    assert.match(e.mensaje, /No hay conexión/);
  });
  it('nest-api caído desde el builder también es red', () => {
    assert.equal(entenderError(apiError(502, 'No se pudo conectar con nest-api partner (POST /x).')).tipo, 'red');
  });
  it('tiempo agotado pide revisar antes de reintentar', () => {
    const e = entenderError(apiError(504, 'Gateway Timeout'));
    assert.equal(e.tipo, 'tiempo');
    assert.match(e.mensaje, /revisa si el cambio quedó guardado/);
  });
  it('401 = sesión vencida', () => {
    assert.equal(entenderError(apiError(401, 'Unauthorized')).tipo, 'sesion');
  });
  it('403 conserva el motivo legible', () => {
    const e = entenderError(apiError(403, 'Borrar planes en Sis2000 no está permitido desde el configurador.'));
    assert.equal(e.tipo, 'permiso');
    assert.match(e.mensaje, /no está permitido/);
  });
  it('404 de ruta = función no disponible en el ambiente', () => {
    assert.equal(entenderError(apiError(404, 'Cannot POST /api/v1/configurador/planes/28/X/canales')).tipo, 'no-disponible');
  });
  it('404 con mensaje claro se muestra tal cual', () => {
    const e = entenderError(apiError(404, 'No existe el plan RCG01 en el ramo 28.'));
    assert.equal(e.tipo, 'no-encontrado');
    assert.equal(e.mensaje, 'No existe el plan RCG01 en el ramo 28.');
  });
  it('409 o clave duplicada = ya existe', () => {
    assert.equal(entenderError(apiError(409, 'x'), { que: 'una cobertura' }).mensaje.startsWith('Ya existe una cobertura'), true);
    assert.equal(entenderError(apiError(500, 'Violation of PRIMARY KEY constraint PK_macoberturas')).tipo, 'duplicado');
  });
  it('THROW de un SP: texto limpio', () => {
    const e = entenderError(apiError(400, 'Msg 50001, Level 16, State 1, Line 12 El ramo 99 no existe en maramos.'));
    assert.equal(e.tipo, 'sis2000');
    assert.equal(e.mensaje, 'El ramo 99 no existe en maramos.');
  });
  it('FOREIGN KEY = dato relacionado que no existe', () => {
    assert.match(entenderError(apiError(500, 'The INSERT statement conflicted with the FOREIGN KEY constraint')).mensaje, /dato relacionado/);
  });
  it('500 sin texto útil: genérico con reintento y detalle', () => {
    const e = entenderError(apiError(500, 'Internal server error'));
    assert.equal(e.tipo, 'servidor');
    assert.equal(e.reintentable, true);
    assert.equal(e.detalle.crudo, 'Internal server error');
  });
  it('lleva el título de lo que se intentaba hacer', () => {
    assert.equal(entenderError(apiError(500, 'x'), { titulo: 'No se pudo crear la tabla' }).titulo, 'No se pudo crear la tabla');
  });
  it('mensajeDeError junta los campos en una línea', () => {
    const m = mensajeDeError(apiError(400, 'x', { mensajes: ['cplan should not be empty', 'xplan should not be empty'] }));
    assert.match(m, /Código del plan: es obligatorio\. Nombre del plan: es obligatorio\./);
  });
});

describe('utilidades de texto', () => {
  it('limpiarTextoServidor quita prefijos técnicos', () => {
    assert.equal(limpiarTextoServidor('RequestError: El producto no existe.'), 'El producto no existe.');
  });
  it('esLegible distingue texto para usuarios de trazas', () => {
    assert.equal(esLegible('La tabla de tasas TEMP1 no existe o no tiene tramos.'), true);
    assert.equal(esLegible('Cannot GET /api/v1/x'), false);
  });
});
