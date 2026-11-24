// Mancomunados por plan (PLAN_MANCOMUNADO): cuerpo hacia nest-api y copia al historial antes de escribir.
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { Sis2000RespaldoService } from '../src/core/respaldo/sis2000-respaldo.service';
import { Sis2000HistorialService } from '../src/core/respaldo/sis2000-historial.service';
import { ConfiguradorFase2Service } from '../src/core/configurador-fase2.service';
import { aMancomunado } from '../src/partner-bridge/configurador-fase2.mapper';
import type { PartnerBridgeService } from '../src/partner-bridge/partner-bridge.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { MemoriaRespaldoRepo } from './respaldo-memoria';

type Obj = Record<string, unknown>;
const ctx = { usuario: { id: 'u1', email: 'pm@exelixi.test', nombre: 'Product Manager' }, motivo: 'mancomunado' };

describe('mancomunado: cuerpo hacia nest-api', () => {
  it('números explícitos, sin filas vacías ni campos ajenos', () => {
    assert.deepEqual(
      aMancomunado({ productores: [{ cproductor: '80080', ppart: '60.5', x: 1 }, { cproductor: 1001, ppart: 39.5 }, {}], y: 2 }),
      { productores: [{ cproductor: 80080, ppart: 60.5 }, { cproductor: 1001, ppart: 39.5 }] },
    );
    assert.deepEqual(aMancomunado({}), { productores: [] });
  });
});

describe('mancomunado: respaldo antes de escribir', () => {
  function montar() {
    const repo = new MemoriaRespaldoRepo();
    const llamadas: string[] = [];
    const leido: Obj = { dominioCreado: true, existe: true, activo: true, config: { cramo: 18, productores: [{ cproductor: 1, ppart: 50 }, { cproductor: 2, ppart: 50 }] } };
    const nest = {
      isConfigured: () => true,
      leerConfigurador: async () => leido,
      escribirConfigurador: async (metodo: string, ruta: string, cuerpo?: Obj) => {
        llamadas.push(`${metodo} ${ruta} ${cuerpo ? JSON.stringify(cuerpo) : ''}`.trim());
        return { grabado: true, advertencias: [] };
      },
    } as unknown as PartnerBridgeService;
    const respaldo = new Sis2000RespaldoService(repo);
    const prisma = { coberturaSumaConfig: { findMany: async () => [] } } as unknown as PrismaService;
    return { repo, llamadas, fase2: new ConfiguradorFase2Service(nest, respaldo, new Sis2000HistorialService(nest, respaldo, repo, prisma)) };
  }

  it('PUT: guarda lo anterior en 18-RENTA1:MANCOMUNADO y manda el cuerpo limpio', async () => {
    const { repo, llamadas, fase2 } = montar();
    await fase2.guardarMancomunado('18-RENTA1', { productores: [{ cproductor: 80080, ppart: 60 }, { cproductor: 1001, ppart: 40 }] }, ctx);
    assert.deepEqual(llamadas, ['PUT planes/18/RENTA1/mancomunado {"productores":[{"cproductor":80080,"ppart":60},{"cproductor":1001,"ppart":40}]}']);
    const r = await repo.buscar('PLAN', '18-RENTA1:MANCOMUNADO');
    const [v] = await repo.versiones(r!.id);
    assert.equal(((v.anterior as Obj).config as Obj).cramo, 18);
  });

  it('DELETE: versión ELIMINACION y llamada a nest-api', async () => {
    const { repo, llamadas, fase2 } = montar();
    await fase2.desactivarMancomunado('18-RENTA1', ctx);
    assert.deepEqual(llamadas, ['DELETE planes/18/RENTA1/mancomunado']);
    const [v] = await repo.versiones((await repo.buscar('PLAN', '18-RENTA1:MANCOMUNADO'))!.id);
    assert.equal(v.tipo, 'ELIMINACION');
  });
});
