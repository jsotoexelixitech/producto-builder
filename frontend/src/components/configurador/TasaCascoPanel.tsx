import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Eye, FilePlus2, Gauge, History, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import {
  AJUSTE_CASCO_VACIO,
  ALCANCES_CASCO,
  cuerpoVersionCasco,
  cuerpoVistaPreviaCasco,
  errorAprobarCasco,
  esNoImplementado,
  filtrosQueUsa,
  listaDe,
  normalizarTasaCasco,
  normalizarVersionCasco,
  SITUACION_CASCO,
  texto,
  validarAjusteCasco,
  type AjusteCascoForm,
  type TasaCasco,
  type VersionCasco,
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
import { DialogoConfirmarEscritura, EstadoEscritura, useEscritura } from './EscrituraConfirmada';

type Fila = Record<string, unknown>;
const MAX_FILAS = 200;
const NO_DISPONIBLE = 'Esta operación de la tasa de casco todavía no está disponible en Sis2000. Avísale a Técnica.';

/** Columnas de auditoría de Sis2000 que no se muestran. */
const OCULTAS = new Set(['u_version', 'cprog', 'ifuente', 'bok', 'cerror', 'fingreso', 'cusuario', 'ccategoria', 'cusuarioauto', 'ccategoriaauto', 'fultmod', 'cusuariomod', 'ccategoriamod', 'cramo']);
const TITULOS: Record<string, string> = {
  cplan: 'Plan',
  ccober: 'Cobertura',
  ctipo: 'Tipo de vehículo',
  ccategotr: 'Categoría',
  cuso: 'Uso',
  itipocalculo: 'Tipo de cálculo',
  crango: 'Rango',
  msumamin: 'Suma desde',
  msumamax: 'Suma hasta',
  fano: 'Año',
  ntasa: 'Tasa %',
  nfactor: 'Factor',
  xtipo: 'Clase',
};
const NOMBRE_COBERTURA: Record<string, string> = { '1': 'Amplia', '2': 'Pérdida total', '28': 'Pérdida parcial' };

const columnasDe = (filas: Fila[]) => Object.keys(filas[0] ?? {}).filter((k) => !OCULTAS.has(k));
const valor = (v: unknown) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  const n = Number(v);
  return typeof v === 'number' || (/^-?\d+(\.\d+)?$/.test(String(v).trim()) && Number.isFinite(n))
    ? n.toLocaleString('es-VE', { maximumFractionDigits: 6 })
    : String(v).trim();
};
const unicos = (filas: Fila[], k: string) => [...new Set(filas.map((f) => texto(f[k])).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
const filtrar = (filas: Fila[], plan: string, cober: string) =>
  filas.filter((f) => (!plan || !('cplan' in f) || texto(f.cplan) === plan) && (!cober || !('ccober' in f) || texto(f.ccober) === cober));

const describirVersion = (v: VersionCasco) => {
  if (v.origen === 'RESTAURACION') return 'Restauración de una versión anterior';
  if (v.movimiento) {
    const sentido = v.movimiento === 'DISMINUCION' ? 'Baja' : 'Sube';
    return `${sentido} ${v.porcentaje ?? '—'} % · ${ALCANCES_CASCO[v.alcance] ?? v.alcance}`;
  }
  return v.origen || '—';
};
const vigencia = (v: VersionCasco) =>
  `${v.rigeAlAprobar && (v.situacion === 'PENDIENTE' || !v.vigenteDesde) ? 'al aprobarse' : v.vigenteDesde || '—'}${v.vigenteHasta ? ` al ${v.vigenteHasta}` : ' en adelante'}`;

type Accion = { tipo: 'publicar' | 'rechazar' | 'cancelar'; version: VersionCasco; cusuario: string; texto: string; intento: boolean };

/**
 * Tasa de casco por características (auto, ramo 18, coberturas 1, 2 y 28). Las tablas se consultan aquí; no se editan
 * por celdas. Un cambio es una propuesta de Sis2000: ajuste porcentual (a todas o a parte de las tasas) o restauración
 * de una versión anterior. Se publica al aprobarla otra persona (doble control) con su usuario de Sis2000.
 */
export function TasaCascoPanel({ cramo, soloLectura, onCambio }: { cramo: number; soloLectura?: boolean; onCambio?: () => void }) {
  const esc = useEscritura();
  const [datos, setDatos] = useState<TasaCasco | null>(null);
  const [historial, setHistorial] = useState<VersionCasco[]>([]);
  const [errorCarga, setErrorCarga] = useState<ErrorEntendible | null>(null);
  const [noDisponibleCarga, setNoDisponibleCarga] = useState(false);
  const [tabla, setTabla] = useState<'tasas' | 'factores' | 'rangos' | 'planes'>('tasas');
  const [plan, setPlan] = useState('');
  const [cober, setCober] = useState('');
  const [form, setForm] = useState<AjusteCascoForm | null>(null);
  const [intento, setIntento] = useState(false);
  const [vista, setVista] = useState<{ resumen: Fila | null; detalle: Fila[]; avisos: string[] } | null>(null);
  const [errorVista, setErrorVista] = useState<ErrorEntendible | null>(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);

  const cargar = useCallback(() => {
    setErrorCarga(null);
    setNoDisponibleCarga(false);
    api
      .leerSis2000TasaCasco(cramo)
      .then((r) => setDatos(normalizarTasaCasco(r)))
      .catch((e) => {
        setDatos(normalizarTasaCasco({}));
        if (esNoImplementado(e)) setNoDisponibleCarga(true);
        else setErrorCarga(entenderError(e, { titulo: 'No se pudo leer la tasa de casco' }));
      });
    api
      .listarSis2000VersionesCasco(cramo, 30)
      .then((r) => setHistorial(listaDe(r).map((v) => normalizarVersionCasco(v)).filter((v): v is VersionCasco => Boolean(v))))
      .catch(() => setHistorial([]));
  }, [cramo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filas = useMemo(() => (datos ? (datos[tabla] as Fila[]) : []), [datos, tabla]);
  const planes = useMemo(() => unicos(filas, 'cplan'), [filas]);
  const coberturas = useMemo(() => unicos(filas, 'ccober'), [filas]);
  const visibles = useMemo(() => filtrar(filas, plan, cober), [filas, plan, cober]);
  const columnas = useMemo(() => columnasDe(visibles), [visibles]);
  const restaurables = historial.filter((v) => v.situacion === 'HISTORICA' || v.situacion === 'VIGENTE' || v.estado === 'APLICADA');
  const puedeEscribir = !soloLectura && Boolean(datos?.versionado);
  const errores = form && intento ? validarAjusteCasco(form) : {};
  const usa = filtrosQueUsa(form?.alcance ?? 'GLOBAL');

  const alTerminar = () => {
    cargar();
    onCambio?.();
  };

  async function verVistaPrevia() {
    if (!form) return;
    setIntento(true);
    const e = validarAjusteCasco({ ...form, origen: 'AJUSTE', cusuario: form.cusuario || '1', motivo: form.motivo.padEnd(10, '.') });
    if (Object.keys(e).length) return;
    setCargandoVista(true);
    setErrorVista(null);
    try {
      const r = (await api.vistaPreviaSis2000Casco(cramo, cuerpoVistaPreviaCasco(form))) as Fila;
      setVista({
        resumen: (r.resumen as Fila) ?? null,
        detalle: listaDe(r, ['detalle', 'filas']),
        avisos: Array.isArray(r.advertencias) ? (r.advertencias as unknown[]).map(String) : [],
      });
    } catch (err) {
      setVista(null);
      setErrorVista(esNoImplementado(err) ? { ...entenderError(err), mensaje: NO_DISPONIBLE } : entenderError(err, { titulo: 'No se pudo calcular la vista previa' }));
    } finally {
      setCargandoVista(false);
    }
  }

  function proponer() {
    if (!form) return;
    setIntento(true);
    if (Object.keys(validarAjusteCasco(form)).length) return;
    const cuerpo = cuerpoVersionCasco(form);
    void esc.ejecutar(() => api.crearSis2000VersionCasco(cramo, cuerpo), {
      ok:
        datos?.requiereAprobacion === false
          ? 'Propuesta registrada y aplicada (en este ambiente no se exige aprobación).'
          : 'Propuesta registrada: queda pendiente hasta que otra persona la apruebe.',
      titulo: 'No se pudo registrar la propuesta',
      noImplementado: NO_DISPONIBLE,
      alTerminar: () => {
        setForm(null);
        setIntento(false);
        setVista(null);
        alTerminar();
      },
    });
  }

  function errorAccion(a: Accion): string | null {
    if (a.tipo === 'publicar') return errorAprobarCasco(a.version, a.cusuario);
    if (!/^\d+$/.test(a.cusuario.trim())) return 'Indica tu usuario de Sis2000 (número).';
    if (a.tipo === 'rechazar' && a.texto.trim().length < 5) return 'Explica por qué se rechaza (mínimo 5 caracteres).';
    if (a.tipo === 'cancelar' && a.texto.trim().length < 10) return 'Explica por qué se cancela (mínimo 10 caracteres).';
    return null;
  }

  function ejecutarAccion() {
    if (!accion) return;
    setAccion({ ...accion, intento: true });
    if (errorAccion(accion)) return;
    const { tipo, version } = accion;
    const cusuario = Number(accion.cusuario);
    const llamada =
      tipo === 'publicar'
        ? () => api.publicarSis2000VersionCasco(cramo, version.id, { cusuario, comentario: accion.texto.trim() || undefined })
        : tipo === 'rechazar'
          ? () => api.rechazarSis2000VersionCasco(cramo, version.id, { cusuario, comentario: accion.texto.trim() })
          : () => api.cancelarSis2000VersionCasco(cramo, version.id, { cusuario, motivo: accion.texto.trim() });
    const ok = {
      publicar: `Versión ${version.numero} aprobada: rige ${vigencia(version)}.`,
      rechazar: `Versión ${version.numero} rechazada (no se aplica).`,
      cancelar: `Versión ${version.numero} cancelada (no se aplicará).`,
    }[tipo];
    void esc.ejecutar(llamada, {
      ok,
      titulo: { publicar: 'No se pudo aprobar la versión', rechazar: 'No se pudo rechazar la versión', cancelar: 'No se pudo cancelar la versión' }[tipo],
      noImplementado: NO_DISPONIBLE,
      alTerminar: () => {
        setAccion(null);
        alTerminar();
      },
    });
  }

  const campo = (k: keyof AjusteCascoForm, etiqueta: string, ayuda: string, extra: { placeholder?: string; type?: string } = {}) =>
    form && (
      <div>
        <Label htmlFor={`casco-${k}`} className="inline-flex items-center gap-1">
          {etiqueta}
          <InfoTip text={ayuda} />
        </Label>
        <Input
          id={`casco-${k}`}
          value={String(form[k] ?? '')}
          aria-invalid={Boolean(errores[k])}
          className={cn(errores[k] && 'border-red-300')}
          onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          {...extra}
        />
        {errores[k] && <p className="mt-0.5 text-[11px] text-red-700">{errores[k]}</p>}
      </div>
    );

  return (
    <SectionPanel
      title="Tasa de casco por características"
      description="Tasas de casco según tipo, uso, suma asegurada y antigüedad del vehículo. Se cambian por versiones de Sis2000 con aprobación."
      icon={Gauge}
    >
      <div className="space-y-4 text-xs">
        <div role="note" className="alert-banner border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">Un ajuste afecta a todos los planes que calculan casco por características.</p>
            <p className="mt-1">
              Casco no es un ramo aparte: son las coberturas 1 (Amplia), 2 (Pérdida total) y 28 (Pérdida parcial) del ramo 18. Las
              versiones son globales; aquí no se edita tasa por tasa.
            </p>
          </div>
        </div>

        <AlertaError error={errorCarga} onReintentar={cargar} />
        {noDisponibleCarga && <Alert variant="info">{NO_DISPONIBLE}</Alert>}
        {datos && datos.avisos.length > 0 && (
          <Alert variant="warning">
            <ul className="list-disc space-y-0.5 pl-4">
              {datos.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Alert>
        )}
        <EstadoEscritura esc={esc} />

        {datos === null ? (
          <p className="text-slate-500">Leyendo la tasa de casco…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Dato titulo="Versión vigente">
                {datos.vigente ? (
                  <>
                    Nº {datos.vigente.numero || datos.vigente.id} · {describirVersion(datos.vigente)}
                    <span className="block text-slate-500">Rige {vigencia(datos.vigente)}</span>
                  </>
                ) : (
                  'Sin versión vigente registrada'
                )}
              </Dato>
              <Dato titulo="Aprobación">
                {datos.requiereAprobacion === false ? 'No se exige: la propuesta se aplica sola' : 'Otra persona debe aprobar cada propuesta'}
              </Dato>
              <Dato titulo="En curso">{datos.enCurso.length ? `${datos.enCurso.length} propuesta(s)` : 'Ninguna'}</Dato>
            </div>

            {datos.enCurso.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-slate-800">Propuestas en curso</p>
                <ul className="space-y-2">
                  {datos.enCurso.map((v) => (
                    <li key={v.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            Nº {v.numero || v.id} · {describirVersion(v)}{' '}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {SITUACION_CASCO[v.situacion] ?? v.situacion}
                            </span>
                          </p>
                          <p className="text-slate-600">
                            Rige {vigencia(v)} · propuesta por {v.propuestaPor || '—'}
                            {v.tasasCambiadas != null ? ` · ${v.tasasCambiadas} tasa(s)` : ''}
                          </p>
                          {v.motivo && <p className="text-slate-500">Motivo: {v.motivo}</p>}
                        </div>
                        {puedeEscribir && (
                          <div className="flex flex-wrap gap-2">
                            {v.situacion === 'PENDIENTE' && (
                              <>
                                <Button type="button" size="sm" onClick={() => setAccion({ tipo: 'publicar', version: v, cusuario: '', texto: '', intento: false })}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Aprobar y publicar
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => setAccion({ tipo: 'rechazar', version: v, cusuario: '', texto: '', intento: false })}>
                                  <XCircle className="h-3.5 w-3.5" />
                                  Rechazar
                                </Button>
                              </>
                            )}
                            {(v.situacion === 'PROGRAMADA' || v.estado === 'APROBADA') && (
                              <Button type="button" size="sm" variant="outline" onClick={() => setAccion({ tipo: 'cancelar', version: v, cusuario: '', texto: '', intento: false })}>
                                Cancelar
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {accion && accion.version.id === v.id && (
                        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                          <div>
                            <Label htmlFor="casco-acc-usuario" className="inline-flex items-center gap-1">
                              Tu usuario de Sis2000
                              <InfoTip text="Número de usuario (cusuario de seusuariosweb) con permiso en TARIFACASCO_ROL. Para aprobar debe ser otra persona que la que propuso." />
                            </Label>
                            <Input id="casco-acc-usuario" inputMode="numeric" value={accion.cusuario} onChange={(e) => setAccion({ ...accion, cusuario: e.target.value })} />
                          </div>
                          <div className="min-w-[240px] flex-1">
                            <Label htmlFor="casco-acc-texto">
                              {accion.tipo === 'publicar' ? 'Comentario (opcional)' : accion.tipo === 'rechazar' ? 'Por qué se rechaza' : 'Por qué se cancela'}
                            </Label>
                            <Input id="casco-acc-texto" value={accion.texto} onChange={(e) => setAccion({ ...accion, texto: e.target.value })} />
                          </div>
                          <Button type="button" size="sm" variant={accion.tipo === 'publicar' ? 'default' : 'destructive'} disabled={esc.trabajando} onClick={ejecutarAccion}>
                            {accion.tipo === 'publicar' ? 'Confirmar aprobación' : accion.tipo === 'rechazar' ? 'Confirmar rechazo' : 'Confirmar cancelación'}
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={esc.trabajando} onClick={() => setAccion(null)}>
                            Volver
                          </Button>
                          {accion.intento && errorAccion(accion) && <p className="w-full text-[11px] text-red-700">{errorAccion(accion)}</p>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {puedeEscribir && !form && (
              <Button type="button" size="sm" onClick={() => { setForm({ ...AJUSTE_CASCO_VACIO }); setIntento(false); setVista(null); }}>
                <FilePlus2 className="h-3.5 w-3.5" />
                Proponer un cambio de tasas
              </Button>
            )}
            {!datos.versionado && (
              <Alert variant="info">Esta base de Sis2000 no tiene el versionado de la tasa de casco: por ahora solo se consulta.</Alert>
            )}

            {form && (
              <div className="space-y-3 rounded-xl border border-dashed border-slate-300 p-3">
                <p className="font-semibold text-slate-800">Nueva propuesta</p>
                <div className="flex flex-wrap gap-4">
                  {(['AJUSTE', 'RESTAURACION'] as const).map((o) => (
                    <label key={o} className="inline-flex items-center gap-2">
                      <input type="radio" name="casco-origen" checked={form.origen === o} onChange={() => setForm({ ...form, origen: o })} />
                      {o === 'AJUSTE' ? 'Subir o bajar las tasas un porcentaje' : 'Volver a una versión anterior'}
                    </label>
                  ))}
                </div>

                {form.origen === 'AJUSTE' ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="casco-movimiento">Movimiento</Label>
                      <select id="casco-movimiento" className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm" value={form.movimiento} onChange={(e) => setForm({ ...form, movimiento: e.target.value })}>
                        <option value="INCREMENTO">Subir</option>
                        <option value="DISMINUCION">Bajar</option>
                      </select>
                    </div>
                    {campo('porcentaje', 'Porcentaje', 'Mayor que 0 y hasta 100, con 2 decimales. Una baja debe ser menor que 100.', { placeholder: '5' })}
                    <div>
                      <Label htmlFor="casco-alcance" className="inline-flex items-center gap-1">
                        A qué tasas aplica
                        <InfoTip text="Alcance del ajuste (alcance). Cada uno usa solo sus filtros." />
                      </Label>
                      <select id="casco-alcance" className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm" value={form.alcance} onChange={(e) => setForm({ ...form, alcance: e.target.value })}>
                        {Object.entries(ALCANCES_CASCO).map(([k, t]) => (
                          <option key={k} value={k}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    {usa.tipos && campo('tipos', 'Tipos de vehículo', 'Códigos separados por coma (mayores que 0).', { placeholder: '1, 2' })}
                    {usa.coberturas && campo('coberturas', 'Coberturas', '1 Amplia, 2 Pérdida total, 28 Pérdida parcial (separadas por coma).', { placeholder: '1, 28' })}
                    {usa.rangos && campo('rangos', 'Rangos de suma asegurada', 'Números de rango (crango) separados por coma.', { placeholder: '1, 2' })}
                    {usa.edad && campo('edadDesde', 'Antigüedad desde (años)', 'De -1 (vehículo del año siguiente) a 20.', { placeholder: '0' })}
                    {usa.edad && campo('edadHasta', 'Antigüedad hasta (años)', 'De -1 a 20; no menor que «desde».', { placeholder: '5' })}
                  </div>
                ) : (
                  <div className="max-w-md">
                    <Label htmlFor="casco-version">Versión a volver a aplicar</Label>
                    <select id="casco-version" className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm" value={form.versionId} onChange={(e) => setForm({ ...form, versionId: e.target.value })}>
                      <option value="">Elige…</option>
                      {restaurables.map((v) => (
                        <option key={v.id} value={v.id}>
                          Nº {v.numero || v.id} · {describirVersion(v)} · {SITUACION_CASCO[v.situacion] ?? v.situacion}
                        </option>
                      ))}
                    </select>
                    {errores.versionId && <p className="mt-0.5 text-[11px] text-red-700">{errores.versionId}</p>}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="inline-flex items-center gap-2 self-end pb-2">
                    <input type="checkbox" checked={form.rigeAlAprobar} onChange={(e) => setForm({ ...form, rigeAlAprobar: e.target.checked })} />
                    Rige el día en que se aprueba
                  </label>
                  {!form.rigeAlAprobar && campo('vigenteDesde', 'Rige desde', 'Primer día en que se aplica.', { type: 'date' })}
                  {campo('vigenteHasta', 'Rige hasta (opcional)', 'Último día en que se aplica; vacío = sin fin.', { type: 'date' })}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {campo('cusuario', 'Tu usuario de Sis2000', 'Número de usuario (cusuario) con permiso para proponer (TARIFACASCO_ROL). Otra persona deberá aprobarla.', { placeholder: '28002498' })}
                  <div className="sm:col-span-2">{campo('motivo', 'Motivo', 'Mínimo 10 caracteres; queda en Sis2000 y en el historial.')}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {form.origen === 'AJUSTE' && (
                    <Button type="button" size="sm" variant="outline" disabled={cargandoVista} onClick={() => void verVistaPrevia()}>
                      <Eye className="h-3.5 w-3.5" />
                      {cargandoVista ? 'Calculando…' : 'Ver qué cambia'}
                    </Button>
                  )}
                  <Button type="button" size="sm" disabled={esc.trabajando} onClick={proponer}>
                    <FilePlus2 className="h-3.5 w-3.5" />
                    Registrar propuesta
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setForm(null); setVista(null); }}>
                    Cancelar
                  </Button>
                </div>

                <AlertaError error={errorVista} />
                {vista && (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <p className="font-semibold">Vista previa (no se guardó nada)</p>
                    {vista.resumen && (
                      <dl className="grid gap-2 sm:grid-cols-4">
                        {Object.entries(vista.resumen).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-[11px] uppercase text-slate-500">{k.replace(/_/g, ' ')}</dt>
                            <dd className="font-semibold">{valor(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {vista.detalle.length > 0 && <TablaSoloLectura filas={vista.detalle.slice(0, 50)} />}
                    {vista.detalle.length > 50 && <p className="text-slate-500">Se muestran 50 de {vista.detalle.length} tasas.</p>}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <nav aria-label="Tablas de la tasa de casco" className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
                {(
                  [
                    ['tasas', 'Tasas por antigüedad'],
                    ['factores', 'Factores por tipo y uso'],
                    ['rangos', 'Rangos de suma'],
                    ['planes', 'Planes que la usan'],
                  ] as const
                ).map(([id, t]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTabla(id)}
                    aria-current={id === tabla ? 'page' : undefined}
                    className={cn('rounded-lg px-3 py-1.5 font-semibold', id === tabla ? 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50')}
                  >
                    {t} ({(datos[id] as Fila[]).length})
                  </button>
                ))}
              </nav>
              <div className="flex flex-wrap gap-3">
                {planes.length > 1 && (
                  <select aria-label="Plan" className="h-9 rounded-md border border-border bg-background px-2 text-xs" value={plan} onChange={(e) => setPlan(e.target.value)}>
                    <option value="">Todos los planes</option>
                    {planes.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                )}
                {coberturas.length > 1 && (
                  <select aria-label="Cobertura" className="h-9 rounded-md border border-border bg-background px-2 text-xs" value={cober} onChange={(e) => setCober(e.target.value)}>
                    <option value="">Todas las coberturas</option>
                    {coberturas.map((c) => (
                      <option key={c} value={c}>
                        {c} {NOMBRE_COBERTURA[c] ? `· ${NOMBRE_COBERTURA[c]}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {visibles.length ? (
                <>
                  <TablaSoloLectura filas={visibles.slice(0, MAX_FILAS)} columnas={columnas} />
                  {visibles.length > MAX_FILAS && <p className="text-slate-500">Se muestran {MAX_FILAS} de {visibles.length} filas: filtra por plan o cobertura.</p>}
                </>
              ) : (
                <p className="text-slate-500">No hay filas en esta tabla para el ramo {cramo}.</p>
              )}
            </div>

            {historial.length > 0 && (
              <details className="rounded-xl border border-slate-200 p-3">
                <summary className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-700">
                  <History className="h-3.5 w-3.5" />
                  Historial de versiones ({historial.length})
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5">Nº</th>
                        <th className="px-2 py-1.5">Situación</th>
                        <th className="px-2 py-1.5">Cambio</th>
                        <th className="px-2 py-1.5">Rige</th>
                        <th className="px-2 py-1.5">Propuso</th>
                        <th className="px-2 py-1.5">Revisó</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((v) => (
                        <tr key={v.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-2 py-1.5">{v.numero || v.id}</td>
                          <td className="px-2 py-1.5">{SITUACION_CASCO[v.situacion] ?? v.situacion}</td>
                          <td className="px-2 py-1.5">{describirVersion(v)}</td>
                          <td className="px-2 py-1.5">{vigencia(v)}</td>
                          <td className="px-2 py-1.5">{v.propuestaPor || '—'}</td>
                          <td className="px-2 py-1.5">{v.revisadaPor || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
        <DialogoConfirmarEscritura esc={esc} />
      </div>
    </SectionPanel>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] font-semibold uppercase text-slate-500">{titulo}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TablaSoloLectura({ filas, columnas }: { filas: Fila[]; columnas?: string[] }) {
  const cols = columnas ?? columnasDe(filas);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left">
        <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-2 py-1.5">
                {TITULOS[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {cols.map((c) => (
                <td key={c} className="px-2 py-1.5">
                  {c === 'ccober' && NOMBRE_COBERTURA[texto(f[c])] ? `${texto(f[c])} · ${NOMBRE_COBERTURA[texto(f[c])]}` : valor(f[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
