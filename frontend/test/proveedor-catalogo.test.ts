// Alta de proveedores en el catálogo de Sis2000 (maclient_prov). Correr: npm test -w frontend.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALTA_PROVEEDOR_VACIA,
  altaProveedorToPayload,
  catalogoDesdeAlta,
  clavesDelProveedor,
  mensajeAltaProveedor,
  OTRO_TIPO,
  tipoServicioDeAlta,
  validarAltaProveedorForm,
  errorRifBusqueda,
  limpiarRifEntrada,
  limpiarCodigo1,
} from '../src/lib/sis2000-proveedores.ts';

const lleno = () => ({ ...ALTA_PROVEEDOR_VACIA(), cci_rif: '9', xdescripcion: ' Grúa urbana 25 km ', tipo: '1', mcostoext: '15' });

describe('alta de proveedor en el catálogo', () => {
  it('formulario vacío pide empresa, descripción y tipo', () => {
    const e = validarAltaProveedorForm(ALTA_PROVEEDOR_VACIA()).join(' ');
    assert.match(e, /empresa/);
    assert.match(e, /descripción/);
    assert.match(e, /tipo de servicio/);
    assert.deepEqual(validarAltaProveedorForm(lleno()), []);
  });

  it('«Otro» exige un solo carácter', () => {
    const f = { ...lleno(), tipo: OTRO_TIPO, tipoOtro: '' };
    assert.match(validarAltaProveedorForm(f).join(' '), /tipo de servicio/);
    assert.equal(tipoServicioDeAlta({ ...f, tipoOtro: ' G ' }), 'G');
    assert.deepEqual(validarAltaProveedorForm({ ...f, tipoOtro: 'G' }), []);
    assert.match(validarAltaProveedorForm({ ...f, tipoOtro: 'GR' }).join(' '), /tipo de servicio/);
  });

  it('valida longitud de descripción y costo negativo', () => {
    assert.match(validarAltaProveedorForm({ ...lleno(), xdescripcion: 'x'.repeat(121) }).join(' '), /120/);
    assert.match(validarAltaProveedorForm({ ...lleno(), mcostoext: '-1' }).join(' '), /costo/);
  });

  it('el cuerpo recorta, usa $ por defecto y omite lo vacío', () => {
    assert.deepEqual(altaProveedorToPayload({ ...lleno(), cmoneda: '' }), {
      cci_rif: 9,
      xdescripcion: 'Grúa urbana 25 km',
      itiposerv: '1',
      mcostoext: 15,
      cmoneda: '$',
      imodalidad: undefined,
    });
  });

  it('el creado queda como proveedor elegible con su clave', () => {
    const p = catalogoDesdeAlta(
      { cci_rif: 9, cid: 'J-1', xcliente: 'GRUAS SA', tipo_documento: 'J' },
      { cci_rif: 9, cclave_num: 4, itiposerv: '1', xdescripcion: 'Grúa', mcosto: 0, mcostoext: 0, cmoneda: '$', imodalidad: '' },
    );
    assert.deepEqual(clavesDelProveedor(p), [4]);
    assert.equal(p.xcliente, 'GRUAS SA');
  });

  it('mensajes de error en español', () => {
    assert.equal(mensajeAltaProveedor(400, 'La empresa debe existir como cliente en Sis2000'), 'La empresa debe existir como cliente en Sis2000');
    assert.match(mensajeAltaProveedor(409, ''), /Ya existe/);
    assert.match(mensajeAltaProveedor(400, ''), /cliente en Sis2000/);
    assert.match(mensajeAltaProveedor(403, ''), /permiso/);
  });

  it('RIF: formato y largo', () => {
    assert.equal(errorRifBusqueda('J-12345678-9'), null);
    assert.equal(errorRifBusqueda('V-12345678'), null);
    assert.equal(errorRifBusqueda('123456789'), null);
    assert.match(errorRifBusqueda('J-528465115161061691') ?? '', /6 y 10/);
    assert.match(errorRifBusqueda('J-12AB') ?? '', /Formato|6 y 10/);
    assert.equal(limpiarRifEntrada('j-5284$65x'), 'J-528465');
  });

  it('códigos de un carácter y costo con 2 decimales', () => {
    assert.equal(limpiarCodigo1('g'), 'G');
    assert.equal(limpiarCodigo1('#'), '');
    assert.match(validarAltaProveedorForm({ ...lleno(), mcostoext: '10.123' }).join(' '), /2 decimales/);
    assert.deepEqual(validarAltaProveedorForm({ ...lleno(), mcostoext: '10.50' }), []);
  });
});

describe('crear la empresa como cliente desde el alta', () => {
  it('prellena con el RIF buscado y limita el tipo a J, G o C', async () => {
    const m = await import('../src/lib/sis2000-proveedores.ts');
    assert.deepEqual(m.altaClienteDesdeBusqueda('j-12345678-9'), { ...m.ALTA_CLIENTE_VACIA, tipo_documento: 'J', rif: '123456789' });
    assert.equal(m.altaClienteDesdeBusqueda('G200012345').tipo_documento, 'G');
    assert.equal(m.altaClienteDesdeBusqueda('V-12345678').tipo_documento, 'J');
  });

  it('valida RIF, razón social, correo y teléfono', async () => {
    const m = await import('../src/lib/sis2000-proveedores.ts');
    const ok = { ...m.ALTA_CLIENTE_VACIA, rif: '123456789', xcliente: 'Grúas El Sol, C.A.', xcorreo: 'a@b.com', xtelefono: '0414-1234567' };
    assert.deepEqual(m.validarAltaClienteForm(ok), []);
    assert.match(m.validarAltaClienteForm({ ...ok, rif: '123' }).join(' '), /entre 6 y 10 dígitos/);
    assert.match(m.validarAltaClienteForm({ ...ok, rif: '' }).join(' '), /número de RIF/);
    assert.match(m.validarAltaClienteForm({ ...ok, xcliente: ' ' }).join(' '), /razón social/);
    assert.match(m.validarAltaClienteForm({ ...ok, xcliente: 'x'.repeat(251) }).join(' '), /250/);
    assert.match(m.validarAltaClienteForm({ ...ok, xcorreo: 'sin-arroba' }).join(' '), /correo no es válido/);
    assert.match(m.validarAltaClienteForm({ ...ok, xtelefono: '123' }).join(' '), /10 u 11 dígitos/);
    assert.match(m.validarAltaClienteForm({ ...ok, tipo_documento: 'V' }).join(' '), /J, G o C/);
  });

  it('arma el cuerpo solo con lo que tiene valor y la respuesta queda elegible', async () => {
    const m = await import('../src/lib/sis2000-proveedores.ts');
    const f = { ...m.ALTA_CLIENTE_VACIA, rif: '123456789', xcliente: ' Grúas ', xcorreo: 'a@b.com', xtelefono: '0414-1234567', cestado: '1' };
    assert.deepEqual(m.altaClienteToPayload(f), { tipo_documento: 'J', rif: '123456789', xcliente: 'Grúas', xcorreo: 'a@b.com', xtelefono: '04141234567', cestado: 1 });
    assert.deepEqual(m.clienteCreadoABusqueda({ cci_rif: 123456789, cid: 'J-123456789', xcliente: 'GRUAS' }, f), { cci_rif: 123456789, cid: 'J-123456789', xcliente: 'GRUAS', tipo_documento: 'J' });
  });
});
