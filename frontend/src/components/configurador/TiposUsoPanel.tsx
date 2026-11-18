import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Car, Pencil, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { advertenciasPorConfirmar } from '@/lib/configurador';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { ConfirmarDialog } from '@/components/sis2000/AsistentePasos';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';

type Fila = Record<string, unknown>;
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

/** Campos de macattip que se editan, con su nombre en pantalla. Los porcentajes van de 0 a 100; los montos ≥ 0. */
const CAMPOS: Array<{ clave: string; titulo: string; ayuda: string; pct?: boolean; entero?: boolean; grupo: 'principal' | 'mas' }> = [
  { clave: 'mprimbas', titulo: 'Prima base RCV (Bs)', ayuda: 'Prima base de RCV (daños a cosas) para vehículos de placa nacional con este tipo y uso. Se usa cuando el plan no fija una prima propia para esa cobertura. Afecta a todos los planes del ramo.\nEn Sis2000: macattip.mprimbas', grupo: 'principal' },
  { clave: 'mprimext', titulo: 'Prima base RCV (divisa)', ayuda: 'Igual que la prima base, pero para vehículos de placa extranjera. Afecta a todos los planes del ramo.\nEn Sis2000: macattip.mprimext', grupo: 'principal' },
  { clave: 'msumacosas', titulo: 'Suma daños a cosas (Bs)', ayuda: 'Suma asegurada de RCV por daños a cosas para placa nacional. La cotización la toma de aquí, no del plan.\nEn Sis2000: macattip.msumacosas', grupo: 'principal' },
  { clave: 'msumapers', titulo: 'Suma daños a personas (Bs)', ayuda: 'Suma asegurada de RCV por daños a personas para placa nacional. La cotización la toma de aquí, no del plan.\nEn Sis2000: macattip.msumapers', grupo: 'principal' },
  { clave: 'msumacosasext', titulo: 'Suma daños a cosas (divisa)', ayuda: 'Suma de RCV por daños a cosas para vehículos de placa extranjera.\nEn Sis2000: macattip.msumacosasext', grupo: 'principal' },
  { clave: 'msumapersext', titulo: 'Suma daños a personas (divisa)', ayuda: 'Suma de RCV por daños a personas para vehículos de placa extranjera.\nEn Sis2000: macattip.msumapersext', grupo: 'principal' },
  { clave: 'ptasaexc', titulo: 'Tasa de exceso %', ayuda: 'Tasa % para el exceso de límite de RCV, entre 0 y 100. Se aplica sobre la suma máxima de esa cobertura cuando el plan no le fija prima ni tasa. Ejemplo: 1 = 1 % de la suma.\nEn Sis2000: macattip.ptasaexc', pct: true, grupo: 'principal' },
  { clave: 'pdescuento', titulo: 'Descuento %', ayuda: 'Descuento %, entre 0 y 100. La cotización de Nexus no lo usa hoy.\nEn Sis2000: macattip.pdescuento', pct: true, grupo: 'mas' },
  { clave: 'precarofic', titulo: 'Recargo «ofic» %', ayuda: 'Recargo %, entre 0 y 100. La cotización y la emisión de Nexus no lo usan hoy.\nEn Sis2000: macattip.precarofic', pct: true, grupo: 'mas' },
  { clave: 'precarinfl', titulo: 'Recargo «infl» %', ayuda: 'Recargo %, entre 0 y 100. La cotización y la emisión de Nexus no lo usan hoy.\nEn Sis2000: macattip.precarinfl', pct: true, grupo: 'mas' },
  { clave: 'precarremo', titulo: 'Recargo «remo» %', ayuda: 'Recargo %, entre 0 y 100. La cotización y la emisión de Nexus no lo usan hoy.\nEn Sis2000: macattip.precarremo', pct: true, grupo: 'mas' },
  { clave: 'mtoneladas', titulo: 'Monto por tonelada', ayuda: 'Monto por tonelada. La cotización de Nexus no lo usa: el recargo por tonelada de carga está fijo en el cálculo.\nEn Sis2000: macattip.mtoneladas', grupo: 'mas' },
  { clave: 'mpuestos', titulo: 'Monto por puesto', ayuda: 'Monto por puesto. La cotización de Nexus no lo usa hoy.\nEn Sis2000: macattip.mpuestos', grupo: 'mas' },
  { clave: 'qmaxptos', titulo: 'Puestos máximos', ayuda: 'Puestos máximos, número entero. La cotización de Nexus no lo usa hoy.\nEn Sis2000: macattip.qmaxptos', entero: true, grupo: 'mas' },
  { clave: 'qmaxton', titulo: 'Toneladas máximas', ayuda: 'Toneladas máximas, número entero. La cotización de Nexus no lo usa hoy.\nEn Sis2000: macattip.qmaxton', entero: true, grupo: 'mas' },
];

type Edicion = { ctipo: string; ccategotr: string; nuevo: boolean; valores: Record<string, string> };

function validar(e: Edicion): Record<string, string> {
  const out: Record<string, string> = {};
  if (!e.ctipo) out.ctipo = 'Elige el tipo de vehículo.';
  if (!e.ccategotr) out.ccategotr = 'Elige el uso.';
  for (const c of CAMPOS) {
    const v = (e.valores[c.clave] ?? '').trim().replace(',', '.');
    if (!v) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) out[c.clave] = 'Debe ser un número de 0 o más.';
    else if (c.pct && n > 100) out[c.clave] = 'Es un porcentaje: entre 0 y 100.';
    else if (c.entero && !Number.isInteger(n)) out[c.clave] = 'Debe ser un número entero.';
  }
  return out;
}

/**
 * Tipo y uso del vehículo (auto). Los valores son del RAMO: un cambio afecta a todos los planes del ramo, por eso el
 * aviso está siempre visible con la lista de planes afectados. Si nest-api devuelve advertencias (el mismo par existe en
 * otro ramo y el SP los une sin ramo), se muestran y solo se graba si el usuario confirma.
 */
export function TiposUsoPanel({ cramo, onCambio }: { cramo: number; onCambio?: () => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [planes, setPlanes] = useState<string[]>([]);
  const [tipos, setTipos] = useState<Fila[]>([]);
  const [usos, setUsos] = useState<Fila[]>([]);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [porConfirmar, setPorConfirmar] = useState<string[] | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .leerSis2000TiposUso(cramo)
      .then((r) => {
        setFilas(r.filas ?? []);
        setPlanes(r.planesAfectados ?? []);
      })
      .catch((e) => {
        setFilas([]);
        setError(entenderError(e, { titulo: 'No se pudieron leer los tipos y usos del ramo' }));
      });
  }, [cramo]);

  useEffect(() => {
    cargar();
    api.listarSis2000AutoTipos(cramo).then(setTipos).catch(() => setTipos([]));
    api.listarSis2000AutoUsos(cramo).then(setUsos).catch(() => setUsos([]));
  }, [cargar, cramo]);

  const nombreTipo = useMemo(() => new Map(tipos.map((t) => [txt(t.ctipo), txt(t.xtipo)])), [tipos]);
  const nombreUso = useMemo(() => new Map(usos.map((u) => [txt(u.ccategotr), txt(u.xcategoria)])), [usos]);
  const usosDelTipo = (ctipo: string) => usos.filter((u) => !txt(u.ctipo) || txt(u.ctipo) === ctipo);

  const errores = edicion && intento ? validar(edicion) : {};

  function abrir(f?: Fila) {
    setOk(null);
    setIntento(false);
    setEdicion(
      f
        ? {
            ctipo: txt(f.ctipo),
            ccategotr: txt(f.ccategotr),
            nuevo: false,
            valores: Object.fromEntries([...CAMPOS.map((c) => [c.clave, txt(f[c.clave])]), ['ccober', txt(f.ccober)], ['ctarifa', txt(f.ctarifa)]]),
          }
        : { ctipo: '', ccategotr: '', nuevo: true, valores: {} },
    );
  }

  async function guardar(confirmar: boolean) {
    if (!edicion) return;
    setIntento(true);
    if (Object.keys(validar(edicion)).length) return;
    const cuerpo: Record<string, unknown> = { motivoCambio: motivo || undefined };
    for (const c of CAMPOS) {
      const v = (edicion.valores[c.clave] ?? '').trim().replace(',', '.');
      if (v) cuerpo[c.clave] = Number(v);
    }
    if (edicion.valores.ccober?.trim()) cuerpo.ccober = edicion.valores.ccober.trim();
    if (edicion.valores.ctarifa?.trim()) cuerpo.ctarifa = edicion.valores.ctarifa.trim();
    if (confirmar) cuerpo.confirmar = true;
    setGuardando(true);
    setError(null);
    try {
      const r = await api.guardarSis2000TipoUso(cramo, edicion.ctipo, edicion.ccategotr, cuerpo);
      const adv = advertenciasPorConfirmar(r, confirmar);
      if (adv.length) {
        setPorConfirmar(adv);
        return;
      }
      setPorConfirmar(null);
      const afectados = Array.isArray(r.planesAfectados) ? r.planesAfectados.length : planes.length;
      setOk(
        `Tipo ${nombreTipo.get(edicion.ctipo) || edicion.ctipo} / uso ${nombreUso.get(edicion.ccategotr) || edicion.ccategotr} ${r.accion === 'insertado' ? 'agregado' : 'guardado'}. Aplica a ${afectados || 'todos los'} plan(es) del ramo.`,
      );
      setEdicion(null);
      setMotivo('');
      cargar();
      onCambio?.();
    } catch (e) {
      const adv = advertenciasPorConfirmar(e, confirmar);
      if (adv.length) setPorConfirmar(adv);
      else
        setError(
          entenderError(e, {
            titulo: 'No se pudo guardar el tipo y uso',
            duplicado: 'Ese tipo y uso está repetido en el ramo (hay más de una fila igual en Sis2000). Pide a Técnica que deje una sola antes de editarlo.',
          }),
        );
    } finally {
      setGuardando(false);
    }
  }

  const campoNumero = (c: (typeof CAMPOS)[number]) =>
    edicion && (
      <div key={c.clave}>
        <Label htmlFor={`tu-${c.clave}`} className="inline-flex items-center gap-1">
          {c.titulo}
          <InfoTip text={c.ayuda} />
        </Label>
        <Input
          id={`tu-${c.clave}`}
          inputMode="decimal"
          value={edicion.valores[c.clave] ?? ''}
          aria-invalid={Boolean(errores[c.clave])}
          className={cn(errores[c.clave] && 'border-red-300')}
          onChange={(e) => setEdicion({ ...edicion, valores: { ...edicion.valores, [c.clave]: e.target.value } })}
        />
        {errores[c.clave] && <p className="mt-0.5 text-[11px] text-red-700">{errores[c.clave]}</p>}
      </div>
    );

  return (
    <SectionPanel
      title="Tipo y uso del vehículo"
      description="Prima base de RCV y sumas aseguradas según el tipo de vehículo y su uso. Ojo: esta tabla es del ramo y afecta a TODOS sus planes. Si el tipo y uso del vehículo no está aquí, no se puede cotizar ni emitir."
      icon={Car}
    >
      <div className="space-y-4 text-xs">
        <div role="note" className="alert-banner border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Estos valores son del ramo: afectan a todos sus planes.</p>
            <p className="mt-1">
              {planes.length
                ? `Planes vigentes del ramo ${cramo} que cambian si guardas aquí (${planes.length}): ${planes.join(', ')}.`
                : `Cualquier cambio aplica a todos los planes del ramo ${cramo}.`}
            </p>
          </div>
        </div>

        <AlertaError error={error} onReintentar={cargar} />
        {ok && <Alert variant="success">{ok}</Alert>}

        {filas === null ? (
          <p className="text-slate-500">Leyendo tipos y usos…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Uso</th>
                  <th className="px-3 py-2 text-right">Prima base</th>
                  <th className="px-3 py-2 text-right">Suma cosas</th>
                  <th className="px-3 py-2 text-right">Suma personas</th>
                  <th className="px-3 py-2 text-right">Tasa exceso</th>
                  <th className="px-3 py-2">También en</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                      El ramo no tiene tipos y usos cargados: agrega al menos uno.
                    </td>
                  </tr>
                )}
                {filas.map((f) => {
                  const m = (k: string) => (f[k] == null || f[k] === '' ? '—' : Number(f[k]).toLocaleString('es-VE'));
                  return (
                    <tr key={`${txt(f.ctipo)}-${txt(f.ccategotr)}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2">{txt(f.xtipo) || nombreTipo.get(txt(f.ctipo)) || txt(f.ctipo)}</td>
                      <td className="px-3 py-2">{txt(f.xcategoria) || nombreUso.get(txt(f.ccategotr)) || txt(f.ccategotr)}</td>
                      <td className="px-3 py-2 text-right">{m('mprimbas')}</td>
                      <td className="px-3 py-2 text-right">{m('msumacosas')}</td>
                      <td className="px-3 py-2 text-right">{m('msumapers')}</td>
                      <td className="px-3 py-2 text-right">{f.ptasaexc == null ? '—' : `${m('ptasaexc')} %`}</td>
                      <td className="px-3 py-2">
                        {Array.isArray(f.otrosRamos) && f.otrosRamos.length ? (
                          <span
                            className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900"
                            title="Este tipo y uso también existe en otro ramo: la cotización lo busca sin mirar el ramo y puede tomar la fila del otro."
                          >
                            Ramo{' '}
                            {(f.otrosRamos as unknown[])
                              .map((o) => (o && typeof o === 'object' ? txt((o as Fila).cramo) : txt(o)))
                              .join(', ')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => abrir(f)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!edicion && (
          <Button type="button" variant="outline" size="sm" onClick={() => abrir()}>
            <Plus className="h-3.5 w-3.5" />
            Agregar tipo y uso
          </Button>
        )}

        {edicion && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/30 p-3">
            <p className="font-semibold text-slate-800">{edicion.nuevo ? 'Nuevo tipo y uso' : 'Editar tipo y uso'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="tu-ctipo">Tipo de vehículo</Label>
                <select
                  id="tu-ctipo"
                  className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={edicion.ctipo}
                  disabled={!edicion.nuevo}
                  onChange={(e) => setEdicion({ ...edicion, ctipo: e.target.value, ccategotr: '' })}
                >
                  <option value="">Elige…</option>
                  {tipos.map((t) => (
                    <option key={txt(t.ctipo)} value={txt(t.ctipo)}>
                      {txt(t.ctipo)} · {txt(t.xtipo)}
                    </option>
                  ))}
                  {!edicion.nuevo && !tipos.some((t) => txt(t.ctipo) === edicion.ctipo) && <option value={edicion.ctipo}>{edicion.ctipo}</option>}
                </select>
                {errores.ctipo && <p className="mt-0.5 text-[11px] text-red-700">{errores.ctipo}</p>}
              </div>
              <div>
                <Label htmlFor="tu-ccategotr">Uso</Label>
                <select
                  id="tu-ccategotr"
                  className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={edicion.ccategotr}
                  disabled={!edicion.nuevo || !edicion.ctipo}
                  onChange={(e) => setEdicion({ ...edicion, ccategotr: e.target.value })}
                >
                  <option value="">Elige…</option>
                  {usosDelTipo(edicion.ctipo).map((u) => (
                    <option key={`${txt(u.ctipo)}-${txt(u.ccategotr)}`} value={txt(u.ccategotr)}>
                      {txt(u.ccategotr)} · {txt(u.xcategoria)}
                    </option>
                  ))}
                  {!edicion.nuevo && !usos.some((u) => txt(u.ccategotr) === edicion.ccategotr) && (
                    <option value={edicion.ccategotr}>{edicion.ccategotr}</option>
                  )}
                </select>
                {errores.ccategotr && <p className="mt-0.5 text-[11px] text-red-700">{errores.ccategotr}</p>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">{CAMPOS.filter((c) => c.grupo === 'principal').map(campoNumero)}</div>
            <details className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer font-semibold text-slate-700">Más datos (poco usados)</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {CAMPOS.filter((c) => c.grupo === 'mas').map(campoNumero)}
                {(['ccober', 'ctarifa'] as const).map((k) => (
                  <div key={k}>
                    <Label htmlFor={`tu-${k}`} className="inline-flex items-center gap-1">
                      {k === 'ccober' ? 'Cobertura' : 'Tarifa'}
                      <InfoTip text={`Opcional. ${k === 'ccober' ? 'Cobertura' : 'Tarifa'} asociada a este tipo y uso; la cotización de Nexus no la usa hoy.\nEn Sis2000: macattip.${k}`} />
                    </Label>
                    <Input
                      id={`tu-${k}`}
                      value={edicion.valores[k] ?? ''}
                      onChange={(e) => setEdicion({ ...edicion, valores: { ...edicion.valores, [k]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </details>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <Label htmlFor="tu-motivo">Motivo (opcional, queda en el historial)</Label>
                <Input id="tu-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setEdicion(null)} disabled={guardando}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={() => void guardar(false)} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar para todo el ramo'}
              </Button>
            </div>
          </div>
        )}

        {porConfirmar && (
          <ConfirmarDialog
            titulo="Revisa antes de guardar"
            confirmar="Guardar de todas formas"
            cancelar="No guardar"
            ocupado={guardando}
            onConfirmar={() => void guardar(true)}
            onCancelar={() => setPorConfirmar(null)}
          >
            <p>Sis2000 avisa lo siguiente. Si guardas, el cambio aplica a todos los planes del ramo {cramo}:</p>
            <ul className="list-disc space-y-1 pl-5">
              {porConfirmar.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </ConfirmarDialog>
        )}
      </div>
    </SectionPanel>
  );
}
