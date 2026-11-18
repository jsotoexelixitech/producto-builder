import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import {
  avisoCoberturaEdades,
  cuerpoEdad,
  listaDe,
  normalizarEdad,
  parentescosSinEdad,
  texto,
  validarEdad,
  type EdadParentesco,
} from '@/lib/configurador-fase2';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';
import { CampoMotivo, DialogoConfirmarEscritura, EstadoEscritura, useEscritura } from './EscrituraConfirmada';

type Fila = Record<string, unknown>;
const EDAD_VACIA = (cparen = ''): EdadParentesco => ({
  cparen,
  cemin_ase: '0',
  cemax_ase: '',
  cemin_gi: '',
  cemax_gi: '',
  msvitalicia: '',
  cereduccion: '',
  msreducida: '',
});

/** Parentesco → tablas de tasas por edad que usa en las coberturas del plan (plan.coberturas[].parentescos[]). */
function tablasPorParentesco(plan: Fila | null): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const coberturas = plan && Array.isArray(plan.coberturas) ? (plan.coberturas as Fila[]) : [];
  for (const c of coberturas) {
    const pars = Array.isArray(c.parentescos) ? (c.parentescos as Fila[]) : c.cparen != null ? [c] : [];
    for (const p of pars) {
      const cparen = texto(p.cparen);
      if (!cparen) continue;
      const tabla = texto(p.ctablatar).toUpperCase();
      const lista = out.get(cparen) ?? [];
      if (tabla && !lista.includes(tabla)) lista.push(tabla);
      out.set(cparen, lista);
    }
  }
  return out;
}

const CAMPOS: Array<{ clave: keyof EdadParentesco; titulo: string; ayuda: string; mas?: boolean }> = [
  { clave: 'cemin_ase', titulo: 'Edad mínima', ayuda: 'Edad mínima para entrar al plan con este parentesco. La cotización rechaza a quien tenga menos. Ejemplo: 0 para hijos.\nEn Sis2000: mapledades_per.cemin_ase' },
  { clave: 'cemax_ase', titulo: 'Edad máxima', ayuda: 'Edad máxima para entrar al plan con este parentesco. La cotización rechaza a quien tenga más. Ejemplo: 74 para titular. Las tablas de edad deben cubrir hasta aquí: fuera de tramo la prima queda en 0.\nEn Sis2000: mapledades_per.cemax_ase' },
  { clave: 'cemin_gi', titulo: 'Edad mínima de grupo', ayuda: 'Opcional. Edad mínima de grupo; hoy la cotización y la emisión de Nexus no la usan.\nEn Sis2000: mapledades_per.cemin_gi', mas: true },
  { clave: 'cemax_gi', titulo: 'Edad máxima de grupo', ayuda: 'Opcional. Edad máxima de grupo; hoy la cotización y la emisión de Nexus no la usan.\nEn Sis2000: mapledades_per.cemax_gi', mas: true },
  { clave: 'msvitalicia', titulo: 'Suma vitalicia', ayuda: 'Opcional. Suma vitalicia del parentesco; hoy la cotización y la emisión de Nexus no la usan.\nEn Sis2000: mapledades_per.msvitalicia', mas: true },
  { clave: 'cereduccion', titulo: 'Edad de reducción', ayuda: 'Opcional. Edad desde la que se reduce la suma asegurada; hoy la cotización y la emisión de Nexus no la usan.\nEn Sis2000: mapledades_per.cereduccion', mas: true },
  { clave: 'msreducida', titulo: 'Suma reducida', ayuda: 'Opcional. Suma asegurada reducida desde la edad de reducción; hoy la cotización y la emisión de Nexus no la usan.\nEn Sis2000: mapledades_per.msreducida', mas: true },
];

/**
 * Edades por parentesco del plan de personas (una fila por parentesco en la versión vigente; guardar es upsert).
 * Avisa si un parentesco de las tarifas no tiene fila de edades y si la tabla de tasas por edad no cubre el rango.
 */
export function EdadesParentescoPanel({
  planId,
  plan,
  soloLectura,
  onCambio,
}: {
  planId: string;
  plan: Record<string, unknown> | null;
  soloLectura?: boolean;
  onCambio?: () => void;
}) {
  const esc = useEscritura();
  const [edades, setEdades] = useState<EdadParentesco[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<ErrorEntendible | null>(null);
  const [parentescos, setParentescos] = useState<Array<{ cparen: number; xparentesco: string }>>([]);
  const [tramos, setTramos] = useState<Record<string, Array<{ desde: number; hasta: number }>>>({});
  const [edicion, setEdicion] = useState<{ form: EdadParentesco; nueva: boolean; intento: boolean; mas: boolean } | null>(null);
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(() => {
    setErrorCarga(null);
    api
      .listarSis2000Edades(planId)
      .then((r) => setEdades(listaDe(r).map(normalizarEdad)))
      .catch((e) => {
        setEdades([]);
        setErrorCarga(entenderError(e, { titulo: 'No se pudieron leer las edades del plan' }));
      });
  }, [planId]);

  useEffect(() => {
    cargar();
    api.listSis2000Parentescos().then(setParentescos).catch(() => setParentescos([]));
  }, [cargar]);

  const porParentesco = useMemo(() => tablasPorParentesco(plan), [plan]);

  // Tramos de cada tabla de tasas usada en el plan (para el aviso de rango).
  useEffect(() => {
    const tablas = [...new Set([...porParentesco.values()].flat())];
    let vigente = true;
    for (const codigo of tablas) {
      api
        .leerSis2000TablaEdad(codigo)
        .then((t) => {
          if (!vigente) return;
          const lista = (t.tramos ?? []).map((x) => ({ desde: Number(x.nedad_min), hasta: Number(x.nedad_max) }));
          setTramos((prev) => ({ ...prev, [codigo]: lista }));
        })
        .catch(() => undefined);
    }
    return () => {
      vigente = false;
    };
  }, [porParentesco]);

  const nombreParen = useMemo(() => new Map(parentescos.map((p) => [String(p.cparen), texto(p.xparentesco)])), [parentescos]);
  const nombre = (c: string) => nombreParen.get(c) || `Parentesco ${c}`;
  const faltan = edades ? parentescosSinEdad([...porParentesco.keys()], edades) : [];

  const avisosDe = (e: EdadParentesco): string[] => {
    const min = Number(e.cemin_ase);
    const max = Number(e.cemax_ase);
    if (texto(e.cemin_ase) === '' || texto(e.cemax_ase) === '') return [];
    return (porParentesco.get(e.cparen) ?? [])
      .map((tabla) => (tramos[tabla] ? avisoCoberturaEdades(min, max, tramos[tabla], tabla) : null))
      .filter((a): a is string => Boolean(a));
  };

  function guardar() {
    if (!edicion) return;
    setEdicion({ ...edicion, intento: true });
    const errores = validarEdad(edicion.form);
    if (Object.keys(errores).length) {
      if (CAMPOS.some((c) => c.mas && errores[c.clave])) setEdicion({ ...edicion, intento: true, mas: true });
      return;
    }
    const f = edicion.form;
    void esc.ejecutar(
      (confirmar) =>
        api.guardarSis2000Edad(planId, f.cparen, { ...cuerpoEdad(f), motivoCambio: motivo || undefined, ...(confirmar ? { confirmar: true } : {}) }),
      {
        ok: `Edades de ${nombre(f.cparen)} guardadas: de ${f.cemin_ase} a ${f.cemax_ase} años.`,
        titulo: 'No se pudieron guardar las edades',
        alTerminar: () => {
          setEdicion(null);
          setMotivo('');
          cargar();
          onCambio?.();
        },
      },
    );
  }

  const errores = edicion?.intento ? validarEdad(edicion.form) : {};
  const usados = new Set((edades ?? []).map((e) => e.cparen));
  const disponibles = parentescos.filter((p) => !usados.has(String(p.cparen)));
  const avisosEdicion = edicion ? avisosDe(edicion.form) : [];

  return (
    <SectionPanel
      title="Edades por parentesco"
      description="Edad de entrada de cada parentesco (titular, cónyuge, hijos…). Solo la valida la cotización: un parentesco sin fila aquí no se puede cotizar en este plan."
      icon={Users}
    >
      <div className="space-y-4 text-xs">
        <AlertaError error={errorCarga} onReintentar={cargar} />
        <EstadoEscritura esc={esc} />
        {faltan.length > 0 && (
          <Alert variant="warning">
            Estos parentescos se usan en las tarifas del plan pero no tienen edades: {faltan.map(nombre).join(', ')}. Sin esa fila, el plan no
            se puede emitir para ellos.
          </Alert>
        )}

        {edades === null ? (
          <p className="text-slate-500">Leyendo edades…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-left">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Parentesco</th>
                  <th className="px-3 py-2">Edades</th>
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2">Tablas de tasas</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {edades.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                      El plan todavía no tiene edades por parentesco.
                    </td>
                  </tr>
                )}
                {edades.map((e) => {
                  const avisos = avisosDe(e);
                  return (
                    <tr key={e.cparen} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-3 py-2 font-semibold">{nombre(e.cparen)}</td>
                      <td className="px-3 py-2">
                        {e.cemin_ase || '—'} a {e.cemax_ase || '—'} años
                        {avisos.map((a, i) => (
                          <p key={i} className="mt-1 text-amber-800">
                            {a}
                          </p>
                        ))}
                      </td>
                      <td className="px-3 py-2">{e.cemin_gi || e.cemax_gi ? `${e.cemin_gi || '—'} a ${e.cemax_gi || '—'}` : '—'}</td>
                      <td className="px-3 py-2 font-mono">{(porParentesco.get(e.cparen) ?? []).join(', ') || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {!soloLectura && (
                          <Button type="button" variant="ghost" size="sm" disabled={esc.trabajando} onClick={() => { esc.limpiar(); setEdicion({ form: { ...e }, nueva: false, intento: false, mas: false }); }}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {edicion && !soloLectura && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
            <p className="font-semibold text-slate-800">{edicion.nueva ? 'Agregar edades de un parentesco' : `Edades de ${nombre(edicion.form.cparen)}`}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {edicion.nueva && (
                <div>
                  <Label htmlFor="edad-cparen">Parentesco</Label>
                  <select
                    id="edad-cparen"
                    className={cn('h-10 w-full rounded-md border border-border bg-background px-2 text-sm', errores.cparen && 'border-red-300')}
                    value={edicion.form.cparen}
                    onChange={(ev) => setEdicion({ ...edicion, form: { ...edicion.form, cparen: ev.target.value } })}
                  >
                    <option value="">Elige…</option>
                    {disponibles.map((p) => (
                      <option key={p.cparen} value={String(p.cparen)}>
                        {p.cparen} · {p.xparentesco}
                        {faltan.includes(String(p.cparen)) ? ' (le falta)' : ''}
                      </option>
                    ))}
                  </select>
                  {errores.cparen && <p className="mt-0.5 text-[11px] text-red-700">{errores.cparen}</p>}
                </div>
              )}
              {CAMPOS.filter((c) => !c.mas || edicion.mas).map((c) => (
                <div key={c.clave}>
                  <Label htmlFor={`edad-${c.clave}`} className="inline-flex items-center gap-1">
                    {c.titulo}
                    <InfoTip text={c.ayuda} />
                  </Label>
                  <Input
                    id={`edad-${c.clave}`}
                    inputMode="decimal"
                    value={edicion.form[c.clave]}
                    aria-invalid={Boolean(errores[c.clave])}
                    className={cn(errores[c.clave] && 'border-red-300')}
                    onChange={(ev) => setEdicion({ ...edicion, form: { ...edicion.form, [c.clave]: ev.target.value } })}
                  />
                  {errores[c.clave] && <p className="mt-0.5 text-[11px] text-red-700">{errores[c.clave]}</p>}
                </div>
              ))}
            </div>
            <button type="button" className="text-indigo-700 underline-offset-2 hover:underline" onClick={() => setEdicion({ ...edicion, mas: !edicion.mas })}>
              {edicion.mas ? 'Menos opciones' : 'Más opciones (grupo, suma vitalicia, reducción)'}
            </button>
            {avisosEdicion.length > 0 && (
              <Alert variant="warning">
                {avisosEdicion.map((a, i) => (
                  <p key={i}>{a}</p>
                ))}
              </Alert>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <CampoMotivo id="edad-motivo" valor={motivo} onChange={setMotivo} />
              <Button type="button" size="sm" onClick={guardar} disabled={esc.trabajando}>
                Guardar edades
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEdicion(null)} disabled={esc.trabajando}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {!soloLectura && !edicion && edades !== null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              esc.limpiar();
              setEdicion({ form: EDAD_VACIA(faltan[0] ?? ''), nueva: true, intento: false, mas: false });
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar parentesco
          </Button>
        )}
        <DialogoConfirmarEscritura esc={esc} />
      </div>
    </SectionPanel>
  );
}
