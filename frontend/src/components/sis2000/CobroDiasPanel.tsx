import { useEffect, useMemo, useState } from 'react';
import { Calculator, CalendarDays, Save } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  claveCober,
  cobroDiasAForm,
  cobroDiasFormAPayload,
  COBRO_DIAS_FORM_DEFAULT,
  diasEntre,
  totalDiario,
  validarCobroDias,
  type CobroDiasConfig,
  type CobroDiasCotizacion,
  type CobroDiasForm,
} from '@/lib/sis2000-cobro-dias';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoTip } from '@/components/ui/info-tip';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';

interface Props {
  /** "cramo-cplan" del plan ya guardado; null = todavía no existe. */
  planId: string | null;
  /** Coberturas del plan (código y nombre si se conoce). */
  coberturas: Array<{ ccobertura: string; nombre?: string }>;
  /** Moneda del plan, por defecto al activar. */
  cmonedaDefault?: string;
  className?: string;
}

const OPCION =
  'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium';

/** Fecha local YYYY-MM-DD (toISOString es UTC). */
function fechaLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
}

const monto = (n: unknown) =>
  Number(n ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function mensajeError(e: unknown, accion: string): string {
  if (e instanceof ApiError && e.status === 403) {
    return `No se pudo ${accion}: ${e.message || 'la escritura del cobro por días no está habilitada en nest-api.'}`;
  }
  return e instanceof Error ? e.message : `No se pudo ${accion}.`;
}

/**
 * Tipo de emisión del plan: «Estándar (por frecuencia)» o «Cobro por días» (prima diaria × días, con calendario al
 * emitir). Aditivo: si no se activa, el plan emite como siempre.
 */
export function CobroDiasPanel({ planId, coberturas, cmonedaDefault = '$', className }: Props) {
  const [habilitado, setHabilitado] = useState<boolean | null>(null);
  const [config, setConfig] = useState<CobroDiasConfig | null>(null);
  const [form, setForm] = useState<CobroDiasForm>(COBRO_DIAS_FORM_DEFAULT(cmonedaDefault));
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [monedas, setMonedas] = useState<Array<{ codigo: string; nombre: string }>>([]);

  // Simulación
  const [modoSim, setModoSim] = useState<'fechas' | 'dias'>('fechas');
  const [fdesde, setFdesde] = useState(fechaLocal());
  const [fhasta, setFhasta] = useState(sumarDias(fechaLocal(), 6));
  const [diasSim, setDiasSim] = useState('7');
  const [simulando, setSimulando] = useState(false);
  const [errorSim, setErrorSim] = useState<string | null>(null);
  const [simulacion, setSimulacion] = useState<CobroDiasCotizacion | null>(null);

  useEffect(() => {
    api
      .getSis2000Funciones()
      .then((f) => setHabilitado(f.cobroDias === true))
      .catch(() => setHabilitado(false));
    api
      .listSis2000CatalogMonedas()
      .then((rows) => {
        const vistas = new Set<string>();
        const out: Array<{ codigo: string; nombre: string }> = [];
        for (const m of rows ?? []) {
          const codigo = String(m.cmoneda ?? m.codigo ?? m.cvalor ?? '').trim();
          if (!codigo || vistas.has(codigo)) continue;
          vistas.add(codigo);
          out.push({ codigo, nombre: String(m.xmoneda ?? m.xdescripcion_l ?? m.xdescripcion ?? m.descripcion ?? '').trim() });
        }
        setMonedas(out);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!habilitado || !planId) return;
    setCargando(true);
    setError(null);
    api
      .leerSis2000CobroDias(planId)
      .then((r) => {
        setConfig(r.data ?? null);
        setForm(cobroDiasAForm(r.data ?? null, cmonedaDefault));
        setCambios(false);
      })
      .catch((e) => setError(mensajeError(e, 'leer el tipo de emisión del plan')))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitado, planId]);

  /** Coberturas del plan + las que ya tengan prima guardada (por si el plan cambió). */
  const filas = useMemo(() => {
    const out = new Map<string, string>();
    for (const c of coberturas) {
      const k = claveCober(c.ccobertura);
      if (k && !out.has(k)) out.set(k, String(c.nombre ?? '').trim());
    }
    for (const p of config?.primas ?? []) {
      const k = claveCober(p.ccober);
      if (k && !out.has(k)) out.set(k, '');
    }
    return [...out.entries()].map(([ccobertura, nombre]) => ({ ccobertura, nombre }));
  }, [coberturas, config]);
  const codigos = filas.map((f) => f.ccobertura);
  const total = totalDiario(form, codigos);

  function cambiar(parcial: Partial<CobroDiasForm>) {
    setForm((f) => ({ ...f, ...parcial }));
    setCambios(true);
    setOk(null);
  }

  async function guardar() {
    if (!planId) return;
    const errores = validarCobroDias(form, codigos);
    if (errores.length) {
      setError(errores.join(' '));
      return;
    }
    setGuardando(true);
    setError(null);
    setOk(null);
    try {
      const r = await api.guardarSis2000CobroDias(planId, cobroDiasFormAPayload(form, codigos));
      setConfig(r.data ?? null);
      if (r.data) setForm(cobroDiasAForm(r.data, cmonedaDefault));
      setCambios(false);
      setSimulacion(null);
      setOk(form.activo ? 'Cobro por días guardado.' : 'El plan vuelve a emitirse por frecuencia.');
    } catch (e) {
      setError(mensajeError(e, 'guardar el tipo de emisión'));
    } finally {
      setGuardando(false);
    }
  }

  async function simular() {
    if (!planId) return;
    setErrorSim(null);
    setSimulacion(null);
    let cuerpo: { fdesde: string; fhasta: string } | { dias: number };
    if (modoSim === 'fechas') {
      const d = diasEntre(fdesde, fhasta);
      if (!(d >= 1)) {
        setErrorSim('La fecha hasta debe ser igual o posterior a la fecha desde.');
        return;
      }
      cuerpo = { fdesde, fhasta };
    } else {
      const d = Number(diasSim);
      if (!Number.isInteger(d) || d < 1) {
        setErrorSim('Indica un número de días entero mayor o igual a 1.');
        return;
      }
      cuerpo = { dias: d };
    }
    setSimulando(true);
    try {
      setSimulacion(await api.cotizarSis2000CobroDias(planId, cuerpo));
    } catch (e) {
      setErrorSim(mensajeError(e, 'simular'));
    } finally {
      setSimulando(false);
    }
  }

  const monedaActual = form.cmoneda.trim();
  const opcionesMoneda =
    monedaActual && !monedas.some((m) => m.codigo === monedaActual)
      ? [{ codigo: monedaActual, nombre: '' }, ...monedas]
      : monedas;
  const diasRango = modoSim === 'fechas' ? diasEntre(fdesde, fhasta) : NaN;
  const guardadoActivo = config?.activo === true;
  // Guardar tiene sentido al activar, o al volver a Estándar si había cobro por días guardado.
  const puedeGuardar = Boolean(planId) && (form.activo || config != null) && !guardando && !cargando;

  return (
    <SectionPanel
      title="Tipo de emisión"
      description="Estándar: la prima se cobra según la frecuencia del plan. Cobro por días: prima diaria por cobertura × días; al emitir se eligen las fechas en un calendario."
      icon={CalendarDays}
      className={cn('mt-6', className)}
    >
      <div className="space-y-3 text-xs">
        {habilitado === false && (
          <Alert variant="info">
            El cobro por días está desactivado en este servidor (bandera SIS2000_PLAN_COBRO_DIAS del builder). Los planes
            se emiten de forma estándar, por frecuencia.
          </Alert>
        )}
        {habilitado && !planId && (
          <Alert variant="info">Guarda primero el plan para elegir su tipo de emisión.</Alert>
        )}
        {error && <Alert variant="error">{error}</Alert>}
        {ok && <Alert variant="success">{ok}</Alert>}

        <fieldset
          disabled={!habilitado || !planId || cargando}
          className="flex flex-wrap gap-2 disabled:opacity-60"
        >
          <legend className="sr-only">Tipo de emisión</legend>
          <label className={OPCION}>
            <input
              type="radio"
              name="tipo-emision"
              className="h-4 w-4 accent-primary"
              checked={!form.activo}
              onChange={() => cambiar({ activo: false })}
            />
            Estándar (por frecuencia)
          </label>
          <label className={OPCION}>
            <input
              type="radio"
              name="tipo-emision"
              className="h-4 w-4 accent-primary"
              checked={form.activo}
              onChange={() => cambiar({ activo: true })}
            />
            Cobro por días
          </label>
          {cargando && <span className="self-center text-muted-foreground">Cargando…</span>}
          {!cargando && guardadoActivo && (
            <span className="self-center rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
              Guardado: cobro por días
            </span>
          )}
        </fieldset>

        {habilitado && planId && form.activo && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="cd-min">Días mínimos</Label>
                  <InfoTip text="Menor cantidad de días que se puede emitir (contando el primero y el último)." />
                </div>
                <Input
                  id="cd-min"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form.dias_min}
                  onChange={(e) => cambiar({ dias_min: e.target.value })}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="cd-max">Días máximos</Label>
                  <InfoTip text="Mayor cantidad de días que se puede emitir de una vez." />
                </div>
                <Input
                  id="cd-max"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form.dias_max}
                  onChange={(e) => cambiar({ dias_max: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="cd-moneda">Moneda</Label>
                <select
                  id="cd-moneda"
                  className="h-10 w-full rounded-md border border-border bg-background px-2"
                  value={monedaActual}
                  onChange={(e) => cambiar({ cmoneda: e.target.value })}
                >
                  {!monedaActual && <option value="">Elegir…</option>}
                  {opcionesMoneda.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.nombre ? `${m.codigo} · ${m.nombre}` : m.codigo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filas.length === 0 ? (
              <Alert variant="warning">
                El plan no tiene coberturas. Agrégalas al plan y guárdalo antes de poner la prima diaria.
              </Alert>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">Cobertura</th>
                      <th className="w-40 p-2 text-right">Prima diaria ({monedaActual || '—'})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((c) => (
                      <tr key={c.ccobertura} className="border-t border-border/50">
                        <td className="p-2">
                          <span className="font-mono">{c.ccobertura}</span>
                          {c.nombre && <span className="text-muted-foreground"> · {c.nombre}</span>}
                        </td>
                        <td className="p-2">
                          <Input
                            aria-label={`Prima diaria de ${c.ccobertura}`}
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            className="h-8 text-right"
                            value={form.primas[c.ccobertura] ?? ''}
                            placeholder="0,00"
                            onChange={(e) => cambiar({ primas: { ...form.primas, [c.ccobertura]: e.target.value } })}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-semibold">
                      <td className="p-2">Total por día</td>
                      <td className="p-2 text-right">
                        {monto(total)} {monedaActual}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {habilitado && planId && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={guardar} disabled={!puedeGuardar || !cambios}>
              <Save className="h-3.5 w-3.5" />
              {guardando ? 'Guardando…' : 'Guardar tipo de emisión'}
            </Button>
            {cambios && <span className="text-amber-700">Hay cambios sin guardar.</span>}
          </div>
        )}

        {habilitado && planId && guardadoActivo && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold">Simular</p>
              <InfoTip text="Calcula con lo guardado, sin emitir. Los días cuentan el primero y el último." />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={OPCION}>
                <input
                  type="radio"
                  name="modo-sim"
                  className="h-4 w-4 accent-primary"
                  checked={modoSim === 'fechas'}
                  onChange={() => setModoSim('fechas')}
                />
                Por fechas
              </label>
              <label className={OPCION}>
                <input
                  type="radio"
                  name="modo-sim"
                  className="h-4 w-4 accent-primary"
                  checked={modoSim === 'dias'}
                  onChange={() => setModoSim('dias')}
                />
                Por número de días
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {modoSim === 'fechas' ? (
                <>
                  <div className="min-w-[9.5rem] flex-1 sm:flex-none">
                    <Label htmlFor="sim-desde">Desde</Label>
                    <Input id="sim-desde" type="date" value={fdesde} onChange={(e) => setFdesde(e.target.value)} />
                  </div>
                  <div className="min-w-[9.5rem] flex-1 sm:flex-none">
                    <Label htmlFor="sim-hasta">Hasta</Label>
                    <Input
                      id="sim-hasta"
                      type="date"
                      value={fhasta}
                      min={fdesde || undefined}
                      onChange={(e) => setFhasta(e.target.value)}
                    />
                  </div>
                  {diasRango >= 1 && <span className="pb-2 text-muted-foreground">{diasRango} día(s)</span>}
                </>
              ) : (
                <div className="w-32">
                  <Label htmlFor="sim-dias">Días</Label>
                  <Input
                    id="sim-dias"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={diasSim}
                    onChange={(e) => setDiasSim(e.target.value)}
                  />
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={simular} disabled={simulando}>
                <Calculator className="h-3.5 w-3.5" />
                {simulando ? 'Calculando…' : 'Simular'}
              </Button>
            </div>
            {cambios && <p className="text-amber-700">La simulación usa lo guardado, no los cambios sin guardar.</p>}
            {errorSim && <Alert variant="error">{errorSim}</Alert>}
            {simulacion && (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">Cobertura</th>
                      <th className="p-2 text-right">Prima diaria</th>
                      <th className="p-2 text-right">Prima ({simulacion.dias} días)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(simulacion.coberturas ?? []).map((c) => (
                      <tr key={c.ccober} className="border-t border-border/50">
                        <td className="p-2 font-mono">{String(c.ccober).trim()}</td>
                        <td className="p-2 text-right">{monto(c.prima_diaria)}</td>
                        <td className="p-2 text-right">{monto(c.prima)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-semibold">
                      <td className="p-2">Total ({config?.cmoneda ?? monedaActual})</td>
                      <td className="p-2 text-right">{monto(simulacion.prima_diaria_total)}</td>
                      <td className="p-2 text-right">{monto(simulacion.prima_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionPanel>
  );
}
