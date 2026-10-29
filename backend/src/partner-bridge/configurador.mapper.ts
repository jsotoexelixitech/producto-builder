// Cuerpos de los formularios (forma de los paquetes @gestacio / @quand-mind) → DTOs de nest-api v1/configurador.
// nest-api convierte tipos de forma implícita (p. ej. '0' → true), así que aquí se mapea todo explícito.

type Obj = Record<string, unknown>;

const texto = (v: unknown) => (v == null ? '' : String(v).trim());
const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
const fecha = (v: unknown) => (texto(v) ? texto(v).slice(0, 10) : undefined);

/** true para true / 'T' / 'S' / '1' / 1; false para el resto; undefined si no viene. */
export function aBooleano(v: unknown): boolean | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  return ['T', 'S', '1', 'TRUE', 'Y'].includes(String(v).trim().toUpperCase());
}

/** Quita claves undefined o texto vacío (los DTOs de nest-api las tratan como valor). */
function limpio<T extends Obj>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;
}

const estado = (v: unknown) => {
  const e = texto(v).toUpperCase();
  return e === 'V' || e === 'I' ? e : undefined;
};

export function aCrearCobertura(p: Obj) {
  return limpio({
    cramo: num(p.cramo),
    ccobertura: texto(p.ccobertura),
    xdescripcion_l: texto(p.xdescripcion_l ?? p.xcobertura),
    xdescripcion_c: texto(p.xdescripcion_c),
    xabreviatura: texto(p.xabreviatura),
    bobligatoria: aBooleano(p.bobligatoria),
    cmoneda: texto(p.cmoneda),
    isuma: texto(p.isuma),
    isumarecibo: texto(p.isumarecibo),
    ccontrea: num(p.ccontrea),
    cramorea: num(p.cramorea),
    cramopcnd: num(p.cramopcnd),
    cramoint: num(p.cramoint),
    ccoberturaint: num(p.ccoberturaint),
  });
}

export function aEditarCobertura(p: Obj) {
  return limpio({
    xdescripcion_l: texto(p.xdescripcion_l),
    xdescripcion_c: texto(p.xdescripcion_c),
    xabreviatura: texto(p.xabreviatura),
    bobligatoria: aBooleano(p.bobligatoria),
    iestado: estado(p.iestado),
  });
}

export function aDetalleTarifa(p: Obj) {
  return limpio({
    fdesde: fecha(p.fdesde),
    fhasta: fecha(p.fhasta),
    pprima: num(p.pprima),
    mprima: num(p.mprima),
    msumamin: num(p.msumamin),
    msumamax: num(p.msumamax),
  });
}

export function aCrearDetalleTarifa(p: Obj) {
  return limpio({ cramo: num(p.cramo), ccober: texto(p.ccober ?? p.ccobertura), ctarifa: texto(p.ctarifa), ...aDetalleTarifa(p) });
}

export function aCrearTarifa(p: Obj) {
  const detalles = Array.isArray(p.detalles) ? (p.detalles as Obj[]).map(aDetalleTarifa) : undefined;
  return limpio({
    cramo: num(p.cramo),
    ccober: texto(p.ccober ?? p.ccobertura),
    ctarifa: texto(p.ctarifa),
    xtarifam: texto(p.xtarifam),
    xtarifa: texto(p.xtarifa),
    xabrev: texto(p.xabrev),
    bobligatoria: aBooleano(p.bobligatoria),
    detalles: detalles?.length ? detalles : undefined,
  });
}

export function aEditarTarifa(p: Obj) {
  return limpio({
    xtarifam: texto(p.xtarifam),
    xtarifa: texto(p.xtarifa),
    bobligatoria: aBooleano(p.bobligatoria),
    iestado: estado(p.iestado),
  });
}

/** CreatePlanDto (spMantPlanes del paquete de planes) → PlanDto de v1/configurador/planes. */
export function aPlan(p: Obj) {
  const lista = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);
  return limpio({
    type: texto(p.type) === 'personas' ? 'personas' : 'cosas',
    cramo: num(p.cramo),
    cplan: texto(p.cplan),
    xplan: texto(p.xplan),
    cproducto: texto(p.cproducto),
    fdesde: fecha(p.fdesde),
    fhasta: fecha(p.fhasta),
    cmoneda: texto(p.cmoneda),
    itiporen: texto(p.itiporen),
    idevolucion: texto(p.idevolucion),
    xobservacion: texto(p.xobservacion),
    ctipo: num(p.ctipo),
    ctenedor: num(p.ctenedor),
    cbeneficiario: num(p.cbeneficiario),
    bnacional: aBooleano(p.bnacional),
    all_productor: aBooleano(p.all_productor ?? p.all_productores) ?? false,
    productores: lista(p.productores).map((x) => num((x as Obj)?.cproductor ?? x)).filter((x): x is number => x !== undefined),
    all_canal: aBooleano(p.all_canal ?? p.all_canales) ?? false,
    canales: lista(p.canales).map((x) => num((x as Obj)?.ccanalalt ?? x)).filter((x): x is number => x !== undefined),
    coberturas: lista(p.coberturas).map((x) => {
      const c = x as Obj;
      return limpio({
        ccobertura: texto(c.ccobertura),
        ctarifa: texto(c.ctarifa),
        msumamin: num(c.msumamin),
        msumamax: num(c.msumamax),
        mprima: num(c.mprima),
        pprima: num(c.pprima),
        bobligatoria: aBooleano(c.bobligatoria),
        parentescos: Array.isArray(c.parentescos)
          ? (c.parentescos as Obj[]).map((r) => limpio({
              cparen: num(r.cparen),
              csexo: texto(r.csexo) || 'A',
              ctablatar: texto(r.ctablatar),
              nedad_min: num(r.nedad_min),
              nedad_max: num(r.nedad_max),
              msuma: num(r.msuma),
              msumamax: num(r.msumamax),
              mprima: num(r.mprima),
            }))
          : undefined,
      });
    }),
    frecuencias: lista(p.frecuencias).map((x) => {
      const f = x as Obj;
      return limpio({ ifrecuencia: texto(f.ifrecuencia), xfrecuencia: texto(f.xfrecuencia), ndias: num(f.ndias) });
    }),
  });
}

/** Id del plan en el configurador del front: "cramo-cplan". */
export function partirPlanId(id: string): { cramo: number; cplan: string } {
  const [cramo, ...resto] = String(id).split('-');
  return { cramo: Number(cramo), cplan: resto.join('-').trim() };
}
