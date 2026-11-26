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
});
