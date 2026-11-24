// Auto configurable (CONTRATO-AUTO-CONFIGURABLE): cuerpos hacia nest-api y respaldo de tasa diaria / deducible con descuento.
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { Sis2000RespaldoService } from '../src/core/respaldo/sis2000-respaldo.service';
import { Sis2000HistorialService } from '../src/core/respaldo/sis2000-historial.service';
import { ConfiguradorFase2Service } from '../src/core/configurador-fase2.service';
import { aDeduciblesAuto, aTasaDiaria } from '../src/partner-bridge/configurador-fase2.mapper';
import type { PartnerBridgeService } from '../src/partner-bridge/partner-bridge.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { MemoriaRespaldoRepo } from './respaldo-memoria';

type Obj = Record<string, unknown>;
const ctx = { usuario: { id: 'u1', email: 'pm@exelixi.test', nombre: 'Product Manager' }, motivo: 'auto renta' };

describe('auto configurable: cuerpos hacia nest-api', () => {
  it('tasa diaria: números explícitos, coberturas sin repetir y tasa_defecto null si viene vacía', () => {
    assert.deepEqual(
      aTasaDiaria({ coberturas: ['1', ' 2', '2', ''], tasas: [{ ctipo: '1', tasa: '0.072' }, { ctipo: '', tasa: '' }], tasa_defecto: '', dias_min: '1', dias_max: '365', x: 1 }),
      { coberturas: ['1', '2'], tasas: [{ ctipo: 1, tasa: 0.072 }], tasa_defecto: null, dias_min: 1, dias_max: 365 },
    );
    assert.equal(aTasaDiaria({ tasa_defecto: '0.08' }).tasa_defecto, 0.08);
  });

  it('deducibles: opciones numéricas, aplica en mayúsculas y obligatorio booleano', () => {
    assert.deepEqual(
      aDeduciblesAuto({ coberturas: ['28'], aplica: 'parcial', opciones: [{ pdeducible: '3', pdescuento: '25' }, {}], obligatorio: 'S' }),
      { coberturas: ['28'], aplica: 'PARCIAL', opciones: [{ pdeducible: 3, pdescuento: 25 }], obligatorio: true },
    );
    assert.deepEqual(aDeduciblesAuto({ coberturas: [], opciones: [] }), { coberturas: [], opciones: [], obligatorio: false });
  });
});

describe('auto configurable: respaldo antes de escribir', () => {
  function montar() {
    const repo = new MemoriaRespaldoRepo();
    const llamadas: string[] = [];
    const leido: Obj = { dominioCreado: true, existe: true, activo: true, config: { cramo: 18, tasas: { '1': 0.05 } } };
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
    const fase2 = new ConfiguradorFase2Service(nest, respaldo, new Sis2000HistorialService(nest, respaldo, repo, prisma));
    return { repo, llamadas, fase2 };
  }

  it('PUT tasa diaria: guarda la configuración anterior en 18-RENTA1:TASA-DIARIA y manda el cuerpo limpio', async () => {
    const { repo, llamadas, fase2 } = montar();
    await fase2.guardarAutoParametro('18-RENTA1', 'tasa-diaria', { coberturas: ['1'], tasas: [{ ctipo: 1, tasa: 0.072 }], dias_min: 1, dias_max: 30 }, ctx);
    assert.deepEqual(llamadas, [
      'PUT planes/18/RENTA1/auto/tasa-diaria {"coberturas":["1"],"tasas":[{"ctipo":1,"tasa":0.072}],"tasa_defecto":null,"dias_min":1,"dias_max":30}',
    ]);
    const r = await repo.buscar('PLAN', '18-RENTA1:TASA-DIARIA');
    const [v] = await repo.versiones(r!.id);
    assert.deepEqual((v.anterior as Obj).config, { cramo: 18, tasas: { '1': 0.05 } });
  });

  it('DELETE deducibles: versión ELIMINACION en 18-RENTA1:DEDUCIBLE-DESCUENTO', async () => {
    const { repo, llamadas, fase2 } = montar();
    await fase2.desactivarAutoParametro('18-RENTA1', 'deducibles', ctx);
    assert.deepEqual(llamadas, ['DELETE planes/18/RENTA1/auto/deducibles']);
    const r = await repo.buscar('PLAN', '18-RENTA1:DEDUCIBLE-DESCUENTO');
    const [v] = await repo.versiones(r!.id);
    assert.equal(v.tipo, 'ELIMINACION');
  });
});
