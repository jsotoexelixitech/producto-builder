// Productos Sis2000: primero nest-api propio (v1/configurador/productos) y, solo con 404, el paquete partner.
import { afterEach, beforeEach, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { HttpException } from '@nestjs/common';
import { PartnerBridgeService } from '../src/partner-bridge/partner-bridge.service';

type Respuesta = { status: number; body: unknown };
const fetchOriginal = globalThis.fetch;
let rutas: Record<string, Respuesta> = {};
let llamadas: string[] = [];

function nestSimulado(r: Record<string, Respuesta>) {
  rutas = r;
  llamadas = [];
  globalThis.fetch = (async (url: string) => {
    const path = new URL(url).pathname;
    llamadas.push(path);
    const res =
      path === '/api/v1/auth/token'
        ? { status: 200, body: { access_token: 't', expires_in: 3600 } }
        : (rutas[path] ?? { status: 404, body: { message: `Cannot GET ${path}`, statusCode: 404 } });
    return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

const producto = { cproducto: 'RCVNEX', cramo: 18, xdescripcion_l: 'RCV NEXUS', xabreviatura: 'RCV', xform: 'automobile' };

describe('productos Sis2000 desde el configurador', () => {
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
    nestSimulado({ '/api/v1/configurador/productos': { status: 200, body: { status: true, data: [producto] } } });
    assert.deepEqual(await bridge.listProducts(), [producto]);
    assert.ok(!llamadas.some((p) => p.includes('/partner/')));
  });

  it('si el configurador responde 404 la lista cae al partner', async () => {
    nestSimulado({ '/api/v1/partner/products/list': { status: 200, body: { status: true, data: [producto] } } });
    assert.deepEqual(await bridge.listProducts(), [producto]);
    assert.ok(llamadas.includes('/api/v1/partner/products/list'));
  });

  it('detalle: 404 de ruta cae al partner; 404 de producto no existe no', async () => {
    nestSimulado({ '/api/v1/partner/products/detail/RCVNEX': { status: 200, body: { status: true, data: producto } } });
    assert.deepEqual(await bridge.getProductDetail('RCVNEX'), producto);

    nestSimulado({
      '/api/v1/configurador/productos/NOEXI': { status: 404, body: { message: 'No existe el producto NOEXI en maproductos.' } },
    });
    await assert.rejects(bridge.getProductDetail('NOEXI'), (e: unknown) => e instanceof HttpException && e.getStatus() === 404);
    assert.ok(!llamadas.some((p) => p.includes('/partner/')));
    assert.equal(await bridge.productExists('NOEXI'), false);
  });

  it('otros errores del configurador no caen al partner', async () => {
    nestSimulado({ '/api/v1/configurador/productos': { status: 403, body: { message: 'Sin scope' } } });
    await assert.rejects(bridge.listProducts(), (e: unknown) => e instanceof HttpException && e.getStatus() === 403);
    assert.ok(!llamadas.some((p) => p.includes('/partner/')));
  });
});
