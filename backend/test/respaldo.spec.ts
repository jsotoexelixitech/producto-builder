import { beforeEach, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { diferencias, Sis2000RespaldoService } from '../src/core/respaldo/sis2000-respaldo.service';
import { Sis2000HistorialService } from '../src/core/respaldo/sis2000-historial.service';
import { canalesAAgregar, cuerpoPlan, cuerpoSpMantPlanes, type PartnerBridgeService } from '../src/partner-bridge/partner-bridge.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { MemoriaRespaldoRepo, Sis2000Simulado } from './respaldo-memoria';

type Obj = Record<string, unknown>;

const usuario = { id: 'u1', email: 'pm@exelixi.test', nombre: 'Product Manager' };
const coberturaOriginal = (): Obj => ({
  cramo: 28,
  ccobertura: '12',
  xdescripcion_l: 'INCENDIO',
  xdescripcion_c: 'INCENDIO',
  xabreviatura: 'INC',
  bobligatoria: true,
  iestado: 'V',
  ccontrea: 6016,
  cramorea: 108,
  cramopcnd: 125,
});

function montar() {
  const repo = new MemoriaRespaldoRepo();
  const sis = new Sis2000Simulado();
  const respaldo = new Sis2000RespaldoService(repo);
  const prisma = { coberturaSumaConfig: { findMany: async () => [] } } as unknown as PrismaService;
  const historial = new Sis2000HistorialService(sis as unknown as PartnerBridgeService, respaldo, repo, prisma);
  return { repo, sis, respaldo, historial };
}

describe('respaldo antes de escribir en Sis2000', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(() => {
    m = montar();
    m.sis.coberturas.push(coberturaOriginal());
  });

  it('guarda la copia original una sola vez y nunca la sobreescribe', async () => {
    await m.historial.editarCobertura(28, '12', { xdescripcion_l: 'INCENDIO Y LÍNEAS ALIADAS' }, { usuario, motivo: 'Nombre comercial' });
    await m.historial.editarCobertura(28, '12', { xdescripcion_l: 'INCENDIO TOTAL' }, { usuario });

    assert.equal(m.repo.respaldos.length, 1);
    const r = m.repo.respaldos[0];
    assert.equal(r.entidad, 'COBERTURA');
    assert.equal(r.clave, '28-12');
    assert.equal(r.existia, true);
    assert.deepEqual(r.original, coberturaOriginal());
    assert.equal(r.usuarioEmail, usuario.email);
  });

  it('cada cambio crea una versión con lo que había, lo que quedó, quién, motivo y qué cambió', async () => {
    await m.historial.editarCobertura(28, '12', { xdescripcion_l: 'INCENDIO Y LÍNEAS ALIADAS' }, { usuario, motivo: 'Nombre comercial' });
    await m.historial.editarCobertura(28, '12', { ccontrea: 7000 }, { usuario, motivo: 'Nuevo contrato de reaseguro' });

    const versiones = await m.repo.versiones(m.repo.respaldos[0].id);
    assert.deepEqual(versiones.map((v) => v.numero), [2, 1]);
    const [v2, v1] = versiones;
    assert.equal(v1.tipo, 'CAMBIO');
    assert.equal(v1.resultado, 'APLICADA');
    assert.equal(v1.motivo, 'Nombre comercial');
    assert.equal(v1.usuarioNombre, 'Product Manager');
    assert.equal((v1.anterior as Obj).xdescripcion_l, 'INCENDIO');
    assert.equal((v1.estado as Obj).xdescripcion_l, 'INCENDIO Y LÍNEAS ALIADAS');
    assert.deepEqual(v1.cambios, [{ campo: 'xdescripcion_l', antes: 'INCENDIO', despues: 'INCENDIO Y LÍNEAS ALIADAS' }]);
    assert.deepEqual(v2.cambios, [{ campo: 'ccontrea', antes: 6016, despues: 7000 }]);
    assert.deepEqual(v2.payload, { ccontrea: 7000 });
  });

  it('lo que había se guarda antes de escribir (la versión ya existe PENDIENTE durante la escritura)', async () => {
    let vistoDurante: string | undefined;
    await m.respaldo.escribir({
      entidad: 'COBERTURA',
      clave: '28-12',
      leer: async () => coberturaOriginal(),
      escribir: async () => {
        vistoDurante = m.repo.versionesGuardadas[0]?.resultado;
        return true;
      },
    });
    assert.equal(vistoDurante, 'PENDIENTE');
  });

  it('si la lectura previa falla no se escribe en Sis2000 ni se crea versión', async () => {
    m.sis.fallarLectura = true;
    await assert.rejects(
      () => m.historial.editarCobertura(28, '12', { xdescripcion_l: 'OTRO' }, { usuario }),
      /no se escribe sin respaldo/,
    );
    assert.equal(m.sis.llamadas.length, 0);
    assert.equal(m.repo.respaldos.length, 0);
    assert.equal(m.repo.versionesGuardadas.length, 0);
  });

  it('si no se puede guardar el respaldo tampoco se escribe', async () => {
    m.repo.fallar = true;
    await assert.rejects(() => m.historial.editarCobertura(28, '12', { xdescripcion_l: 'OTRO' }), /no se modificó Sis2000/);
    assert.equal(m.sis.llamadas.length, 0);
  });

  it('si nest-api rechaza la escritura la versión queda FALLIDA con el error', async () => {
    let escribio = false;
    await assert.rejects(() =>
      m.respaldo.escribir({
        entidad: 'COBERTURA',
        clave: '28-12',
        leer: async () => coberturaOriginal(),
        escribir: async () => {
          escribio = true;
          throw new Error('No se pudo editar cobertura');
        },
      }),
    );
    assert.equal(escribio, true);
    const [v] = m.repo.versionesGuardadas;
    assert.equal(v.resultado, 'FALLIDA');
    assert.match(String(v.error), /No se pudo editar/);
  });

  it('modificar algo que no existe no escribe', async () => {
    await assert.rejects(() => m.historial.editarCobertura(28, '99', { xdescripcion_l: 'X' }), /No existe/);
    assert.equal(m.sis.llamadas.length, 0);
  });
});

describe('restaurar', () => {
  let m: ReturnType<typeof montar>;
  beforeEach(() => {
    m = montar();
    m.sis.coberturas.push(coberturaOriginal());
  });

  it('restaurar la original reescribe los valores guardados por nest-api y crea una versión', async () => {
    await m.historial.editarCobertura(28, '12', { xdescripcion_l: 'CAMBIADA', ccontrea: 7000, iestado: 'I' }, { usuario });
    m.sis.llamadas = [];

    const r = await m.historial.restaurar('COBERTURA', '28-12', { destino: 'ORIGINAL', motivo: 'Se perdió el nombre' }, { usuario });

    assert.equal(r.ok, true);
    assert.equal(m.sis.llamadas.length, 1);
    const [cramo, ccob, cuerpo] = m.sis.llamadas[0].args as [string, string, Obj];
    assert.equal(m.sis.llamadas[0].metodo, 'updateSis2000Cobertura');
    assert.equal(cramo, '28');
    assert.equal(ccob, '12');
    assert.equal(cuerpo.xdescripcion_l, 'INCENDIO');
    assert.equal(cuerpo.ccontrea, 6016);
    assert.equal(cuerpo.iestado, 'V');
    assert.deepEqual(
      Object.fromEntries(Object.keys(coberturaOriginal()).map((k) => [k, m.sis.coberturas[0][k]])),
      coberturaOriginal(),
    );

    const [ultima] = await m.repo.versiones(m.repo.respaldos[0].id);
    assert.equal(ultima.numero, 2);
    assert.equal(ultima.tipo, 'RESTAURACION');
    assert.equal(ultima.restauradaDesde, 'ORIGINAL');
    assert.equal(ultima.motivo, 'Se perdió el nombre');
    assert.equal((ultima.anterior as Obj).xdescripcion_l, 'CAMBIADA');
    assert.equal((ultima.estado as Obj).xdescripcion_l, 'INCENDIO');
    // La original sigue intacta después de restaurar.
    assert.deepEqual(m.repo.respaldos[0].original, coberturaOriginal());
  });

  it('restaurar una versión elegida o «cómo estaba antes» de ella', async () => {
    await m.historial.editarCobertura(28, '12', { xdescripcion_l: 'V1' });
    await m.historial.editarCobertura(28, '12', { xdescripcion_l: 'V2' });
    const v1 = (await m.repo.versiones(m.repo.respaldos[0].id)).find((v) => v.numero === 1)!;

    await m.historial.restaurar('COBERTURA', '28-12', { destino: v1.id, motivo: 'Volver a V1' });
    assert.equal(m.sis.coberturas[0].xdescripcion_l, 'V1');

    await m.historial.restaurar('COBERTURA', '28-12', { destino: v1.id, momento: 'antes', motivo: 'Deshacer V1' });
    assert.equal(m.sis.coberturas[0].xdescripcion_l, 'INCENDIO');
    const versiones = await m.repo.versiones(m.repo.respaldos[0].id);
    assert.equal(versiones[0].restauradaDesde, `${v1.id}:antes`);
  });

  it('exige motivo para restaurar', async () => {
    await m.historial.editarCobertura(28, '12', { xdescripcion_l: 'V1' });
    await assert.rejects(() => m.historial.restaurar('COBERTURA', '28-12', { destino: 'ORIGINAL', motivo: ' ' }), /motivo/);
  });

  it('un plan eliminado se recupera con su copia (se vuelve a crear con el mismo cuerpo)', async () => {
    const plan = {
      type: 'cosas',
      cramo: 28,
      cplan: 'PBT1',
      xplan: 'PLAN PRUEBA',
      cproducto: '89',
      fdesde: '2026-01-01',
      fhasta: '2099-12-31',
      all_productor: false,
      productores: [80080],
      coberturas: [{ ccobertura: '1', ctarifa: '1', msumamax: 50000, pprima: 0.5 }],
      frecuencias: [{ ifrecuencia: 'A', xfrecuencia: 'Anual' }],
    };
    await m.historial.crearPlan(plan, { usuario });
    await m.historial.eliminarPlan('28-PBT1', { usuario, motivo: 'Prueba de borrado' });
    assert.equal(m.sis.planes.size, 0);

    const r = await m.historial.restaurar('PLAN', '28-PBT1', { destino: 'ORIGINAL', motivo: 'Se borró por error' });
    assert.equal(r.ok, true);
    const creado = m.sis.planes.get('28-PBT1')!.plan as Obj;
    assert.equal(creado.xplan, 'PLAN PRUEBA');
    assert.deepEqual(creado.productores, [80080]);
    assert.equal((creado.coberturas as Obj[])[0].pprima, 0.5);
    const versiones = await m.repo.versiones(m.repo.respaldos[0].id);
    assert.deepEqual(versiones.map((v) => v.tipo), ['RESTAURACION', 'ELIMINACION', 'CREACION']);
    assert.equal(m.repo.respaldos[0].existia, false);
  });

  it('proveedores del plan: agrega los que faltan y da de baja (sin borrar) los que sobran', async () => {
    m.sis.proveedores.push({ cramo: 49, cplan: 'MAP2', cci_rif: 311624457, cclave_num: 1, fdesde: '2023-01-01', fhasta: '2040-12-31', itiposerv: 1, mcosto: 0, mcostoext: 11.05, cmoneda: '$' });
    await m.historial.agregarProveedorPlan(49, 'MAP2', { cci_rif: 999, cclave_num: 1, fdesde: '2026-01-01', mcostoext: 5, cmoneda: '$', itiposerv: 1 }, { usuario });
    await m.historial.bajaProveedorPlan(49, 'MAP2', { cci_rif: 311624457, cclave_num: 1, fdesde: '2023-01-01', fhasta_baja: '2026-06-30' }, { usuario });

    await m.historial.restaurar('PLAN_PROVEEDORES', '49-MAP2', { destino: 'ORIGINAL', motivo: 'Volver al proveedor original' });

    const venemergencia = m.sis.proveedores.find((p) => p.cci_rif === 311624457)!;
    assert.equal(venemergencia.fhasta, '2040-12-31');
    const otro = m.sis.proveedores.find((p) => p.cci_rif === 999)!;
    assert.ok(otro, 'la fila no se borra');
    assert.ok(otro.fhasta, 'el proveedor que sobra queda con baja');
    assert.ok(m.sis.llamadas.some((l) => l.metodo === 'bajaSis2000ProveedorPlan'));
    assert.ok(!m.sis.llamadas.some((l) => l.metodo.startsWith('delete')));
  });
});

describe('canales alternos en el plan (bandera SIS2000_PLAN_CANALES)', () => {
  const plan = { type: 'cosas', cramo: 28, cplan: 'X', all_canal: false, canales: [{ ccanalalt: 8 }, 27] };

  it('apagada: se envía lo de siempre (all_canal false, canales vacíos)', () => {
    delete process.env.SIS2000_PLAN_CANALES;
    const body = cuerpoPlan(plan);
    assert.equal(body.all_canal, false);
    assert.deepEqual(body.canales, []);
  });

  it('encendida: se envían los canales elegidos (ccanalalt)', () => {
    process.env.SIS2000_PLAN_CANALES = '1';
    try {
      assert.deepEqual(cuerpoPlan(plan).canales, [8, 27]);
      assert.equal(cuerpoPlan({ ...plan, all_canal: true }).all_canal, true);
    } finally {
      delete process.env.SIS2000_PLAN_CANALES;
    }
  });

  it('spMantPlanes nunca recibe canales; se agregan aparte solo con la bandera encendida', () => {
    process.env.SIS2000_PLAN_CANALES = '1';
    try {
      const sp = cuerpoSpMantPlanes(plan);
      assert.equal(sp.all_canal, false);
      assert.deepEqual(sp.canales, []);
      assert.deepEqual(canalesAAgregar(plan), { canales: [8, 27] });
      assert.deepEqual(canalesAAgregar({ ...plan, all_canal: true }), { all_canal: true });
      assert.equal(canalesAAgregar({ ...plan, canales: [] }), null);
    } finally {
      delete process.env.SIS2000_PLAN_CANALES;
    }
    assert.equal(canalesAAgregar(plan), null);
  });
});

describe('diferencias', () => {
  it('lista solo los campos que cambian, también dentro de listas', () => {
    assert.deepEqual(
      diferencias({ a: 1, b: { c: ' x ' }, l: [1, 2] }, { a: 1, b: { c: 'y' }, l: [1, 3] }),
      [
        { campo: 'b.c', antes: 'x', despues: 'y' },
        { campo: 'l[1]', antes: 2, despues: 3 },
      ],
    );
    assert.deepEqual(diferencias(null, { a: 1 }), [{ campo: '(registro)', antes: null, despues: 'creado' }]);
  });
});
