import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  cuerpoCoberturaPersonas,
  cuerpoCoberturaPlan,
  esUltimaObligatoria,
  formDeCoberturaPlan,
  normalizarCoberturaPlan,
  texto,
  validarCoberturaPersonas,
  validarCoberturaPlan,
  type CoberturaPlanFila,
  type CoberturaPlanForm,
  type ParentescoTabla,
} from '@/lib/configurador-fase2';
import { ConfirmarDialog } from '@/components/sis2000/AsistentePasos';
import { TablaEdadBuscador } from '@/components/sis2000/TablaEdadBuscador';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';
import { TablaEditable, type ColumnaEditable, type FilaTexto } from './TablaEditable';
import { CampoMotivo, DialogoConfirmarEscritura, EstadoEscritura, useEscritura } from './EscrituraConfirmada';

type Fila = Record<string, unknown>;
const monto = (v: number | null) => (v == null ? '—' : v.toLocaleString('es-VE'));
const clave = (cc: string, ct: string) => `${cc.toUpperCase()}|${ct.toUpperCase()}`;
const selectClase = 'h-10 w-full rounded-md border border-border bg-background px-2 text-sm disabled:bg-slate-50';

/** Cobertura de personas del plan: con sus parentescos y la tabla de tasas por edad de cada uno. */
interface CoberturaPersonas {
  ccobertura: string;
  ctarifa: string;
  iestado: string;
  parentescos: ParentescoTabla[];
}

function coberturasPersonasDe(plan: Fila | null): CoberturaPersonas[] {
  const lista = plan && Array.isArray(plan.coberturas) ? (plan.coberturas as Fila[]) : [];
  const mapa = new Map<string, CoberturaPersonas>();
  for (const c of lista) {
    const cc = texto(c.ccobertura ?? c.ccober);
    if (!cc) continue;
    const ct = texto(c.ctarifa);
    const k = clave(cc, ct);
    const actual = mapa.get(k) ?? { ccobertura: cc, ctarifa: ct, iestado: texto(c.iestado).toUpperCase() || 'V', parentescos: [] };
    const pars = Array.isArray(c.parentescos) ? (c.parentescos as Fila[]) : c.cparen != null ? [c] : [];
    for (const p of pars) {
      const cparen = texto(p.cparen);
      if (cparen && !actual.parentescos.some((x) => x.cparen === cparen)) actual.parentescos.push({ cparen, ctablatar: texto(p.ctablatar) });
    }
    mapa.set(k, actual);
  }
  return [...mapa.values()];
}

/**
 * Coberturas del plan sin pasar por JSON. Cosas y auto: suma mínima y máxima, prima fija o tasa % (excluyentes),
 * agregar y dar de baja (maplancob + maplantar de la versión vigente). Personas: por cobertura, cada parentesco con
 * su tabla de tasas por edad (maplcober_per + mapltarifas_per). Dar de baja no borra: deja la cobertura inactiva.
 * Tras grabar llama a `onCambio` para que la ficha vuelva a leer el plan.
 */
export function CoberturasPlanPanel({
  planId,
  cramo,
  familia,
  plan,
  catalogo,
  soloLectura,
  onCambio,
}: {
  planId: string;
  cramo: number;
  familia?: string;
  plan: Record<string, unknown> | null;
  catalogo: Array<Record<string, unknown>>;
  soloLectura?: boolean;
  onCambio?: () => void;
}) {
  const nombres = useMemo(
    () => new Map(catalogo.map((c) => [texto(c.ccobertura).toUpperCase(), texto(c.xdescripcion_l ?? c.xcobertura)])),
    [catalogo],
  );
  const nombre = (cc: string) => nombres.get(cc.toUpperCase()) || `Cobertura ${cc}`;
  const props = { planId, cramo, familia, plan, catalogo, soloLectura, onCambio, nombre };
  return familia === 'personas' ? <CoberturasPersonas {...props} /> : <CoberturasCosas {...props} />;
}

interface PropsInternas {
  familia?: string;
  planId: string;
  cramo: number;
  plan: Fila | null;
  catalogo: Fila[];
  soloLectura?: boolean;
  onCambio?: () => void;
  nombre: (cc: string) => string;
}

/** Selector de cobertura del ramo (las que no están en el plan) + tarifa de esa cobertura. */
function SelectorCoberturaTarifa({
  idBase,
  cramo,
  catalogo,
  excluidas,
  ccobertura,
  ctarifa,
  errores,
  onChange,
}: {
  idBase: string;
  cramo: number;
  catalogo: Fila[];
  excluidas: Set<string>;
  ccobertura: string;
  ctarifa: string;
  errores: { ccobertura?: string; ctarifa?: string };
  onChange: (v: { ccobertura: string; ctarifa: string }) => void;
}) {
  const [tarifas, setTarifas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    if (!ccobertura) {
      setTarifas([]);
      return;
    }
    let vigente = true;
    setCargando(true);
    api
      .listSis2000Tarifas(cramo, ccobertura)
      .then((r) => vigente && setTarifas((r as Fila[]).filter((t) => texto(t.iestado).toUpperCase() !== 'I')))
      .catch(() => vigente && setTarifas([]))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [cramo, ccobertura]);
  const disponibles = catalogo.filter((c) => texto(c.iestado).toUpperCase() !== 'I' && !excluidas.has(texto(c.ccobertura).toUpperCase()));
  return (
    <>
      <div>
        <Label htmlFor={`${idBase}-cob`}>Cobertura</Label>
        <select
          id={`${idBase}-cob`}
          className={cn(selectClase, errores.ccobertura && 'border-red-300')}
          value={ccobertura}
          onChange={(e) => onChange({ ccobertura: e.target.value, ctarifa: '' })}
        >
          <option value="">Elige…</option>
          {disponibles.map((c) => (
            <option key={texto(c.ccobertura)} value={texto(c.ccobertura)}>
              {texto(c.ccobertura)} · {texto(c.xdescripcion_l ?? c.xcobertura)}
            </option>
          ))}
        </select>
        {errores.ccobertura && <p className="mt-0.5 text-[11px] text-red-700">{errores.ccobertura}</p>}
      </div>
      <div>
        <Label htmlFor={`${idBase}-tar`} className="inline-flex items-center gap-1">
          Tarifa
          <InfoTip text="Tarifas activas de la cobertura (matarifa)." />
        </Label>
        <select
          id={`${idBase}-tar`}
          className={cn(selectClase, errores.ctarifa && 'border-red-300')}
          value={ctarifa}
          disabled={!ccobertura || cargando}
          onChange={(e) => onChange({ ccobertura, ctarifa: e.target.value })}
        >
          <option value="">{cargando ? 'Leyendo tarifas…' : ccobertura && !tarifas.length ? 'La cobertura no tiene tarifas' : 'Elige…'}</option>
          {tarifas.map((t) => (
            <option key={texto(t.ctarifa)} value={texto(t.ctarifa)}>
              {texto(t.ctarifa)} · {texto(t.xtarifa ?? t.xtarifam)}
            </option>
          ))}
        </select>
        {errores.ctarifa && <p className="mt-0.5 text-[11px] text-red-700">{errores.ctarifa}</p>}
      </div>
    </>
  );
}

// ── Cosas y auto ──────────────────────────────────────────────────────────────

const FORM_NUEVA = (): CoberturaPlanForm => ({ ccobertura: '', ctarifa: '', msumamin: '0', msumamax: '', modo: 'prima', valor: '', bobligatoria: false });

function CoberturasCosas({ planId, cramo, familia, plan, catalogo, soloLectura, onCambio, nombre }: PropsInternas) {
  const esc = useEscritura();
  const [filas, setFilas] = useState<CoberturaPlanFila[]>([]);
  const [motivo, setMotivo] = useState('');
  const [edicion, setEdicion] = useState<{ k: string; form: CoberturaPlanForm; intento: boolean } | null>(null);
  const [nueva, setNueva] = useState<{ form: CoberturaPlanForm; intento: boolean } | null>(null);
  const [baja, setBaja] = useState<CoberturaPlanFila | null>(null);

  useEffect(() => {
    const lista = plan && Array.isArray(plan.coberturas) ? (plan.coberturas as Fila[]) : [];
    const vistos = new Set<string>();
    setFilas(
      lista.map(normalizarCoberturaPlan).filter((c) => {
        const k = clave(c.ccobertura, c.ctarifa);
        if (!c.ccobertura || vistos.has(k)) return false;
        vistos.add(k);
        return true;
      }),
    );
  }, [plan]);

  const enPlan = useMemo(() => new Set(filas.filter((f) => f.iestado === 'V').map((f) => f.ccobertura.toUpperCase())), [filas]);

  function guardarEdicion() {
    if (!edicion) return;
    setEdicion({ ...edicion, intento: true });
    if (Object.keys(validarCoberturaPlan(edicion.form, false)).length) return;
    const { form } = edicion;
    const cuerpo = cuerpoCoberturaPlan(form, false);
    void esc.ejecutar(
      (confirmar) =>
        api.editarSis2000TarifaCoberturaPlan(planId, form.ccobertura, form.ctarifa, {
          ...cuerpo,
          motivoCambio: motivo || undefined,
          ...(confirmar ? { confirmar: true } : {}),
        }),
      {
        ok: `Cobertura ${nombre(form.ccobertura)} guardada.`,
        titulo: 'No se pudo guardar la cobertura',
        alTerminar: () => {
          setFilas((fs) =>
            fs.map((f) =>
              clave(f.ccobertura, f.ctarifa) === edicion.k
                ? {
                    ...f,
                    msumamin: Number(cuerpo.msumamin),
                    msumamax: Number(cuerpo.msumamax),
                    mprima: form.modo === 'prima' ? Number(cuerpo.mprima) : null,
                    pprima: form.modo === 'tasa' ? Number(cuerpo.pprima) : null,
                  }
                : f,
            ),
          );
          setEdicion(null);
          setMotivo('');
          onCambio?.();
        },
      },
    );
  }

  function agregar() {
    if (!nueva) return;
    setNueva({ ...nueva, intento: true });
    if (Object.keys(validarCoberturaPlan(nueva.form, true)).length) return;
    const cuerpo = cuerpoCoberturaPlan(nueva.form, true);
    void esc.ejecutar(
      (confirmar) =>
        api.agregarSis2000CoberturaPlan(planId, { ...cuerpo, motivoCambio: motivo || undefined, ...(confirmar ? { confirmar: true } : {}) }),
      {
        ok: `Cobertura ${nombre(nueva.form.ccobertura)} agregada al plan.`,
        titulo: 'No se pudo agregar la cobertura',
        duplicado: 'Esa cobertura ya está en el plan con esa tarifa. Edítala en la tabla.',
        alTerminar: () => {
          const f = nueva.form;
          setFilas((fs) => [
            ...fs,
            {
              ccobertura: f.ccobertura,
              ctarifa: f.ctarifa,
              msumamin: Number(cuerpo.msumamin),
              msumamax: Number(cuerpo.msumamax),
              mprima: f.modo === 'prima' ? Number(cuerpo.mprima) : null,
              pprima: f.modo === 'tasa' ? Number(cuerpo.pprima) : null,
              bobligatoria: f.bobligatoria,
              iestado: 'V',
            },
          ]);
          setNueva(null);
          setMotivo('');
          onCambio?.();
        },
      },
    );
  }

  function confirmarBaja() {
    if (!baja) return;
    const b = baja;
    void esc
      .ejecutar(
        (confirmar) =>
          api.bajaSis2000CoberturaPlan(planId, b.ccobertura, { motivoCambio: motivo || undefined, ...(confirmar ? { confirmar: true } : {}) }),
        {
          ok: `Cobertura ${nombre(b.ccobertura)} dada de baja (queda inactiva en el plan; no se borra).`,
          titulo: 'No se pudo dar de baja la cobertura',
          duplicado: 'Sis2000 no deja dar de baja la última cobertura obligatoria del plan: marca otra como obligatoria antes.',
          alTerminar: () => {
            setFilas((fs) => fs.map((f) => (f.ccobertura.toUpperCase() === b.ccobertura.toUpperCase() ? { ...f, iestado: 'I' } : f)));
            setMotivo('');
            onCambio?.();
          },
        },
      )
      .finally(() => setBaja(null));
  }

  const erroresEd = edicion?.intento ? validarCoberturaPlan(edicion.form, false) : {};
  const erroresNueva = nueva?.intento ? validarCoberturaPlan(nueva.form, true) : {};

  return (
    <SectionPanel title="Coberturas del plan" description="Qué cubre el plan, con su suma asegurada y su precio (prima fija o tasa sobre la suma)." icon={ShieldCheck}>
      <div className="space-y-4 text-xs">
        <EstadoEscritura esc={esc} />
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Cobertura</th>
                <th className="px-3 py-2">Tarifa</th>
                <th className="px-3 py-2 text-right">Suma mín.</th>
                <th className="px-3 py-2 text-right">Suma máx.</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-3 py-2">Obligatoria</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                    El plan todavía no tiene coberturas.
                  </td>
                </tr>
              )}
              {filas.map((f) => {
                const k = clave(f.ccobertura, f.ctarifa);
                const precio = f.mprima != null && f.mprima > 0 ? `${monto(f.mprima)} (prima)` : f.pprima != null && f.pprima > 0 ? `${monto(f.pprima)} %` : '—';
                return (
                  <tr key={k} className={cn('border-b border-slate-100 last:border-0', f.iestado !== 'V' && 'text-slate-400')}>
                    <td className="px-3 py-2">
                      {nombre(f.ccobertura)} <span className="font-mono text-slate-500">({f.ccobertura})</span>
                      {f.iestado !== 'V' && <span className="ml-1">(de baja)</span>}
                    </td>
                    <td className="px-3 py-2 font-mono">{f.ctarifa}</td>
                    <td className="px-3 py-2 text-right">{monto(f.msumamin)}</td>
                    <td className="px-3 py-2 text-right">{monto(f.msumamax)}</td>
                    <td className="px-3 py-2 text-right">{precio}</td>
                    <td className="px-3 py-2">{f.bobligatoria ? 'Sí' : 'No'}</td>
                    <td className="px-3 py-2 text-right">
                      {!soloLectura && f.iestado === 'V' && (
                        <span className="inline-flex gap-1">
                          <Button type="button" variant="ghost" size="sm" disabled={esc.trabajando} onClick={() => { esc.limpiar(); setNueva(null); setEdicion({ k, form: formDeCoberturaPlan(f), intento: false }); }}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button type="button" variant="ghost" size="sm" disabled={esc.trabajando} onClick={() => setBaja(f)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Dar de baja
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {edicion && !soloLectura && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
            <p className="font-semibold text-slate-800">
              Editar {nombre(edicion.form.ccobertura)} · tarifa {edicion.form.ctarifa}
            </p>
            <CamposPrecio idBase="cob-ed" form={edicion.form} errores={erroresEd} onChange={(form) => setEdicion({ ...edicion, form })} />
            <div className="flex flex-wrap items-end gap-3">
              <CampoMotivo id="cob-ed-motivo" valor={motivo} onChange={setMotivo} />
              <Button type="button" size="sm" onClick={guardarEdicion} disabled={esc.trabajando}>
                Guardar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEdicion(null)} disabled={esc.trabajando}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {!soloLectura &&
          (nueva ? (
            <div className="space-y-3 rounded-xl border border-dashed border-slate-200 p-3">
              <p className="font-semibold text-slate-800">Agregar cobertura al plan</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectorCoberturaTarifa
                  idBase="cob-nueva"
                  cramo={cramo}
                  catalogo={catalogo}
                  excluidas={enPlan}
                  ccobertura={nueva.form.ccobertura}
                  ctarifa={nueva.form.ctarifa}
                  errores={erroresNueva}
                  onChange={(v) => setNueva({ ...nueva, form: { ...nueva.form, ...v } })}
                />
              </div>
              <CamposPrecio idBase="cob-nueva" form={nueva.form} errores={erroresNueva} onChange={(form) => setNueva({ ...nueva, form })} />
              <label className="inline-flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={nueva.form.bobligatoria} onChange={(e) => setNueva({ ...nueva, form: { ...nueva.form, bobligatoria: e.target.checked } })} />
                Obligatoria (el asegurado no puede quitarla)
                <InfoTip text="Sis2000 toma la obligatoriedad de la tarifa del ramo (matarifa): esta marca no se graba en el plan; si no coincide, Sis2000 lo avisa." />
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <CampoMotivo id="cob-nueva-motivo" valor={motivo} onChange={setMotivo} />
                <Button type="button" size="sm" onClick={agregar} disabled={esc.trabajando}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar cobertura
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setNueva(null)} disabled={esc.trabajando}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => { esc.limpiar(); setEdicion(null); setNueva({ form: FORM_NUEVA(), intento: false }); }}>
              <Plus className="h-3.5 w-3.5" />
              Agregar cobertura
            </Button>
          ))}

        {baja && (
          <ConfirmarDialog
            titulo="Dar de baja la cobertura"
            confirmar="Dar de baja"
            cancelar="No, volver"
            ocupado={esc.trabajando}
            onConfirmar={confirmarBaja}
            onCancelar={() => setBaja(null)}
          >
            <p>
              La cobertura <strong>{nombre(baja.ccobertura)}</strong> queda inactiva en el plan (no se borra) y deja de ofrecerse al emitir.
            </p>
            {familia === 'auto' && (
              <Alert variant="warning">
                En automóvil, la cotización de Sis2000 todavía no respeta la baja de una cobertura del plan hasta que se corrija su SP: revisa la cotización después.
              </Alert>
            )}
            {esUltimaObligatoria(filas, baja.ccobertura) && (
              <Alert variant="warning">
                Es la última cobertura obligatoria del plan: Sis2000 no permitirá darla de baja. Marca otra cobertura como obligatoria primero.
              </Alert>
            )}
            <CampoMotivo id="cob-baja-motivo" valor={motivo} onChange={setMotivo} />
          </ConfirmarDialog>
        )}
        <DialogoConfirmarEscritura esc={esc} />
      </div>
    </SectionPanel>
  );
}

function CamposPrecio({
  idBase,
  form,
  errores,
  onChange,
}: {
  idBase: string;
  form: CoberturaPlanForm;
  errores: Partial<Record<keyof CoberturaPlanForm, string>>;
  onChange: (f: CoberturaPlanForm) => void;
}) {
  const campo = (k: 'msumamin' | 'msumamax' | 'valor', etiqueta: string, ayuda: string) => (
    <div>
      <Label htmlFor={`${idBase}-${k}`} className="inline-flex items-center gap-1">
        {etiqueta}
        <InfoTip text={ayuda} />
      </Label>
      <Input
        id={`${idBase}-${k}`}
        inputMode="decimal"
        value={form[k]}
        aria-invalid={Boolean(errores[k])}
        className={cn(errores[k] && 'border-red-300')}
        onChange={(e) => onChange({ ...form, [k]: e.target.value })}
      />
      {errores[k] && <p className="mt-0.5 text-[11px] text-red-700">{errores[k]}</p>}
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {campo('msumamin', 'Suma asegurada mínima', 'msumamin de la tarifa del plan (maplantar).')}
      {campo('msumamax', 'Suma asegurada máxima', 'msumamax de la tarifa del plan (maplantar).')}
      <div>
        <Label htmlFor={`${idBase}-modo`} className="inline-flex items-center gap-1">
          Cómo se cobra
          <InfoTip text="Prima fija (mprima) o tasa % sobre la suma (pprima). Son excluyentes: al guardar una, la otra queda vacía." />
        </Label>
        <select id={`${idBase}-modo`} className={selectClase} value={form.modo} onChange={(e) => onChange({ ...form, modo: e.target.value === 'tasa' ? 'tasa' : 'prima' })}>
          <option value="prima">Prima fija</option>
          <option value="tasa">Tasa %</option>
        </select>
      </div>
      {campo('valor', form.modo === 'tasa' ? 'Tasa %' : 'Prima', form.modo === 'tasa' ? 'Porcentaje sobre la suma asegurada, de 0 a 100 (pprima).' : 'Monto fijo de la prima (mprima).')}
    </div>
  );
}

// ── Personas ──────────────────────────────────────────────────────────────────

function CoberturasPersonas({ planId, cramo, plan, catalogo, soloLectura, onCambio, nombre }: PropsInternas) {
  const esc = useEscritura();
  const [filas, setFilas] = useState<CoberturaPersonas[]>([]);
  const [parentescos, setParentescos] = useState<Array<{ cparen: number; xparentesco: string }>>([]);
  const [motivo, setMotivo] = useState('');
  /** Edición o alta: k = clave de la cobertura editada; null = cobertura nueva. */
  const [edicion, setEdicion] = useState<{ k: string | null; ccobertura: string; ctarifa: string; filas: FilaTexto[]; intento: boolean } | null>(null);
  const [baja, setBaja] = useState<CoberturaPersonas | null>(null);
  const [buscador, setBuscador] = useState(false);

  useEffect(() => setFilas(coberturasPersonasDe(plan)), [plan]);
  useEffect(() => {
    api.listSis2000Parentescos().then(setParentescos).catch(() => setParentescos([]));
  }, []);

  const nombreParen = useMemo(() => new Map(parentescos.map((p) => [String(p.cparen), texto(p.xparentesco)])), [parentescos]);
  const enPlan = useMemo(() => new Set(filas.filter((f) => f.iestado === 'V').map((f) => f.ccobertura.toUpperCase())), [filas]);

  const columnas: ColumnaEditable[] = [
    {
      clave: 'cparen',
      titulo: 'Parentesco',
      tipo: 'select',
      ayuda: 'Quién se asegura con esta tasa (cparen de maparent).',
      opciones: [{ valor: '', etiqueta: 'Elige…' }, ...parentescos.map((p) => ({ valor: String(p.cparen), etiqueta: `${p.cparen} · ${p.xparentesco}` }))],
    },
    { clave: 'ctablatar', titulo: 'Tabla de tasas por edad', placeholder: 'Código de la tabla', ayuda: 'Código de la tabla de tasas por edad (ctablatar, mapltabedad).' },
  ];

  const form = edicion ? { ccobertura: edicion.ccobertura, ctarifa: edicion.ctarifa, parentescos: edicion.filas.map((f) => ({ cparen: f.cparen ?? '', ctablatar: f.ctablatar ?? '' })) } : null;
  const validacion = form && edicion?.intento ? validarCoberturaPersonas(form, edicion.k === null) : { campos: {}, filas: [] };

  function guardar() {
    if (!edicion || !form) return;
    setEdicion({ ...edicion, intento: true });
    const v = validarCoberturaPersonas(form, edicion.k === null);
    if (Object.keys(v.campos).length || v.filas.some((f) => Object.keys(f).length)) return;
    const nueva = edicion.k === null;
    const cuerpo = cuerpoCoberturaPersonas(form, nueva);
    const extra = (confirmar: boolean) => ({ motivoCambio: motivo || undefined, ...(confirmar ? { confirmar: true } : {}) });
    void esc.ejecutar(
      (confirmar) =>
        nueva
          ? api.agregarSis2000CoberturaPersonas(planId, { ...cuerpo, ...extra(confirmar) })
          : api.editarSis2000CoberturaPersonas(planId, form.ccobertura, form.ctarifa, { ...cuerpo, ...extra(confirmar) }),
      {
        ok: nueva ? `Cobertura ${nombre(form.ccobertura)} agregada al plan.` : `Parentescos de ${nombre(form.ccobertura)} guardados.`,
        titulo: nueva ? 'No se pudo agregar la cobertura' : 'No se pudieron guardar los parentescos',
        duplicado: 'Esa cobertura ya está en el plan con esa tarifa. Edítala en la lista.',
        alTerminar: () => {
          const actual: CoberturaPersonas = { ccobertura: form.ccobertura, ctarifa: form.ctarifa, iestado: 'V', parentescos: form.parentescos };
          setFilas((fs) => (nueva ? [...fs, actual] : fs.map((f) => (clave(f.ccobertura, f.ctarifa) === edicion.k ? actual : f))));
          setEdicion(null);
          setMotivo('');
          onCambio?.();
        },
      },
    );
  }

  function confirmarBaja() {
    if (!baja) return;
    const b = baja;
    void esc
      .ejecutar(
        (confirmar) =>
          api.bajaSis2000CoberturaPersonas(planId, b.ccobertura, { ctarifa: b.ctarifa, motivoCambio: motivo || undefined, ...(confirmar ? { confirmar: true } : {}) }),
        {
          ok: `Cobertura ${nombre(b.ccobertura)} dada de baja: se borraron sus tarifas por parentesco (la copia queda en el historial).`,
          titulo: 'No se pudo dar de baja la cobertura',
          duplicado: 'Sis2000 no deja dar de baja la última cobertura obligatoria del plan.',
          alTerminar: () => {
            setFilas((fs) => fs.map((f) => (clave(f.ccobertura, f.ctarifa) === clave(b.ccobertura, b.ctarifa) ? { ...f, iestado: 'I' } : f)));
            setMotivo('');
            onCambio?.();
          },
        },
      )
      .finally(() => setBaja(null));
  }

  const abrir = (c?: CoberturaPersonas) => {
    esc.limpiar();
    setEdicion(
      c
        ? { k: clave(c.ccobertura, c.ctarifa), ccobertura: c.ccobertura, ctarifa: c.ctarifa, filas: c.parentescos.map((p) => ({ ...p })), intento: false }
        : { k: null, ccobertura: '', ctarifa: '', filas: [{ cparen: '1', ctablatar: '' }], intento: false },
    );
  };

  return (
    <SectionPanel
      title="Coberturas del plan"
      description="Qué cubre el plan y, para cada parentesco (titular, cónyuge, hijos…), la tabla de tasas por edad que se usa para cobrar."
      icon={ShieldCheck}
    >
      <div className="space-y-4 text-xs">
        <EstadoEscritura esc={esc} />
        {filas.length === 0 && <p className="text-slate-500">El plan todavía no tiene coberturas.</p>}
        <ul className="space-y-2">
          {filas.map((c) => (
            <li key={clave(c.ccobertura, c.ctarifa)} className={cn('rounded-xl border border-slate-200 p-3', c.iestado !== 'V' && 'opacity-60')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">
                  {nombre(c.ccobertura)} <span className="font-mono font-normal text-slate-500">({c.ccobertura} · tarifa {c.ctarifa})</span>
                  {c.iestado !== 'V' && <span className="ml-1 font-normal text-slate-500">(de baja)</span>}
                </p>
                {!soloLectura && c.iestado === 'V' && (
                  <span className="inline-flex gap-1">
                    <Button type="button" variant="ghost" size="sm" disabled={esc.trabajando} onClick={() => abrir(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar parentescos
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={esc.trabajando} onClick={() => setBaja(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Dar de baja
                    </Button>
                  </span>
                )}
              </div>
              {c.parentescos.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {c.parentescos.map((p) => (
                    <li key={p.cparen} className="rounded-full bg-slate-100 px-3 py-1">
                      {nombreParen.get(p.cparen) || `Parentesco ${p.cparen}`}: tabla <span className="font-mono">{p.ctablatar || '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-amber-800">Sin parentescos: nadie podrá cotizar esta cobertura.</p>
              )}
            </li>
          ))}
        </ul>

        {edicion && !soloLectura && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
            <p className="font-semibold text-slate-800">{edicion.k === null ? 'Agregar cobertura al plan' : `Parentescos de ${nombre(edicion.ccobertura)}`}</p>
            {edicion.k === null && (
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectorCoberturaTarifa
                  idBase="cobp-nueva"
                  cramo={cramo}
                  catalogo={catalogo}
                  excluidas={enPlan}
                  ccobertura={edicion.ccobertura}
                  ctarifa={edicion.ctarifa}
                  errores={validacion.campos}
                  onChange={(v) => setEdicion({ ...edicion, ...v })}
                />
              </div>
            )}
            <TablaEditable
              idBase="cobp-paren"
              columnas={columnas}
              filas={edicion.filas}
              onChange={(f) => setEdicion({ ...edicion, filas: f })}
              errores={validacion.filas}
              filaNueva={() => ({ cparen: '', ctablatar: '' })}
              textoAgregar="Agregar parentesco"
            />
            {(validacion.campos as { parentescos?: string }).parentescos && <p className="text-[11px] text-red-700">{(validacion.campos as { parentescos?: string }).parentescos}</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => setBuscador(true)}>
              <Search className="h-3.5 w-3.5" />
              Buscar una tabla de tasas existente
            </Button>
            <div className="flex flex-wrap items-end gap-3">
              <CampoMotivo id="cobp-motivo" valor={motivo} onChange={setMotivo} />
              <Button type="button" size="sm" onClick={guardar} disabled={esc.trabajando}>
                Guardar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEdicion(null)} disabled={esc.trabajando}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {!soloLectura && !edicion && (
          <Button type="button" variant="outline" size="sm" onClick={() => abrir()}>
            <Plus className="h-3.5 w-3.5" />
            Agregar cobertura
          </Button>
        )}

        {buscador && edicion && (
          <TablaEdadBuscador
            destino={edicion.ccobertura ? `Cobertura ${edicion.ccobertura} · ${nombre(edicion.ccobertura)}` : 'Cobertura nueva'}
            permitirTodas
            onElegir={(codigo, enTodas) => {
              // Llena las filas sin tabla (o todas si eligió «usar en todas»).
              const filasNuevas = edicion.filas.map((f) => (enTodas || !texto(f.ctablatar) ? { ...f, ctablatar: codigo } : f));
              setEdicion({ ...edicion, filas: filasNuevas.length ? filasNuevas : [{ cparen: '', ctablatar: codigo }] });
              setBuscador(false);
            }}
            onCrearNueva={() => {
              setBuscador(false);
              esc.setError(null);
              esc.setOk(null);
            }}
            onClose={() => setBuscador(false)}
          />
        )}

        {baja && (
          <ConfirmarDialog
            titulo="Dar de baja la cobertura"
            confirmar="Dar de baja"
            cancelar="No, volver"
            ocupado={esc.trabajando}
            onConfirmar={confirmarBaja}
            onCancelar={() => setBaja(null)}
          >
            <p>
              La cobertura <strong>{nombre(baja.ccobertura)}</strong> queda inactiva y <strong>sus tarifas por parentesco se borran de Sis2000</strong> (esa tabla no tiene estado). Antes de borrar se guarda una copia en el historial del configurador.
            </p>
            <CampoMotivo id="cobp-baja-motivo" valor={motivo} onChange={setMotivo} />
          </ConfirmarDialog>
        )}
        <DialogoConfirmarEscritura esc={esc} />
      </div>
    </SectionPanel>
  );
}
