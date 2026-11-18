import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { advertenciasPorConfirmar } from '@/lib/configurador';
import {
  consultaQuienVende,
  cuerpoQuienVende,
  ENTIDADES_EDITABLES,
  entidadEditable,
  hayQuienVende,
  NOMBRE_ENTIDAD_VENTA,
  normalizarPaginaQuienVende,
  normalizarResumenQuienVende,
  partirCodigos,
  validarAltaQuienVende,
  type AltaQuienVendeForm,
  type FilaQuienVende,
  type GrupoResumen,
  type PaginaQuienVende,
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

const POR_PAGINA = 50;
const SELECT = 'h-10 w-full rounded-md border border-border bg-background px-2 text-sm';
const ALTA_VACIA: AltaQuienVendeForm = { centidad: 'P', itipouso: 'A', todos: false, codigos: '' };
const nombreEntidad = (c: string) => NOMBRE_ENTIDAD_VENTA[c] ?? { uno: `entidad ${c}`, varios: `Otros (${c})` };
const claveFila = (f: FilaQuienVende) => `${f.id}|${f.centidad}|${f.citem ?? '*'}|${f.itipouso}`;

type Operacion = { tipo: 'alta' | 'baja'; cuerpo: { centidad: string; itipouso: 'A' | 'E'; items: string[] | null } };

/**
 * Quién vende el plan (mausuplan): productores, canales y gestores que lo pueden ofrecer («incluye») o que no
 * («excluye»). Hay planes con miles de filas: arriba el resumen, abajo la lista paginada con búsqueda. Las altas son
 * masivas (códigos pegados o «Todos»); las bajas borran las filas de verdad (antes se guarda copia en el historial).
 * Las entidades R, U y A se muestran pero no se editan en esta fase.
 */
export function QuienVendePanel({ planId, soloLectura, onCambio }: { planId: string; soloLectura?: boolean; onCambio?: () => void }) {
  const [resumen, setResumen] = useState<GrupoResumen[] | null>(null);
  const [pagina, setPagina] = useState<PaginaQuienVende | null>(null);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [errorLista, setErrorLista] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [filtro, setFiltro] = useState({ centidad: '', itipouso: '', q: '' });
  const [busqueda, setBusqueda] = useState('');
  const [offset, setOffset] = useState(0);
  const [marcadas, setMarcadas] = useState<Record<string, FilaQuienVende>>({});
  const [alta, setAlta] = useState<AltaQuienVendeForm>(ALTA_VACIA);
  const [intentoAlta, setIntentoAlta] = useState(false);
  const [bajaPegada, setBajaPegada] = useState<AltaQuienVendeForm>({ ...ALTA_VACIA });
  const [intentoBaja, setIntentoBaja] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [confirmar, setConfirmar] = useState<{ operaciones: Operacion[]; adv?: string[] } | null>(null);

  const cargarResumen = useCallback(() => {
    setError(null);
    api
      .resumenSis2000QuienVende(planId)
      .then((r) => setResumen(normalizarResumenQuienVende(r)))
      .catch((e) => {
        setResumen([]);
        setError(entenderError(e, { titulo: 'No se pudo leer quién vende el plan' }));
      });
  }, [planId]);

  const cargarLista = useCallback(() => {
    setErrorLista(null);
    api
      .listarSis2000QuienVende(planId, consultaQuienVende({ ...filtro, limit: POR_PAGINA, offset }))
      .then((r) => setPagina(normalizarPaginaQuienVende(r)))
      .catch((e) => {
        setPagina({ filas: [], total: null });
        setErrorLista(entenderError(e, { titulo: 'No se pudo leer la lista' }));
      });
  }, [planId, filtro, offset]);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);
  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  const recargar = () => {
    cargarResumen();
    cargarLista();
    setMarcadas({});
  };

  const erroresAlta = intentoAlta ? validarAltaQuienVende(alta) : {};
  const erroresBaja = intentoBaja ? validarAltaQuienVende({ ...bajaPegada, todos: false }) : {};

  async function ejecutar(operaciones: Operacion[], confirmado = false) {
    setTrabajando(true);
    setError(null);
    setOk(null);
    setAvisos([]);
    const hechos: string[] = [];
    const info: string[] = [];
    try {
      for (const op of operaciones) {
        const cuerpo = { ...op.cuerpo, motivoCambio: motivo || undefined, ...(confirmado ? { confirmar: true } : {}) };
        const r = op.tipo === 'alta' ? await api.agregarSis2000QuienVende(planId, cuerpo) : await api.bajaSis2000QuienVende(planId, cuerpo);
        const adv = advertenciasPorConfirmar(r, confirmado);
        if (adv.length) {
          setConfirmar({ operaciones: operaciones.slice(operaciones.indexOf(op)), adv });
          if (hechos.length) recargar();
          return false;
        }
        if (Array.isArray(r?.advertencias)) info.push(...r.advertencias.map(String));
        hechos.push(describir(op));
      }
      setConfirmar(null);
      setOk(`${hechos.join(' ')}`);
      setAvisos(info);
      setMotivo('');
      recargar();
      onCambio?.();
      return true;
    } catch (e) {
      const adv = advertenciasPorConfirmar(e, confirmado);
      if (adv.length) setConfirmar({ operaciones, adv });
      else setError(entenderError(e, { titulo: 'No se pudo guardar quién vende el plan' }));
      if (hechos.length) recargar();
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  function describir(op: Operacion) {
    const ent = nombreEntidad(op.cuerpo.centidad);
    const quien = op.cuerpo.items === null ? `todos los ${ent.varios.toLowerCase()}` : `${op.cuerpo.items.length} ${ent.varios.toLowerCase()}`;
    const como = op.cuerpo.itipouso === 'E' ? 'excluidos' : 'incluidos';
    return op.tipo === 'alta' ? `Agregados ${quien} como ${como}.` : `Quitados ${quien} ${como} (copia en el historial).`;
  }

  function agregar() {
    setIntentoAlta(true);
    if (Object.keys(validarAltaQuienVende(alta)).length) return;
    void ejecutar([{ tipo: 'alta', cuerpo: cuerpoQuienVende(alta) }]).then((g) => {
      if (!g) return;
      setAlta(ALTA_VACIA);
      setIntentoAlta(false);
    });
  }

  /** Bajas de las filas marcadas, agrupadas por entidad e incluye/excluye. */
  function pedirBajaMarcadas() {
    const grupos = new Map<string, Operacion>();
    for (const f of Object.values(marcadas)) {
      // La fila «Todos» (citem NULL) va en su propia baja con items null.
      const k = `${f.centidad}|${f.itipouso}|${f.citem === null ? 'todos' : 'codigos'}`;
      const op =
        grupos.get(k) ??
        ({ tipo: 'baja', cuerpo: { centidad: f.centidad, itipouso: f.itipouso, items: f.citem === null ? null : [] } } as Operacion);
      if (f.citem !== null && op.cuerpo.items) op.cuerpo.items.push(f.citem);
      grupos.set(k, op);
    }
    if (grupos.size) setConfirmar({ operaciones: [...grupos.values()] });
  }

  function pedirBajaPegada() {
    setIntentoBaja(true);
    const f = { ...bajaPegada, todos: false };
    if (Object.keys(validarAltaQuienVende(f)).length) return;
    setConfirmar({ operaciones: [{ tipo: 'baja', cuerpo: cuerpoQuienVende(f) }] });
  }

  const buscar = () => {
    setOffset(0);
    setFiltro({ ...filtro, q: busqueda.trim() });
  };
  const total = pagina?.total ?? null;
  const hayMas = total !== null ? offset + POR_PAGINA < total : (pagina?.filas.length ?? 0) >= POR_PAGINA;
  const nMarcadas = Object.keys(marcadas).length;
  const entidadesResumen = [...new Set([...ENTIDADES_EDITABLES, ...(resumen ?? []).map((g) => g.centidad)])];

  return (
    <SectionPanel
      title="Quién lo vende"
      description="Qué productores, canales y gestores pueden emitir el plan («incluye») y cuáles no («excluye»). «Todos» = una fila sin código que abre el plan a toda esa entidad. Sin al menos un «incluye», nadie puede ofrecer el plan."
      icon={Users}
    >
      <div className="space-y-4 text-xs">
        <AlertaError error={error} onReintentar={recargar} />
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
        {resumen !== null && !error && !hayQuienVende(resumen) && (
          <Alert variant="warning">Nadie tiene incluido este plan: no se podrá vender. Agrega al menos un productor, canal o gestor (o «Todos»).</Alert>
        )}

        {resumen === null ? (
          <p className="text-slate-500">Leyendo el resumen…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {entidadesResumen.map((c) => {
              const inc = resumen.find((g) => g.centidad === c && g.itipouso === 'A');
              const exc = resumen.find((g) => g.centidad === c && g.itipouso === 'E');
              const editable = entidadEditable(c);
              if (!editable && !inc && !exc) return null;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setOffset(0);
                    setFiltro({ ...filtro, centidad: c });
                  }}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors hover:border-indigo-300',
                    filtro.centidad === c ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white',
                  )}
                >
                  <p className="flex items-center gap-2 font-semibold text-slate-800">
                    {nombreEntidad(c).varios}
                    {!editable && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">solo lectura</span>}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Incluidos: <strong>{inc?.todos ? 'Todos' : (inc?.cantidad ?? 0).toLocaleString('es-VE')}</strong>
                    {inc?.todos && inc.cantidad > 1 ? ` (+${(inc.cantidad - 1).toLocaleString('es-VE')} filas)` : ''}
                  </p>
                  <p className="text-slate-600">
                    Excluidos: <strong>{(exc?.cantidad ?? 0).toLocaleString('es-VE')}</strong>
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="qv-f-ent">Entidad</Label>
              <select
                id="qv-f-ent"
                className={SELECT}
                value={filtro.centidad}
                onChange={(e) => {
                  setOffset(0);
                  setFiltro({ ...filtro, centidad: e.target.value });
                }}
              >
                <option value="">Todas</option>
                {entidadesResumen.map((c) => (
                  <option key={c} value={c}>
                    {nombreEntidad(c).varios}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="qv-f-uso">Incluye / excluye</Label>
              <select
                id="qv-f-uso"
                className={SELECT}
                value={filtro.itipouso}
                onChange={(e) => {
                  setOffset(0);
                  setFiltro({ ...filtro, itipouso: e.target.value });
                }}
              >
                <option value="">Ambos</option>
                <option value="A">Incluye</option>
                <option value="E">Excluye</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="qv-f-q">Buscar por código o nombre</Label>
              <div className="flex gap-2">
                <Input id="qv-f-q" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()} />
                <Button type="button" size="sm" variant="outline" className="h-10" onClick={buscar}>
                  <Search className="h-3.5 w-3.5" />
                  Buscar
                </Button>
              </div>
            </div>
          </div>

          <AlertaError error={errorLista} onReintentar={cargarLista} />
          {pagina === null ? (
            <p className="text-slate-500">Leyendo la lista…</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[620px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
                  <tr>
                    {!soloLectura && <th className="w-8 px-3 py-2" aria-label="Marcar" />}
                    <th className="px-3 py-2">Entidad</th>
                    <th className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        Código <InfoTip text={'Código del productor, canal o gestor. «Todos» = fila sin código: aplica a todos los de esa entidad.\nEn Sis2000: mausuplan.citem (vacío = todos)'} />
                      </span>
                    </th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        Incluye / excluye <InfoTip text={'Incluye: puede ofrecer el plan. Excluye: queda fuera aunque esté incluido por «Todos». Ejemplo: todos los productores menos uno.\nEn Sis2000: mausuplan.itipouso (A = incluye, E = excluye)'} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagina.filas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                        No hay filas con ese filtro.
                      </td>
                    </tr>
                  )}
                  {pagina.filas.map((f) => {
                    const k = claveFila(f);
                    const editable = entidadEditable(f.centidad);
                    return (
                      <tr key={k} className="border-b border-slate-100 last:border-0">
                        {!soloLectura && (
                          <td className="px-3 py-2">
                            {editable && (
                              <input
                                type="checkbox"
                                aria-label={`Marcar ${f.citem ?? 'todos'}`}
                                checked={Boolean(marcadas[k])}
                                onChange={(e) => {
                                  const m = { ...marcadas };
                                  if (e.target.checked) m[k] = f;
                                  else delete m[k];
                                  setMarcadas(m);
                                }}
                              />
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {nombreEntidad(f.centidad).uno}
                          {!editable && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">solo lectura</span>}
                        </td>
                        <td className="px-3 py-2 font-mono">{f.citem ?? <strong className="font-sans">Todos</strong>}</td>
                        <td className="px-3 py-2">{f.nombre || '—'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              f.itipouso === 'E' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800',
                            )}
                          >
                            {f.itipouso === 'E' ? 'Excluye' : 'Incluye'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-slate-500">
              {pagina && pagina.filas.length > 0
                ? `Filas ${offset + 1}–${offset + pagina.filas.length}${total !== null ? ` de ${total.toLocaleString('es-VE')}` : ''}`
                : ''}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - POR_PAGINA))}>
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!hayMas} onClick={() => setOffset(offset + POR_PAGINA)}>
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {!soloLectura && nMarcadas > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex-1 font-semibold text-amber-900">{nMarcadas} fila(s) marcada(s).</p>
              <Button type="button" size="sm" variant="destructive" disabled={trabajando} onClick={pedirBajaMarcadas}>
                <Trash2 className="h-3.5 w-3.5" />
                Quitar las marcadas
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMarcadas({})}>
                Desmarcar
              </Button>
            </div>
          )}
        </div>

        {!soloLectura && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-dashed border-slate-200 p-3">
              <p className="font-semibold text-slate-800">Agregar (incluir o excluir)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="qv-a-ent">Entidad</Label>
                  <select id="qv-a-ent" className={SELECT} value={alta.centidad} onChange={(e) => setAlta({ ...alta, centidad: e.target.value })}>
                    {ENTIDADES_EDITABLES.map((c) => (
                      <option key={c} value={c}>
                        {nombreEntidad(c).varios}
                      </option>
                    ))}
                  </select>
                  {erroresAlta.centidad && <p className="mt-0.5 text-[11px] text-red-700">{erroresAlta.centidad}</p>}
                </div>
                <div>
                  <Label htmlFor="qv-a-uso">¿Incluye o excluye?</Label>
                  <select id="qv-a-uso" className={SELECT} value={alta.itipouso} onChange={(e) => setAlta({ ...alta, itipouso: e.target.value })}>
                    <option value="A">Incluye (lo puede vender)</option>
                    <option value="E">Excluye (no lo puede vender)</option>
                  </select>
                  {erroresAlta.itipouso && <p className="mt-0.5 text-[11px] text-red-700">{erroresAlta.itipouso}</p>}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={alta.todos} onChange={(e) => setAlta({ ...alta, todos: e.target.checked })} />
                Todos los {nombreEntidad(alta.centidad).varios.toLowerCase()}
              </label>
              {!alta.todos && (
                <div>
                  <Label htmlFor="qv-a-cod" className="inline-flex items-center gap-1">
                    Códigos
                    <InfoTip text={'Pega los códigos separados por coma, espacio o salto de línea. Los que ya estén cargados se ignoran. Ejemplo: 1234, 5678.\nEn Sis2000: mausuplan.citem'} />
                  </Label>
                  <textarea
                    id="qv-a-cod"
                    rows={3}
                    className={cn('w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs', erroresAlta.codigos && 'border-red-300')}
                    value={alta.codigos}
                    onChange={(e) => setAlta({ ...alta, codigos: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-500">{partirCodigos(alta.codigos).length} código(s)</p>
                  {erroresAlta.codigos && <p className="mt-0.5 text-[11px] text-red-700">{erroresAlta.codigos}</p>}
                </div>
              )}
              <Button type="button" size="sm" onClick={agregar} disabled={trabajando}>
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>

            <div className="space-y-3 rounded-xl border border-dashed border-slate-200 p-3">
              <p className="font-semibold text-slate-800">Quitar por códigos</p>
              <p className="text-slate-500">También puedes marcar filas en la lista de arriba. Las filas se borran (esta tabla no tiene estado); antes queda copia en el historial.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="qv-b-ent">Entidad</Label>
                  <select id="qv-b-ent" className={SELECT} value={bajaPegada.centidad} onChange={(e) => setBajaPegada({ ...bajaPegada, centidad: e.target.value })}>
                    {ENTIDADES_EDITABLES.map((c) => (
                      <option key={c} value={c}>
                        {nombreEntidad(c).varios}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="qv-b-uso">Filas que</Label>
                  <select id="qv-b-uso" className={SELECT} value={bajaPegada.itipouso} onChange={(e) => setBajaPegada({ ...bajaPegada, itipouso: e.target.value })}>
                    <option value="A">Incluyen</option>
                    <option value="E">Excluyen</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="qv-b-cod">Códigos</Label>
                <textarea
                  id="qv-b-cod"
                  rows={3}
                  className={cn('w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs', erroresBaja.codigos && 'border-red-300')}
                  value={bajaPegada.codigos}
                  onChange={(e) => setBajaPegada({ ...bajaPegada, codigos: e.target.value })}
                />
                {erroresBaja.codigos && <p className="mt-0.5 text-[11px] text-red-700">{erroresBaja.codigos}</p>}
              </div>
              <Button type="button" size="sm" variant="destructive" onClick={pedirBajaPegada} disabled={trabajando}>
                <Trash2 className="h-3.5 w-3.5" />
                Quitar
              </Button>
            </div>
          </div>
        )}

        {!soloLectura && (
          <div className="max-w-xl">
            <Label htmlFor="qv-motivo">Motivo (opcional, queda en el historial)</Label>
            <Input id="qv-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        )}

        {confirmar && (
          <ConfirmarDialog
            titulo={confirmar.adv ? 'Revisa antes de guardar' : 'Confirmar quitar'}
            confirmar={confirmar.adv ? 'Guardar de todas formas' : 'Quitar'}
            cancelar="No hacer nada"
            ocupado={trabajando}
            onConfirmar={() => void ejecutar(confirmar.operaciones, Boolean(confirmar.adv))}
            onCancelar={() => setConfirmar(null)}
          >
            {confirmar.adv ? (
              <>
                <p>Sis2000 avisa lo siguiente:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {confirmar.adv.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p>Se van a borrar estas filas de quién vende el plan (la tabla no tiene estado activo/inactivo):</p>
                <ul className="list-disc space-y-1 pl-5">
                  {confirmar.operaciones.map((op, i) => (
                    <li key={i}>
                      {nombreEntidad(op.cuerpo.centidad).varios} que {op.cuerpo.itipouso === 'E' ? 'excluyen' : 'incluyen'}:{' '}
                      {op.cuerpo.items === null ? 'la fila «Todos»' : `${op.cuerpo.items.slice(0, 15).join(', ')}${op.cuerpo.items.length > 15 ? ` y ${op.cuerpo.items.length - 15} más` : ''}`}
                    </li>
                  ))}
                </ul>
                <p>Antes de borrar se guarda una copia en el historial del configurador.</p>
              </>
            )}
          </ConfirmarDialog>
        )}
      </div>
    </SectionPanel>
  );
}
