// Configurador fase 1 (CONTRATO-CONFIGURADOR-AUTO): cuerpos hacia nest-api y respaldo antes de cada escritura.
import { beforeEach, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { Sis2000RespaldoService } from '../src/core/respaldo/sis2000-respaldo.service';
import { claveRespaldo, Sis2000HistorialService } from '../src/core/respaldo/sis2000-historial.service';
import {
  aBajaComision,
  aComision,
  aCrearTarifa,
  aDeducibleCoberturaPlan,
  aEditarDetalleTarifa,
  aTasasAntiguedad,
  aTipoUso,
} from '../src/partner-bridge/configurador.mapper';
import type { PartnerBridgeService } from '../src/partner-bridge/partner-bridge.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { MemoriaRespaldoRepo } from './respaldo-memoria';

type Obj = Record<string, unknown>;
const usuario = { id: 'u1', email: 'pm@exelixi.test', nombre: 'Product Manager' };

/** nest-api simulado: solo lo que usan las escrituras de la fase 1. */
class NestSimulado {
  comisiones: Obj[] = [];
  tiposUso: Obj[] = [{ ctipo: 1, ccategotr: 1, mprimbas: 10 }];
  /** Si true, el PUT tipos-uso sin confirmar devuelve advertencias y no graba. */
  parEnOtroRamo = false;
  llamadas: string[] = [];

  async listarSis2000Comisiones() {
    return JSON.parse(JSON.stringify(this.comisiones)) as Obj[];
  }
  async agregarSis2000Comision(_cramo: number, _cplan: string, body: Obj) {
    this.llamadas.push('alta');
    this.comisiones.push({ ...aComision(body), iestado: 'V' });
    return { ok: true };
  }
  async bajaSis2000Comision(_cramo: number, _cplan: string, body: Obj) {
    this.llamadas.push('baja');
    const b = aBajaComision(body);
    const fila = this.comisiones.find((c) => c.ctipoprod === b.ctipoprod && c.fdesde === b.fdesde);
    if (fila) Object.assign(fila, { fhasta: b.fhasta, iestado: 'I' });
    return { ok: true };
  }
  async leerSis2000TiposUso() {
    return { filas: JSON.parse(JSON.stringify(this.tiposUso)) as Obj[], planesAfectados: ['AUTO01', 'AUTO02'] };
  }
  async guardarSis2000TipoUso(_cramo: number, ctipo: string, ccategotr: string, body: Obj) {
    const cuerpo = aTipoUso(body);
    if (this.parEnOtroRamo && !cuerpo.confirmar) {
      return { grabado: false, accion: null, advertencias: ['El par 1/1 también existe en el ramo 26: el SP los une sin ramo.'] };
    }
    this.llamadas.push('tipo-uso');
    const fila = this.tiposUso.find((f) => String(f.ctipo) === ctipo && String(f.ccategotr) === ccategotr);
    const { confirmar: _c, ...valores } = cuerpo as Obj;
    Object.assign(fila ?? {}, valores);
    return { grabado: true, accion: fila ? 'actualizado' : 'insertado', advertencias: [] };
  }
}

function montar() {
  const repo = new MemoriaRespaldoRepo();
  const nest = new NestSimulado();
  const respaldo = new Sis2000RespaldoService(repo);
  const prisma = { coberturaSumaConfig: { findMany: async () => [] } } as unknown as PrismaService;
  const historial = new Sis2000HistorialService(nest as unknown as PartnerBridgeService, respaldo, repo, prisma);
  return { repo, nest, historial };
}

describe('configurador fase 1: cuerpos hacia nest-api', () => {
  it('deducible en crear tarifa y en el PATCH de la tasa (null quita el deducible solo al editar)', () => {
    const crear = aCrearTarifa({
      cramo: 18,
      ccober: '1',
      ctarifa: '1',
      detalles: [{ fdesde: '2026-11-18', pprima: 2, bfraded: 'd', mdedu_fran: '500', pdedu_fran: '' }],
    });
    assert.deepEqual((crear.detalles as Obj[])[0], { fdesde: '2026-11-18', pprima: 2, bfraded: 'D', mdedu_fran: 500 });
    assert.deepEqual(aEditarDetalleTarifa({ bfraded: null, fhasta: '2026-12-31', iestado: 'i' }), {
      fhasta: '2026-12-31',
      iestado: 'I',
      bfraded: null,
    });
    assert.deepEqual(aEditarDetalleTarifa({ pprima: 1.5 }), { pprima: 1.5 });
    assert.deepEqual(aDeducibleCoberturaPlan({ bfraded: 'F', pdedu_fran: 10, mmax_desem: 1000, otra: 1 }), {
      bfraded: 'F',
      pdedu_fran: 10,
      mmax_desem: 1000,
    });
  });

  it('comisión: comodines por defecto (productor 0, cobertura y tarifa «0»)', () => {
    assert.deepEqual(aComision({ ctipoprod: '1', fdesde: '2026-11-18T00:00:00', pcomision: '12.5' }), {
      ctipoprod: 1,
      cproductor: 0,
      ccober: '0',
      ctarifa: '0',
      fdesde: '2026-11-18',
      pcomision: 12.5,
    });
  });

  it('tipo/uso solo manda confirmar cuando el usuario aceptó; tramos con números', () => {
    assert.equal(aTipoUso({ mprimbas: '10' }).confirmar, undefined);
    assert.equal(aTipoUso({ mprimbas: '10', confirmar: true }).confirmar, true);
    assert.deepEqual(aTasasAntiguedad({ tramos: [{ desde: '0', hasta: '5', pprima: '2.5' }] }), {
      tramos: [{ desde: 0, hasta: 5, pprima: 2.5 }],
    });
    assert.deepEqual(aTasasAntiguedad({ tramos: [], confirmar: true }), { tramos: [], confirmar: true });
  });
});

describe('configurador fase 1: respaldo antes de escribir', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(() => {
    m = montar();
  });

  it('alta y baja de comisión quedan como versiones de la sección del plan, no del plan', async () => {
    await m.historial.agregarComision(18, 'auto01', { ctipoprod: 1, fdesde: '2026-11-18', pcomision: 10 }, { usuario, motivo: 'Comisión nueva' });
    await m.historial.bajaComision(18, 'AUTO01', { ctipoprod: 1, fdesde: '2026-11-18', fhasta: '2026-12-31' }, { usuario });

    assert.equal(m.repo.respaldos.length, 1);
    const r = m.repo.respaldos[0];
    assert.equal(r.entidad, 'PLAN');
    assert.equal(r.clave, claveRespaldo.seccionPlan(18, 'AUTO01', 'COMISIONES'));
    assert.equal(r.clave, '18-AUTO01:COMISIONES');
    assert.deepEqual(r.original, []);
    const [v2, v1] = await m.repo.versiones(r.id);
    assert.equal(v1.resultado, 'APLICADA');
    assert.equal(v1.motivo, 'Comisión nueva');
    assert.equal((v1.payload as Obj).operacion, 'alta');
    assert.equal((v2.payload as Obj).operacion, 'baja');
    assert.equal(((v2.estado as Obj[])[0] as Obj).iestado, 'I');
  });

  it('tipo/uso con grabado false: no graba, devuelve las advertencias y la versión queda FALLIDA', async () => {
    m.nest.parEnOtroRamo = true;
    const r = (await m.historial.guardarTipoUso(18, '1', '1', { mprimbas: 20 }, { usuario })) as Obj;
    assert.equal(r.grabado, false);
    assert.equal((r.advertencias as string[]).length, 1);
    assert.deepEqual(m.nest.llamadas, []);
    const respaldo = m.repo.respaldos[0];
    assert.equal(respaldo.clave, '18-*:TIPOS-USO');
    const [v] = await m.repo.versiones(respaldo.id);
    assert.equal(v.resultado, 'FALLIDA');

    const ok = (await m.historial.guardarTipoUso(18, '1', '1', { mprimbas: 20, confirmar: true }, { usuario })) as Obj;
    assert.equal(ok.grabado, true);
    assert.deepEqual(m.nest.llamadas, ['tipo-uso']);
    const [v2] = await m.repo.versiones(respaldo.id);
    assert.equal(v2.resultado, 'APLICADA');
    assert.deepEqual(v2.cambios, [{ campo: 'filas[0].mprimbas', antes: 10, despues: 20 }]);
  });

  it('restaurar una sección todavía no está disponible (se informa en vez de reescribir el plan)', async () => {
    await m.historial.agregarComision(18, 'AUTO01', { ctipoprod: 1, fdesde: '2026-11-18', pcomision: 10 }, { usuario });
    await assert.rejects(
      () => m.historial.restaurar('PLAN', '18-AUTO01:COMISIONES', { destino: 'ORIGINAL', motivo: 'Volver atrás' }, { usuario }),
      /todavía no está disponible/,
    );
  });
});
