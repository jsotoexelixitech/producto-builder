// Configurador fase 2 «editar todo» (CONTRATO-CONFIGURADOR-FASE2): cuerpos hacia nest-api y respaldo antes de escribir.
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { Sis2000RespaldoService } from '../src/core/respaldo/sis2000-respaldo.service';
import { claveRespaldo, Sis2000HistorialService } from '../src/core/respaldo/sis2000-historial.service';
import { ConfiguradorFase2Service } from '../src/core/configurador-fase2.service';
import {
  aCabeceraPlan,
  aCoberturaPlan,
  aCondominio,
  aDescRec,
  aEditarFrecuencia,
  aEditarProducto,
  aVersionCasco,
  aFrecuencia,
  aQuienVende,
  aTarifaCoberturaPlan,
  aTarifaDias,
  consultaQuienVende,
  errorRepartoCondominio,
  filasBorradas,
  leerSobre,
  respuestaEscritura,
} from '../src/partner-bridge/configurador-fase2.mapper';
import type { PartnerBridgeService } from '../src/partner-bridge/partner-bridge.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { MemoriaRespaldoRepo } from './respaldo-memoria';

type Obj = Record<string, unknown>;
const usuario = { id: 'u1', email: 'pm@exelixi.test', nombre: 'Product Manager' };
const ctx = { usuario, motivo: 'prueba fase 2' };

/** nest-api simulado: rutas de v1/configurador en memoria. */
class NestSimulado {
  frecuencias: Obj[] = [{ ifrecuencia: 'A', xfrecuencia: 'Anual', ndias: null, iestado: 'V' }];
  frecProd: Obj[] = [{ cproductor: 10, ifrecuencia: 'M', xfrecuencia: 'Mensual' }];
  mausuplan: Obj[] = [
    { id: 1, centidad: 'P', citem: '101', itipouso: 'A' },
    { id: 2, centidad: 'P', citem: '102', itipouso: 'A' },
    { id: 3, centidad: 'C', citem: null, itipouso: 'A' },
  ];
  plan: Obj = { plan: { cplan: 'PLAN01', xplan: 'Plan uno', cmoneda: 'USD', cproducto: 'PRO1', iestado: 'V', coberturas: [{ ccobertura: '1', ctarifa: '1' }] } };
  pedirConfirmar = false;
  llamadas: string[] = [];

  isConfigured() {
    return true;
  }
  async leerSis2000Plan() {
    return JSON.parse(JSON.stringify(this.plan)) as Obj;
  }
  async leerConfigurador(ruta: string): Promise<unknown> {
    if (ruta === 'ramos') return [{ cramo: 28, familia: 'patrimonial' }];
    if (ruta.endsWith('/frecuencias')) return JSON.parse(JSON.stringify(this.frecuencias));
    if (ruta.endsWith('/frecuencias-productor')) return JSON.parse(JSON.stringify(this.frecProd));
    if (ruta.endsWith('/quien-vende/resumen')) return [{ centidad: 'P', itipouso: 'A', cantidad: 2 }];
    if (ruta.includes('/quien-vende')) {
      const q = new URLSearchParams(ruta.split('?')[1] ?? '');
      return { filas: this.mausuplan.filter((f) => f.centidad === q.get('centidad') && f.itipouso === q.get('itipouso')), total: 2 };
    }
    return [];
  }
  async escribirConfigurador(metodo: string, ruta: string, cuerpo?: Obj): Promise<Obj> {
    this.llamadas.push(`${metodo} ${ruta}`);
    if (this.pedirConfirmar && !cuerpo?.confirmar) return { grabado: false, advertencias: ['¿Seguro?'] };
    if (ruta.endsWith('/frecuencias') && metodo === 'POST') {
      this.frecuencias.push({ ...cuerpo, iestado: 'V' });
      return { grabado: true, advertencias: [] };
    }
    if (ruta.includes('/frecuencias-productor/') && metodo === 'DELETE') {
      const borradas = this.frecProd.splice(0, 1);
      return { borradas, advertencias: [] };
    }
    if (ruta.endsWith('/quien-vende/baja')) {
      const items = (cuerpo?.items as string[] | null) ?? null;
      const borradas = this.mausuplan.filter((f) => f.centidad === cuerpo?.centidad && items?.includes(String(f.citem)));
      this.mausuplan = this.mausuplan.filter((f) => !borradas.includes(f));
      return { borradas, advertencias: [] };
    }
    if (metodo === 'PATCH' && /^planes\/\d+\/[^/]+$/.test(ruta)) {
      Object.assign(this.plan.plan as Obj, cuerpo);
      return { advertencias: [] };
    }
    return { advertencias: [] };
  }
}

function montar() {
  const repo = new MemoriaRespaldoRepo();
  const nest = new NestSimulado();
  const respaldo = new Sis2000RespaldoService(repo);
  const prisma = { coberturaSumaConfig: { findMany: async () => [] } } as unknown as PrismaService;
  const bridge = nest as unknown as PartnerBridgeService;
  const historial = new Sis2000HistorialService(bridge, respaldo, repo, prisma);
  const fase2 = new ConfiguradorFase2Service(bridge, respaldo, historial);
  return { repo, nest, fase2 };
}

describe('configurador fase 2: cuerpos hacia nest-api', () => {
  it('frecuencia en mayúscula y quién vende con items null = todos, sin repetidos', () => {
    assert.deepEqual(aFrecuencia({ ifrecuencia: 'd', xfrecuencia: 'Por días', ndias: '15' }), { ifrecuencia: 'D', xfrecuencia: 'Por días', ndias: 15 });
    assert.deepEqual(aQuienVende({ centidad: 'p', itipouso: 'x', items: null }), { centidad: 'P', itipouso: 'A', items: null });
    assert.deepEqual(aQuienVende({ centidad: 'G', itipouso: 'E', items: ['7', ' 7', '8', ''] }), { centidad: 'G', itipouso: 'E', items: ['7', '8'] });
    assert.equal(aQuienVende({ centidad: 'C', items: [], confirmar: true }).confirmar, true);
  });

  it('prima y tasa excluyentes: gana la que tiene valor', () => {
    assert.deepEqual(aTarifaCoberturaPlan({ msumamax: '1000', mprima: '0', pprima: '1.5' }), { msumamax: 1000, pprima: 1.5 });
    assert.deepEqual(aCoberturaPlan({ ccobertura: '1', ctarifa: '2', msumamax: 5, mprima: 10, bobligatoria: 'S' }), {
      ccobertura: '1',
      ctarifa: '2',
      msumamax: 5,
      mprima: 10,
      bobligatoria: true,
    });
  });

  it('frecuencia: ndias identifica la fila y ndiasNuevo es el valor nuevo', () => {
    assert.deepEqual(aEditarFrecuencia({ ndias: '0', ndiasNuevo: '15', xfrecuencia: 'Quincenal' }), { xfrecuencia: 'Quincenal', ndias: 0, ndiasNuevo: 15 });
  });

  it('tasa de casco: ajuste con filtros del SP o restauración por versión', () => {
    assert.deepEqual(
      aVersionCasco({ origen: 'ajuste', cusuario: '12', movimiento: 'incremento', porcentaje: '5', alcance: 'cobertura', filtros: { coverages: ['1', ' 28'], otro: 1 }, rige_al_aprobar: true, motivo: 'Ajuste anual de casco' }),
      { origen: 'AJUSTE', cusuario: 12, rige_al_aprobar: true, motivo: 'Ajuste anual de casco', movimiento: 'INCREMENTO', porcentaje: 5, alcance: 'COBERTURA', filtros: { coverages: ['1', '28'] } },
    );
    assert.deepEqual(aVersionCasco({ origen: 'RESTAURACION', cusuario: 3, version_id: '9', vigente_desde: '2026-12-01', motivo: 'Volver a la 9' }), {
      origen: 'RESTAURACION',
      cusuario: 3,
      vigente_desde: '2026-12-01',
      motivo: 'Volver a la 9',
      version_id: 9,
    });
  });

  it('producto: solo campos editables, nunca cproducto; null vacía el campo; cabecera en mayúsculas', () => {
    assert.deepEqual(aEditarProducto({ cramo: 28, xurl_presentacion: null, norden: null, igestor: null }), { cramo: 28, norden: null, xurl_presentacion: null });
    const p = aEditarProducto({ cproducto: 'X', cramo: '28', igestor: 'S', norden: '3', otro: 1, xform: ' emision ' });
    assert.deepEqual(p, { cramo: 28, igestor: true, norden: 3, xform: 'emision' });
    assert.deepEqual(aCabeceraPlan({ xplan: 'Nuevo', cmoneda: 'usd', iestado: 'x' }), { xplan: 'Nuevo', cmoneda: 'USD' });
  });

  it('descuentos, condominio y tarifa por días', () => {
    assert.deepEqual(aDescRec('sustancias', { csustanc: '4', xsustanc: 'Gas', porcenta: '12.5' }, true), { csustanc: 4, xsustanc: 'Gas', porcenta: 12.5 });
    assert.deepEqual(aDescRec('dispositivos', { nombre: 'Alarma', porcentaje: 5 }, false), { xdisseg: 'Alarma', pdisseg: 5 });
    const rep = aCondominio('reparto', { filas: [{ ccober: '1', ctarifa: '1', itipo: 'p', pvalor: '60' }, { ccober: '2', ctarifa: '1', itipo: 'P', pvalor: 30 }] });
    assert.match(String(errorRepartoCondominio(rep.filas as Obj[])), /sumar 100; suma 90/);
    assert.equal(errorRepartoCondominio([{ itipo: 'P', pvalor: 100 }, { itipo: 'F', pvalor: 7 }]), null);
    assert.deepEqual(aTarifaDias({ filas: [{ ctarifabi: '1', qdias: '30', bnacional: '1', ndias_min: 1, ndias_max: 30, mprima_anual: '50' }] }).filas, [
      { ctarifabi: 1, qdias: 30, bnacional: true, ndias_min: 1, ndias_max: 30, mprima_anual: 50 },
    ]);
  });

  it('consulta de quién vende y lectura de sobres', () => {
    assert.equal(consultaQuienVende({ centidad: 'p', itipouso: 'e', q: 'ana', limit: 99999, offset: 50 }), '?centidad=P&itipouso=E&q=ana&limit=500&offset=50');
    assert.equal(consultaQuienVende({}), '');
    assert.deepEqual(leerSobre({ status: true, data: [1, 2], total: 9 }), { filas: [1, 2], total: 9 });
    assert.deepEqual(leerSobre({ status: true, data: [1] }), [1]);
    assert.deepEqual(respuestaEscritura({ data: { grabado: true, advertencias: [{ mensaje: 'ojo' }] } }), { grabado: true, advertencias: ['ojo'] });
    assert.deepEqual(filasBorradas({ borradas: [{ id: 1 }] }), [{ id: 1 }]);
  });
});

describe('configurador fase 2: respaldo antes de escribir', () => {
  it('alta de frecuencia: respaldo con clave plan + FRECUENCIAS y lo que había', async () => {
    const { repo, nest, fase2 } = montar();
    await fase2.agregarFrecuencia('28-PLAN01', { ifrecuencia: 'm', xfrecuencia: 'Mensual' }, ctx);
    const r = await repo.buscar('PLAN', claveRespaldo.seccionPlan(28, 'PLAN01', 'FRECUENCIAS'));
    assert.ok(r);
    assert.equal((r!.original as Obj[]).length, 1);
    const [v] = await repo.versiones(r!.id);
    assert.equal(v.resultado, 'APLICADA');
    assert.equal((v.estado as Obj[]).length, 2);
    assert.deepEqual(nest.llamadas, ['POST planes/28/PLAN01/frecuencias']);
  });

  it('baja física de frecuencia de productor: guarda la lista previa y las filas devueltas', async () => {
    const { repo, fase2 } = montar();
    await fase2.borrarFrecuenciaProductor('28-PLAN01', '10', 'm', '0', ctx);
    const r = await repo.buscar('PLAN', '28-PLAN01:FRECUENCIAS-PRODUCTOR');
    const [v] = await repo.versiones(r!.id);
    assert.equal(v.tipo, 'ELIMINACION');
    assert.equal((v.anterior as Obj[]).length, 1);
    assert.deepEqual((v.estado as Obj).devuelto, [{ cproductor: 10, ifrecuencia: 'M', xfrecuencia: 'Mensual' }]);
  });

  it('baja de quién vende: respaldo parcial (resumen + filas tocadas) y filas borradas en la versión', async () => {
    const { repo, fase2 } = montar();
    await fase2.bajaQuienVende('28-PLAN01', { centidad: 'P', itipouso: 'A', items: ['101'], motivoCambio: 'x' }, ctx);
    const r = await repo.buscar('PLAN', '28-PLAN01:QUIEN-VENDE');
    const [v] = await repo.versiones(r!.id);
    assert.deepEqual((v.anterior as Obj).filas, [{ id: 1, centidad: 'P', citem: '101', itipouso: 'A' }]);
    assert.deepEqual(((v.estado as Obj).devuelto as Obj[]).map((f) => f.id), [1]);
  });

  it('R, U y A no se editan', async () => {
    const { fase2 } = montar();
    await assert.rejects(async () => fase2.agregarQuienVende('28-PLAN01', { centidad: 'R', items: null }, ctx), BadRequestException);
  });

  it('cabecera: respaldo del plan completo; sin cambios = 400', async () => {
    const { repo, nest, fase2 } = montar();
    await fase2.editarCabecera('28-PLAN01', { xplan: 'Plan nuevo' }, ctx);
    const r = await repo.buscar('PLAN', '28-PLAN01:CABECERA');
    const [v] = await repo.versiones(r!.id);
    assert.deepEqual(v.cambios, [{ campo: 'xplan', antes: 'Plan uno', despues: 'Plan nuevo' }]);
    assert.equal((nest.plan.plan as Obj).xplan, 'Plan nuevo');
    await assert.rejects(async () => fase2.editarCabecera('28-PLAN01', { iestado: 'X' }, ctx), BadRequestException);
  });

  it('grabado false: no grabó, versión FALLIDA y se devuelven las advertencias', async () => {
    const { repo, nest, fase2 } = montar();
    nest.pedirConfirmar = true;
    const r = await fase2.agregarFrecuencia('28-PLAN01', { ifrecuencia: 'S' }, ctx);
    assert.equal(r.grabado, false);
    const resp = await repo.buscar('PLAN', '28-PLAN01:FRECUENCIAS');
    const [v] = await repo.versiones(resp!.id);
    assert.equal(v.resultado, 'FALLIDA');
    assert.match(String(v.error), /confirmar/);
  });

  it('reparto de condominio que no suma 100 no llega a nest-api', async () => {
    const { nest, fase2 } = montar();
    await assert.rejects(
      async () => fase2.guardarCondominio('28', 'reparto', { filas: [{ ccober: '1', ctarifa: '1', itipo: 'P', pvalor: 50 }] }, ctx),
      BadRequestException,
    );
    await assert.rejects(async () => fase2.guardarCondominio('28', 'otra', { filas: [] }, ctx), BadRequestException);
    assert.deepEqual(nest.llamadas, []);
  });

  it('catálogo de ramos = GET ramos (con conteos, avisos y secciones)', async () => {
    const { fase2 } = montar();
    assert.deepEqual(await fase2.ramos(), [{ cramo: 28, familia: 'patrimonial' }]);
  });

  it('tasa de casco: proponer exige motivo ≥ 10 y cusuario; rechazar exige comentario', async () => {
    const { nest, fase2 } = montar();
    await assert.rejects(async () => fase2.crearVersionCasco('18', { origen: 'AJUSTE', cusuario: 5, motivo: 'corto' }, ctx), BadRequestException);
    await assert.rejects(async () => fase2.rechazarVersionCasco('18', '7', { cusuario: 5 }, ctx), BadRequestException);
    await fase2.publicarVersionCasco('18', '7', { cusuario: 6, comentario: 'ok' }, ctx);
    assert.deepEqual(nest.llamadas, ['POST auto/18/tasa-casco/versiones/7/publicar']);
  });

  it('clave de sección del ramo', () => {
    assert.equal(claveRespaldo.seccionRamo(28, 'DISPOSITIVOS'), '28-*:DISPOSITIVOS');
  });
});
