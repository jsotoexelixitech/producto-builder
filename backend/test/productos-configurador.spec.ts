// Productos y monedas Sis2000: solo rutas propias de nest-api (v1/configurador/...); sin caída a paquetes partner.
import { afterEach, beforeEach, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BadGatewayException, HttpException, NotImplementedException } from '@nestjs/common';
import { PartnerBridgeService } from '../src/partner-bridge/partner-bridge.service';
import { payloadACrearConfigurador, payloadAEditarConfigurador } from '../src/partner-bridge/partner-product.mapper';

type Respuesta = { status: number; body: unknown };
const fetchOriginal = globalThis.fetch;
let rutas: Record<string, Respuesta> = {};
let llamadas: Array<{ metodo: string; path: string; body?: unknown }> = [];

function nestSimulado(r: Record<string, Respuesta>) {
  rutas = r;
  llamadas = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    const metodo = init?.method ?? 'GET';
    llamadas.push({ metodo, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const res =
      path === '/api/v1/auth/token'
        ? { status: 200, body: { access_token: 't', expires_in: 3600 } }
        : (rutas[`${metodo} ${path}`] ?? { status: 404, body: { message: `Cannot ${metodo} ${path}`, statusCode: 404 } });
    return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

const rutasLlamadas = () => llamadas.map((l) => l.path).filter((p) => !p.includes('/auth/'));
const producto = { cproducto: 'RCVNEX', cramo: 18, xdescripcion_l: 'RCV NEXUS', xabreviatura: 'RCV', xform: 'automobile' };
const payload = {
  cproducto: 'RCVNEX',
  cramo: 18,
  ctiporamo: 7,
  xdescripcion_l: 'RCV NEXUS',
  xabreviatura: 'RCV',
  xform: 'automobile',
  iproductor: true,
  icanal: false,
  xdescripcion_c: null,
  norden: null,
};

describe('productos y monedas Sis2000 desde el configurador', () => {
  let bridge: PartnerBridgeService;
  beforeEach(() => {
    process.env.NEST_API_URL = 'http://nest.test';
    process.env.NEST_API_KEY = 'k';
    bridge = new PartnerBridgeService();
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it('lista con v1/configurador/productos sin tocar el partner', async () => {
    nestSimulado({ 'GET /api/v1/configurador/productos': { status: 200, body: { status: true, data: [producto] } } });
    assert.deepEqual(await bridge.listProducts(), [producto]);
    assert.deepEqual(rutasLlamadas(), ['/api/v1/configurador/productos']);
  });

  it('si nest-api no tiene la ruta, error claro 502 (no cae al partner ni devuelve lista vacía)', async () => {
    nestSimulado({});
    await assert.rejects(bridge.listProducts(), (e: unknown) => e instanceof BadGatewayException && /no tiene la ruta GET/.test(e.message));
    assert.deepEqual(rutasLlamadas(), ['/api/v1/configurador/productos']);
  });

  it('detalle: 404 de producto inexistente se propaga como 404; productExists da false', async () => {
    nestSimulado({
      'GET /api/v1/configurador/productos/NOEXI': { status: 404, body: { message: 'No existe el producto NOEXI en maproductos.' } },
    });
    await assert.rejects(bridge.getProductDetail('NOEXI'), (e: unknown) => e instanceof HttpException && e.getStatus() === 404);
    assert.equal(await bridge.productExists('NOEXI'), false);
    assert.ok(!rutasLlamadas().some((p) => p.includes('/partner/')));
  });

  it('detalle: devuelve el producto del configurador', async () => {
    nestSimulado({ 'GET /api/v1/configurador/productos/RCVNEX': { status: 200, body: { status: true, data: producto } } });
    assert.deepEqual(await bridge.getProductDetail('RCVNEX'), producto);
  });

  it('otros errores del configurador se propagan', async () => {
    nestSimulado({ 'GET /api/v1/configurador/productos': { status: 403, body: { message: 'Sin scope' } } });
    await assert.rejects(bridge.listProducts(), (e: unknown) => e instanceof HttpException && e.getStatus() === 403);
  });

  it('crea con POST v1/configurador/productos y solo los campos del DTO propio', async () => {
    nestSimulado({ 'POST /api/v1/configurador/productos': { status: 200, body: { status: true, data: {} } } });
    await bridge.createProduct({ ...payload, xdescripcion_l: 'N'.repeat(100) });
    const post = llamadas.find((l) => l.metodo === 'POST' && l.path.includes('configurador'));
    assert.ok(post);
    const cuerpo = post!.body as Record<string, unknown>;
    assert.equal((cuerpo.xdescripcion_l as string).length, 60);
    assert.equal(cuerpo.cproducto, 'RCVNEX');
    assert.ok(!('xdescripcion_c' in cuerpo) && !('norden' in cuerpo), 'los null no se envían');
    assert.ok(!rutasLlamadas().some((p) => p.includes('/partner/')));
  });

  it('edita con PATCH sin cproducto ni ctiporamo (cramo identifica la fila)', async () => {
    nestSimulado({ 'PATCH /api/v1/configurador/productos/RCVNEX': { status: 200, body: { status: true, data: {} } } });
    await bridge.updateProduct('RCVNEX', payload);
    const patch = llamadas.find((l) => l.metodo === 'PATCH');
    const cuerpo = patch!.body as Record<string, unknown>;
    assert.equal(cuerpo.cramo, 18);
    assert.ok(!('cproducto' in cuerpo) && !('ctiporamo' in cuerpo));
    assert.deepEqual(payloadAEditarConfigurador(payload), cuerpo);
    assert.ok('cproducto' in payloadACrearConfigurador(payload));
  });

  it('monedas: GET v1/configurador/catalogos/monedas', async () => {
    const m = { cmoneda: '$', xdescripcion_l: 'DOLAR', ptasamon: 36.5 };
    nestSimulado({ 'GET /api/v1/configurador/catalogos/monedas': { status: 200, body: { status: true, data: [m] } } });
    assert.deepEqual(await bridge.listCatalogMonedas(), [m]);
    assert.deepEqual(rutasLlamadas(), ['/api/v1/configurador/catalogos/monedas']);
  });

  it('monedas: sin ruta en nest-api, error claro', async () => {
    nestSimulado({});
    await assert.rejects(bridge.listCatalogMonedas(), (e: unknown) => e instanceof BadGatewayException);
  });

  it('ramos/coberturas/tarifas internas: 501 explícito (sin ruta propia)', async () => {
    nestSimulado({});
    await assert.rejects(bridge.listCatalogRamosInternos(), (e: unknown) => e instanceof NotImplementedException);
    await assert.rejects(bridge.listCatalogCoberturasInternas(), (e: unknown) => e instanceof NotImplementedException);
    await assert.rejects(bridge.listCatalogTarifasInternas(), (e: unknown) => e instanceof NotImplementedException);
    assert.equal(llamadas.length, 0);
  });
});
