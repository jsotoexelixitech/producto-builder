import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { advertenciasPorConfirmar } from '@/lib/configurador';
import {
  cuerpoFrecuencia,
  hayFrecuenciaActiva,
  LETRAS_FRECUENCIA,
  normalizarFrecuencia,
  normalizarFrecuenciaProductor,
  listaDe,
  validarFrecuencia,
  type Frecuencia,
  type FrecuenciaForm,
  type FrecuenciaProductor,
} from '@/lib/configurador-fase2';
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

const FORM_VACIO: FrecuenciaForm = { ifrecuencia: '', xfrecuencia: '', ndias: '' };
const SELECT = 'h-10 w-full rounded-md border border-border bg-background px-2 text-sm';
const nombreLetra = (l: string) => LETRAS_FRECUENCIA[l] ?? l;

type Pendiente = { cuerpo: Record<string, unknown>; ejecutar: (cuerpo: Record<string, unknown>) => Promise<unknown>; ok: string; titulo: string };

/**
 * Formas de pago del plan (maplanes_frec): alta, cambiar nombre y activar o inactivar. Los días de una forma de pago
 * existente no se editan: se inactiva y se agrega otra. Abajo, las formas de pago propias de un productor
 * (maplanes_frec_produc), que sí se borran de verdad (queda copia en el historial).
 */
/** Filas que se editan desde aquí: activas o inactivas (N, A y otros estados de Sis2000 quedan en solo lectura). */
const editableFila = (f: Frecuencia) => f.iestado === 'V' || f.iestado === 'I';

export function FrecuenciasPanel({ planId, soloLectura, onCambio }: { planId: string; soloLectura?: boolean; onCambio?: () => void }) {
  const [filas, setFilas] = useState<Frecuencia[] | null>(null);
  const [propias, setPropias] = useState<FrecuenciaProductor[] | null>(null);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [form, setForm] = useState<FrecuenciaForm>(FORM_VACIO);
  const [intento, setIntento] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [porConfirmar, setPorConfirmar] = useState<{ adv: string[]; pendiente: Pendiente } | null>(null);
  const [formProd, setFormProd] = useState({ cproductor: '', ifrecuencia: '', xfrecuencia: '', ndias: '' });
  const [intentoProd, setIntentoProd] = useState(false);
  const [borrar, setBorrar] = useState<FrecuenciaProductor | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .listarSis2000Frecuencias(planId)
      .then((r) => {
        const lista = listaDe(r).map(normalizarFrecuencia);
        setFilas(lista);
        setNombres({});
      })
      .catch((e) => {
        setFilas([]);
        setError(entenderError(e, { titulo: 'No se pudieron leer las formas de pago del plan' }));
      });
    api
      .listarSis2000FrecuenciasProductor(planId)
      .then((r) => setPropias(listaDe(r).map(normalizarFrecuenciaProductor)))
      .catch(() => setPropias([]));
  }, [planId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const clave = (f: Frecuencia) => `${f.ifrecuencia}|${f.ndias ?? ''}`;
  const errores = intento ? validarFrecuencia(form, filas ?? []) : {};

  async function correr(p: Pendiente, confirmar = false) {
    setTrabajando(true);
    setError(null);
    setOk(null);
    setAvisos([]);
    const cuerpo = { ...p.cuerpo, motivoCambio: motivo || undefined, ...(confirmar ? { confirmar: true } : {}) };
    try {
      const r = await p.ejecutar(cuerpo);
      const adv = advertenciasPorConfirmar(r, confirmar);
      if (adv.length) {
        setPorConfirmar({ adv, pendiente: p });
        return false;
      }
      setPorConfirmar(null);
      const info = (r as { advertencias?: unknown })?.advertencias;
      if (Array.isArray(info) && info.length) setAvisos(info.map(String));
      setOk(p.ok);
      setMotivo('');
      cargar();
      onCambio?.();
      return true;
    } catch (e) {
      const adv = advertenciasPorConfirmar(e, confirmar);
      if (adv.length) setPorConfirmar({ adv, pendiente: p });
      else setError(entenderError(e, { titulo: p.titulo, duplicado: 'Esa forma de pago ya está activa en el plan.' }));
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  function agregar() {
    setIntento(true);
    if (Object.keys(validarFrecuencia(form, filas ?? [])).length) return;
    const cuerpo = cuerpoFrecuencia(form);
    void correr({
      cuerpo,
      ejecutar: (c) => api.agregarSis2000Frecuencia(planId, c),
      ok: `Forma de pago «${String(cuerpo.xfrecuencia)}» agregada.`,
      titulo: 'No se pudo agregar la forma de pago',
    }).then((g) => {
      if (!g) return;
      setForm(FORM_VACIO);
      setIntento(false);
    });
  }

  function editar(f: Frecuencia, cambios: Record<string, unknown>, ok: string) {
    const cuerpo: Record<string, unknown> = { ...cambios };
    if (f.ndias != null) cuerpo.ndias = f.ndias;
    void correr({
      cuerpo,
      ejecutar: (c) => api.editarSis2000Frecuencia(planId, f.ifrecuencia, c),
      ok,
      titulo: 'No se pudo cambiar la forma de pago',
    });
  }

  const erroresProd: Record<string, string> = {};
  if (intentoProd) {
    if (!/^\d+$/.test(formProd.cproductor.trim())) erroresProd.cproductor = 'El código del productor es un número.';
    const e = validarFrecuencia({ ifrecuencia: formProd.ifrecuencia, xfrecuencia: formProd.xfrecuencia, ndias: formProd.ndias });
    Object.assign(erroresProd, e);
    const letra = formProd.ifrecuencia.trim().toUpperCase();
    if (
      !erroresProd.ifrecuencia &&
      (propias ?? []).some((p) => p.cproductor === formProd.cproductor.trim() && p.ifrecuencia === letra)
    ) {
      erroresProd.ifrecuencia = 'Ese productor ya tiene esa forma de pago.';
    }
  }

  function agregarPropia() {
    setIntentoProd(true);
    if (!/^\d+$/.test(formProd.cproductor.trim())) return;
    const e = validarFrecuencia({ ifrecuencia: formProd.ifrecuencia, xfrecuencia: formProd.xfrecuencia, ndias: formProd.ndias });
    if (Object.keys(e).length) return;
    const letra = formProd.ifrecuencia.trim().toUpperCase();
    if ((propias ?? []).some((p) => p.cproductor === formProd.cproductor.trim() && p.ifrecuencia === letra)) return;
    const cuerpo = {
      cproductor: Number(formProd.cproductor.trim()),
      ...cuerpoFrecuencia({ ifrecuencia: formProd.ifrecuencia, xfrecuencia: formProd.xfrecuencia, ndias: formProd.ndias }),
    };
    void correr({
      cuerpo,
      ejecutar: (c) => api.agregarSis2000FrecuenciaProductor(planId, c),
      ok: `Forma de pago agregada para el productor ${formProd.cproductor.trim()}.`,
      titulo: 'No se pudo agregar la forma de pago del productor',
    }).then((g) => {
      if (!g) return;
      setFormProd({ cproductor: '', ifrecuencia: '', xfrecuencia: '', ndias: '' });
      setIntentoProd(false);
    });
  }

  async function confirmarBorrado() {
    if (!borrar) return;
    const f = borrar;
    const g = await correr({
      cuerpo: {},
      ejecutar: () => api.borrarSis2000FrecuenciaProductor(planId, f.cproductor, f.ifrecuencia, motivo || undefined, f.ndias),
      ok: `Forma de pago ${nombreLetra(f.ifrecuencia)} del productor ${f.cproductor} borrada (la copia quedó en el historial).`,
      titulo: 'No se pudo borrar la forma de pago del productor',
    });
    if (g) setBorrar(null);
  }

  const sinActivas = filas !== null && filas.length > 0 && !hayFrecuenciaActiva(filas);

  return (
    <SectionPanel
      title="Formas de pago"
      description="Cómo puede fraccionar el pago el asegurado. Cada letra fija las cuotas: A anual (1), S semestral (2), C cuatrimestral (3), T trimestral (4), M mensual (12), E evento o pago único (1), K postpago en 4 cuotas (solo auto), D por días. Sin al menos una activa, la emisión no encuentra formas de pago y el plan no se puede ofrecer."
      icon={CalendarClock}
    >
      <div className="space-y-4 text-xs">
        <AlertaError error={error} onReintentar={cargar} />
        {ok && <Alert variant="success">{ok}</Alert>}
        {avisos.length > 0 && (
          <Alert variant="warning">
            <ul className="list-disc space-y-0.5 pl-4">
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Alert>
        )}
        {(sinActivas || (filas !== null && filas.length === 0 && !error)) && (
          <Alert variant="warning">El plan no tiene ninguna forma de pago activa: no se podrá ofrecer.</Alert>
        )}

        {filas === null ? (
          <p className="text-slate-500">Leyendo formas de pago…</p>
        ) : (
          filas.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[620px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        Forma <InfoTip text={'Letra de la forma de pago; de ella salen las cuotas. A anual, S semestral, C cuatrimestral, T trimestral, M mensual, E evento o única, K postpago 4 cuotas (auto), D por días. Una letra distinta se cobra en 1 cuota.\nEn Sis2000: maplanes_frec.ifrecuencia'} />
                      </span>
                    </th>
                    <th className="px-3 py-2">Nombre que se muestra</th>
                    <th className="px-3 py-2">Días</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const k = clave(f);
                    const nombre = nombres[k] ?? f.xfrecuencia;
                    const cambiado = nombre.trim() !== f.xfrecuencia && nombre.trim() !== '';
                    return (
                      // Solo V e I se editan; N, A u otros estados de Sis2000 se muestran en solo lectura.
                      <tr key={k} className={cn('border-b border-slate-100 last:border-0', f.iestado !== 'V' && 'text-slate-400')}>
                        <td className="px-3 py-2 font-semibold">
                          {nombreLetra(f.ifrecuencia)} <span className="font-mono text-slate-500">({f.ifrecuencia})</span>
                        </td>
                        <td className="px-3 py-2">
                          {soloLectura || !editableFila(f) ? (
                            f.xfrecuencia || '—'
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                aria-label={`Nombre de la forma de pago ${f.ifrecuencia}`}
                                className="h-8 text-xs"
                                value={nombre}
                                maxLength={150}
                                onChange={(e) => setNombres({ ...nombres, [k]: e.target.value })}
                              />
                              {cambiado && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={trabajando}
                                  onClick={() => editar(f, { xfrecuencia: nombre.trim() }, `Nombre de la forma de pago ${f.ifrecuencia} cambiado.`)}
                                >
                                  Guardar
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">{f.ndias ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              f.iestado === 'V' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {f.iestado === 'V' ? 'Activa' : f.iestado === 'I' ? 'Inactiva' : `Estado ${f.iestado} (solo lectura)`}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!soloLectura && editableFila(f) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={trabajando}
                              onClick={() =>
                                editar(
                                  f,
                                  { iestado: f.iestado === 'V' ? 'I' : 'V' },
                                  f.iestado === 'V' ? `Forma de pago ${f.ifrecuencia} inactivada (no se borra).` : `Forma de pago ${f.ifrecuencia} activada.`,
                                )
                              }
                            >
                              {f.iestado === 'V' ? 'Inactivar' : 'Activar'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
        {!soloLectura && filas && filas.some((f) => f.ndias != null) && (
          <p className="text-[11px] text-slate-500">
            Para cambiar los días de una forma de pago «Por días», inactívala y agrega otra con los días nuevos.
          </p>
        )}

        {!soloLectura && (
          <div className="space-y-3 rounded-xl border border-dashed border-slate-200 p-3">
            <p className="font-semibold text-slate-800">Agregar forma de pago</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="frec-letra">Forma de pago</Label>
                <select
                  id="frec-letra"
                  className={cn(SELECT, errores.ifrecuencia && 'border-red-300')}
                  value={form.ifrecuencia}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ifrecuencia: e.target.value,
                      xfrecuencia: !form.xfrecuencia || Object.values(LETRAS_FRECUENCIA).includes(form.xfrecuencia) ? (LETRAS_FRECUENCIA[e.target.value] ?? '') : form.xfrecuencia,
                    })
                  }
                >
                  <option value="">Elegir…</option>
                  {Object.entries(LETRAS_FRECUENCIA).map(([l, n]) => (
                    <option key={l} value={l}>
                      {n} ({l})
                    </option>
                  ))}
                </select>
                {errores.ifrecuencia && <p className="mt-0.5 text-[11px] text-red-700">{errores.ifrecuencia}</p>}
              </div>
              <div>
                <Label htmlFor="frec-nombre" className="inline-flex items-center gap-1">
                  Nombre que se muestra
                  <InfoTip text={'Nombre de la forma de pago que se muestra al emitir. Vacío = el nombre estándar. Ejemplo: «Mensual».\nEn Sis2000: maplanes_frec.xfrecuencia'} />
                </Label>
                <Input id="frec-nombre" value={form.xfrecuencia} maxLength={150} onChange={(e) => setForm({ ...form, xfrecuencia: e.target.value })} />
                {errores.xfrecuencia && <p className="mt-0.5 text-[11px] text-red-700">{errores.xfrecuencia}</p>}
              </div>
              <div>
                <Label htmlFor="frec-dias" className="inline-flex items-center gap-1">
                  Días {form.ifrecuencia === 'D' ? '(obligatorio)' : '(opcional)'}
                  <InfoTip text={'Cantidad de días de esa opción. Obligatorio en «Por días» (D); en las demás letras es opcional.\nEn Sis2000: maplanes_frec.ndias'} />
                </Label>
                <Input
                  id="frec-dias"
                  inputMode="numeric"
                  value={form.ndias}
                  className={cn(errores.ndias && 'border-red-300')}
                  onChange={(e) => setForm({ ...form, ndias: e.target.value })}
                />
                {errores.ndias && <p className="mt-0.5 text-[11px] text-red-700">{errores.ndias}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <Label htmlFor="frec-motivo">Motivo (opcional, queda en el historial)</Label>
                <Input id="frec-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <Button type="button" size="sm" onClick={agregar} disabled={trabajando}>
                <Plus className="h-3.5 w-3.5" />
                Agregar forma de pago
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <p className="flex items-center gap-1 font-semibold text-slate-800">
            Formas de pago propias de un productor
            <InfoTip text={'Formas de pago extra que solo se le ofrecen a un productor en este plan, además de las generales. Ejemplo: mensual solo para un productor puntual. Al quitarlas se borran (no tienen estado); antes se guarda copia en el historial.\nEn Sis2000: maplanes_frec_produc'} />
          </p>
          {propias === null ? (
            <p className="text-slate-500">Leyendo…</p>
          ) : propias.length === 0 ? (
            <p className="text-slate-500">Ningún productor tiene formas de pago propias en este plan.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[520px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Productor</th>
                    <th className="px-3 py-2">Forma de pago</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Días</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {propias.map((p) => (
                    <tr key={`${p.cproductor}|${p.ifrecuencia}|${p.ndias ?? ''}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 font-mono">{p.cproductor || '—'}</td>
                      <td className="px-3 py-2">
                        {nombreLetra(p.ifrecuencia)} <span className="font-mono text-slate-500">({p.ifrecuencia})</span>
                      </td>
                      <td className="px-3 py-2">{p.xfrecuencia || '—'}</td>
                      <td className="px-3 py-2">{p.ndias ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {!soloLectura && (
                          <Button type="button" size="sm" variant="ghost" disabled={trabajando} onClick={() => setBorrar(p)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Borrar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!soloLectura && (
            <div className="grid gap-3 rounded-xl border border-dashed border-slate-200 p-3 sm:grid-cols-5">
              <div>
                <Label htmlFor="frecp-prod">Productor (código)</Label>
                <Input
                  id="frecp-prod"
                  inputMode="numeric"
                  value={formProd.cproductor}
                  className={cn(erroresProd.cproductor && 'border-red-300')}
                  onChange={(e) => setFormProd({ ...formProd, cproductor: e.target.value })}
                />
                {erroresProd.cproductor && <p className="mt-0.5 text-[11px] text-red-700">{erroresProd.cproductor}</p>}
              </div>
              <div>
                <Label htmlFor="frecp-letra">Forma de pago</Label>
                <select
                  id="frecp-letra"
                  className={cn(SELECT, erroresProd.ifrecuencia && 'border-red-300')}
                  value={formProd.ifrecuencia}
                  onChange={(e) => setFormProd({ ...formProd, ifrecuencia: e.target.value, xfrecuencia: formProd.xfrecuencia || (LETRAS_FRECUENCIA[e.target.value] ?? '') })}
                >
                  <option value="">Elegir…</option>
                  {Object.entries(LETRAS_FRECUENCIA).map(([l, n]) => (
                    <option key={l} value={l}>
                      {n} ({l})
                    </option>
                  ))}
                </select>
                {erroresProd.ifrecuencia && <p className="mt-0.5 text-[11px] text-red-700">{erroresProd.ifrecuencia}</p>}
              </div>
              <div>
                <Label htmlFor="frecp-nombre">Nombre</Label>
                <Input id="frecp-nombre" value={formProd.xfrecuencia} maxLength={150} onChange={(e) => setFormProd({ ...formProd, xfrecuencia: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="frecp-dias">Días</Label>
                <Input
                  id="frecp-dias"
                  inputMode="numeric"
                  value={formProd.ndias}
                  className={cn(erroresProd.ndias && 'border-red-300')}
                  onChange={(e) => setFormProd({ ...formProd, ndias: e.target.value })}
                />
                {erroresProd.ndias && <p className="mt-0.5 text-[11px] text-red-700">{erroresProd.ndias}</p>}
              </div>
              <div className="flex items-end">
                <Button type="button" size="sm" variant="outline" onClick={agregarPropia} disabled={trabajando}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </Button>
              </div>
            </div>
          )}
        </div>

        {borrar && (
          <ConfirmarDialog
            titulo="Borrar forma de pago del productor"
            confirmar="Borrar"
            cancelar="No borrar"
            ocupado={trabajando}
            onConfirmar={() => void confirmarBorrado()}
            onCancelar={() => setBorrar(null)}
          >
            <p>
              Se borra de verdad la forma de pago <strong>{nombreLetra(borrar.ifrecuencia)}</strong> del productor{' '}
              <strong>{borrar.cproductor}</strong> en este plan (esta tabla no tiene estado activo/inactivo).
            </p>
            <p>Antes de borrar se guarda una copia en el historial del configurador.</p>
          </ConfirmarDialog>
        )}

        {porConfirmar && (
          <ConfirmarDialog
            titulo="Revisa antes de guardar"
            confirmar="Guardar de todas formas"
            cancelar="No guardar"
            ocupado={trabajando}
            onConfirmar={() => void correr(porConfirmar.pendiente, true)}
            onCancelar={() => setPorConfirmar(null)}
          >
            <p>Sis2000 avisa lo siguiente:</p>
            <ul className="list-disc space-y-1 pl-5">
              {porConfirmar.adv.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </ConfirmarDialog>
        )}
      </div>
    </SectionPanel>
  );
}
