import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, History, Pencil, X } from 'lucide-react';
import {
  avisosCobertura,
  datosCobertura,
  fechaLegible,
  resumenTarifas,
  type CoberturaEnPlan,
  type ResumenTarifa,
  type TasaVigencia,
} from '@/lib/cobertura-ficha';
import { textoDeducible } from '@/lib/configurador';
import { claveHistorial } from '@/lib/sis2000-historial';
import type { ErrorEntendible } from '@/lib/errores';
import { HistorialPanel } from '@/components/sis2000/HistorialPanel';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { cn } from '@/lib/utils';
import { CoberturaEditor } from './CoberturaEditor';
import { DetalleTarifaEditor } from './DetalleTarifaEditor';

type Fila = Record<string, unknown>;

const monto = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tasaTxt = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('es-VE', { maximumFractionDigits: 6 })} %`);
const numTxt = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) ? n : null;
};

/** Errores que dejan el panel en solo lectura: escritura apagada en el ambiente (403 bandera) o sin permiso. */
const apagaEscritura = (e: ErrorEntendible) => e.tipo === 'no-disponible' || e.tipo === 'permiso';

type Edicion = { tipo: 'cobertura' } | { tipo: 'tasa'; ctarifa: string } | null;

/**
 * Panel lateral «Ver / editar» de una cobertura del ramo dentro del asistente de planes: datos de la cobertura,
 * sus tarifas con la tasa vigente y el historial, lo que el plan tiene armado para ella y avisos. Edita la cobertura
 * y la tasa vigente en el mismo panel (con confirmación; lo anterior queda en el historial) sin salir del asistente.
 */
export function CoberturaFichaPanel({
  cramo,
  cobertura,
  tarifas,
  cargandoTarifas,
  errorTarifas,
  calculada,
  textoCalculada,
  personas,
  enPlan,
  soloLectura,
  onCerrar,
  onCambio,
}: {
  cramo: number;
  cobertura: Fila;
  /** Tarifas ya leídas por el asistente (null = todavía no). */
  tarifas: Fila[] | null;
  cargandoTarifas: boolean;
  errorTarifas?: string;
  /** Suma calculada al emitir (configuración del builder). */
  calculada: boolean;
  textoCalculada?: string;
  personas: boolean;
  enPlan: CoberturaEnPlan | null;
  /** Ramo de solo lectura (fianzas u otro que nest-api marque): no se muestran acciones de escritura. */
  soloLectura: boolean;
  onCerrar: () => void;
  /** Tras guardar: el asistente vuelve a leer la cobertura o sus tarifas. */
  onCambio: (que: 'cobertura' | 'tarifas') => void;
}) {
  const hoy = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const c = datosCobertura(cobertura);
  const moneda = c.moneda || '$';
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [errorEscritura, setErrorEscritura] = useState<ErrorEntendible | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [versionHistorial, setVersionHistorial] = useState(0);
  const lectura = soloLectura || Boolean(errorEscritura);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const actual = useRef(onCerrar);
  actual.current = onCerrar;

  const resumen = useMemo(() => (tarifas ? resumenTarifas(tarifas, hoy, c.ccobertura) : []), [tarifas, hoy, c.ccobertura]);
  const avisos = useMemo(
    () => avisosCobertura({ cobertura, tarifas, hoy, calculada, personas }),
    [cobertura, tarifas, hoy, calculada, personas],
  );

  useEffect(() => {
    cerrarRef.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      // Con un diálogo de confirmación abierto encima, Escape lo cierra a él y no al panel.
      if (e.key === 'Escape' && document.querySelectorAll('[aria-modal="true"]').length <= 1) actual.current();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  function alError(e: ErrorEntendible) {
    if (apagaEscritura(e)) {
      setErrorEscritura(e);
      setEdicion(null);
    }
  }

  function guardado(que: 'cobertura' | 'tarifas', mensaje: string) {
    setEdicion(null);
    setOk(mensaje);
    setVersionHistorial((n) => n + 1);
    onCambio(que);
  }

  const base = `/sis2000/ramo/${cramo}/coberturas/${encodeURIComponent(c.ccobertura)}`;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Cobertura ${c.nombreLargo || c.ccobertura}`}
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cobertura del ramo {cramo}</p>
            <h2 className="font-display text-base font-bold text-slate-900">{c.nombreLargo || 'Cobertura sin nombre'}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant={c.activa ? 'approved' : 'draft'} className="px-2 py-0 text-[10px]">
                {c.activa ? 'Activa' : 'Inactiva'}
              </Badge>
              {enPlan?.delPlan && <Badge variant="submitted" className="px-2 py-0 text-[10px]">Ya en el plan</Badge>}
              {enPlan?.incluida && !enPlan.delPlan && <Badge variant="submitted" className="px-2 py-0 text-[10px]">Marcada en este plan</Badge>}
              {calculada && <Badge variant="actuarial" className="px-2 py-0 text-[10px]">Suma calculada al emitir</Badge>}
            </div>
          </div>
          <Button ref={cerrarRef} type="button" variant="outline" size="sm" onClick={onCerrar} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          {soloLectura && <Alert variant="info">Este ramo es de solo consulta en el configurador: aquí no se edita.</Alert>}
          {errorEscritura && (
            <AlertaError error={errorEscritura} titulo="Por ahora solo se puede consultar" />
          )}
          {ok && <Alert variant="success">{ok}</Alert>}

          {avisos.length > 0 && (
            <div className="space-y-1.5" aria-label="Avisos de la cobertura">
              {avisos.map((a) => (
                <p
                  key={a.texto}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
                    a.nivel === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900',
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {a.texto}
                </p>
              ))}
            </div>
          )}

          {/* ── Cobertura ── */}
          <Seccion
            titulo="Cobertura"
            ayuda={'Datos de la cobertura en el ramo. Los comparten todos los productos y planes del ramo: un cambio aquí se ve en todos.\nEn Sis2000: macoberturas'}
            acciones={
              <>
                {!lectura && edicion?.tipo !== 'cobertura' && (
                  <Button type="button" size="sm" variant="outline" onClick={() => { setOk(null); setEdicion({ tipo: 'cobertura' }); }}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar cobertura
                  </Button>
                )}
                <EnlaceNuevaPestana to={`${base}/edit`}>Abrir en pantalla completa</EnlaceNuevaPestana>
              </>
            }
          >
            {edicion?.tipo === 'cobertura' ? (
              <CoberturaEditor
                cramo={cramo}
                fila={cobertura}
                onCancelar={() => setEdicion(null)}
                onError={alError}
                onGuardado={() => guardado('cobertura', 'Cobertura guardada (lo anterior quedó en el historial).')}
              />
            ) : (
              <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                <Dato titulo="Nombre" valor={c.nombreLargo} />
                <Dato titulo="Nombre corto" valor={c.nombreCorto} />
                <Dato titulo="Abreviatura" valor={c.abreviatura} />
                <Dato titulo="Moneda" valor={c.moneda} />
                <Dato
                  titulo="Obligatoria"
                  valor={resumen.find((t) => t.vigente) ? (resumen.find((t) => t.vigente)!.obligatoria ? 'Sí' : 'No, es opcional') : c.obligatoria == null ? '' : c.obligatoria ? 'Sí' : 'No'}
                  ayuda={'Obligatoria u opcional no se decide en el plan: sale de la tarifa vigente de la cobertura en el ramo y vale para todos los planes que la usan. Las obligatorias van siempre en la póliza.\nEn Sis2000: matarifa.bobligatoria'}
                />
                <Dato
                  titulo="Suma asegurada"
                  valor={calculada ? textoCalculada || 'Calculada al emitir' : 'Fija (la del plan)'}
                  ayuda="Fija: la suma la pone el plan. Calculada: se obtiene al emitir con las unidades que indique el asegurado (por ejemplo, kilos × precio por kilo). Se guarda en el configurador, no en Sis2000."
                />
                <Dato
                  titulo="Reaseguro"
                  valor={c.contratoReaseguro == null ? '' : `Contrato ${c.contratoReaseguro}${c.ramoReaseguro != null ? ` · ramo ${c.ramoReaseguro}` : ''}`}
                  vacio="Sin contrato"
                  ayuda={'Contrato y ramo de reaseguro con los que se cede el riesgo de esta cobertura al emitir. Sin contrato, la revisión del plan lo marca como pendiente.\nEn Sis2000: macoberturas.ccontrea · macoberturas.cramorea'}
                />
                <Dato
                  titulo="Equivalencia interna"
                  valor={c.coberturaInterna == null && c.ramoInterno == null ? '' : `Cobertura ${c.coberturaInterna ?? '—'} del ramo ${c.ramoInterno ?? '—'}`}
                  vacio="No tiene"
                  ayuda={'Cobertura «modelo» a la que equivale esta en el cálculo. En auto, si el ramo no es el 18, debe apuntar a la equivalente del ramo 18 o se calcula con la fórmula general; las equivalentes a 15 y 17 (RCV) se cobran completas en la 1ª cuota cuando el pago es fraccionado.\nEn Sis2000: macoberturas.ccoberturaint · macoberturas.cramoint'}
                />
                <Dato titulo="Código" valor={c.ccobertura} />
              </dl>
            )}
            <div className="mt-3">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setVerHistorial((v) => !v)}
              >
                <History className="h-3.5 w-3.5" />
                {verHistorial ? 'Ocultar historial de cambios' : 'Ver historial de cambios de la cobertura'}
              </button>
              {verHistorial && (
                <HistorialPanel
                  className="mt-2"
                  entidad="COBERTURA"
                  clave={claveHistorial.cobertura(cramo, c.ccobertura)}
                  recargar={versionHistorial}
                  onRestaurado={() => onCambio('cobertura')}
                />
              )}
            </div>
          </Seccion>

          {/* ── Tarifas ── */}
          <Seccion
            titulo="Tarifas"
            ayuda={'Tarifas de la cobertura en el ramo y sus tasas o primas. Cada tarifa debe tener una sola tasa vigente: cotización y emisión toman la vigente y no miran sus fechas. Tasa = % sobre la suma asegurada; prima fija = monto; son excluyentes.\nEn Sis2000: matarifa · matarifa_d'}
            acciones={<EnlaceNuevaPestana to={`${base}/tarifas`}>Abrir sus tarifas</EnlaceNuevaPestana>}
          >
            {cargandoTarifas && <p className="text-xs text-muted-foreground">Leyendo sus tarifas…</p>}
            {errorTarifas && <Alert variant="error">No se pudieron leer sus tarifas: {errorTarifas}</Alert>}
            {!cargandoTarifas && !errorTarifas && tarifas && !resumen.length && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No tiene tarifas.{' '}
                <EnlaceNuevaPestana to={`${base}/tarifas/new`}>Crear una tarifa</EnlaceNuevaPestana>
              </p>
            )}
            <div className="space-y-3">
              {resumen.map((t) => (
                <TarjetaTarifa
                  key={t.ctarifa}
                  t={t}
                  cramo={cramo}
                  ccobertura={c.ccobertura}
                  moneda={moneda}
                  base={base}
                  enPlan={enPlan?.incluida ? enPlan.ctarifa : ''}
                  lectura={lectura}
                  editando={edicion?.tipo === 'tasa' && edicion.ctarifa === t.ctarifa}
                  onEditar={() => {
                    setOk(null);
                    setEdicion({ tipo: 'tasa', ctarifa: t.ctarifa });
                  }}
                  onCancelar={() => setEdicion(null)}
                  onError={alError}
                  onGuardado={() => guardado('tarifas', `Tasa de la tarifa ${t.ctarifa} guardada (lo anterior quedó en el historial).`)}
                />
              ))}
            </div>
          </Seccion>

          {/* ── En este plan ── */}
          <Seccion titulo="En este plan" ayuda="Lo que el asistente tiene armado para esta cobertura en este plan (tarifa, suma y tasa o prima). Solo aplica a este plan; se cambia en el paso «Tarifas y tasas».">
            {!enPlan?.incluida ? (
              <p className="text-xs text-muted-foreground">No está marcada en este plan.</p>
            ) : (
              <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                <Dato titulo="Tarifa usada" valor={enPlan.ctarifa} />
                <Dato titulo="Obligatoria en el plan" valor={enPlan.obligatoria ? 'Sí' : 'No, es opcional'} />
                {personas ? (
                  <>
                    <Dato titulo="Suma por persona" valor={numTxt(enPlan.msumamax) == null ? '' : `${moneda} ${monto(numTxt(enPlan.msumamax))}`} />
                    <Dato titulo="Prima fija por persona" valor={numTxt(enPlan.mprima) == null ? '' : `${moneda} ${monto(numTxt(enPlan.mprima))}`} />
                    <Dato titulo="Tabla de tasas por edad" valor={enPlan.ctablatar || 'La del plan'} />
                  </>
                ) : calculada ? (
                  <Dato titulo="Suma asegurada" valor={textoCalculada || 'Calculada al emitir'} />
                ) : (
                  <>
                    <Dato titulo="Suma mínima" valor={numTxt(enPlan.msumamin) == null ? '' : `${moneda} ${monto(numTxt(enPlan.msumamin))}`} />
                    <Dato titulo="Suma máxima" valor={numTxt(enPlan.msumamax) == null ? '' : `${moneda} ${monto(numTxt(enPlan.msumamax))}`} />
                    {enPlan.modo === 'tasa' ? (
                      <Dato titulo="Tasa" valor={numTxt(enPlan.pprima) == null ? '' : tasaTxt(numTxt(enPlan.pprima))} />
                    ) : (
                      <Dato titulo="Prima fija" valor={numTxt(enPlan.mprima) == null ? '' : `${moneda} ${monto(numTxt(enPlan.mprima))}`} />
                    )}
                  </>
                )}
              </dl>
            )}
          </Seccion>
        </div>
      </aside>
    </div>
  );
}

function TarjetaTarifa({
  t,
  cramo,
  ccobertura,
  moneda,
  base,
  enPlan,
  lectura,
  editando,
  onEditar,
  onCancelar,
  onError,
  onGuardado,
}: {
  t: ResumenTarifa;
  cramo: number;
  ccobertura: string;
  moneda: string;
  base: string;
  enPlan: string;
  lectura: boolean;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onError: (e: ErrorEntendible) => void;
  onGuardado: () => void;
}) {
  const ruta = `${base}/tarifas/${encodeURIComponent(t.ctarifa)}`;
  const a = t.actual;
  return (
    <div className={cn('rounded-xl border p-3', t.vigente ? 'border-border/70' : 'border-dashed border-border/60 bg-muted/20')}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold text-slate-800">
          Tarifa {t.ctarifa}
          {t.nombre && <span className="font-normal text-muted-foreground"> · {t.nombre}</span>}
        </p>
        <Badge variant={t.vigente ? 'approved' : 'draft'} className="px-2 py-0 text-[10px]">
          {t.vigente ? 'Vigente' : 'Inactiva'}
        </Badge>
        <Badge variant={t.obligatoria ? 'submitted' : 'default'} className="px-2 py-0 text-[10px]">
          {t.obligatoria ? 'Obligatoria' : 'Opcional'}
        </Badge>
        {enPlan && enPlan === t.ctarifa && <Badge variant="actuarial" className="px-2 py-0 text-[10px]">La usa este plan</Badge>}
        <span className="ml-auto flex flex-wrap gap-3">
          <EnlaceNuevaPestana to={`${ruta}/edit`}>Editar tarifa</EnlaceNuevaPestana>
          <EnlaceNuevaPestana to={`${ruta}/detalles`}>Todas sus tasas</EnlaceNuevaPestana>
        </span>
      </div>

      {!a ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Sin tasas cargadas. <EnlaceNuevaPestana to={`${ruta}/detalles/new`}>Cargar una tasa</EnlaceNuevaPestana>
        </p>
      ) : editando ? (
        <div className="mt-2">
          <DetalleTarifaEditor
            cramo={cramo}
            ccober={ccobertura}
            ctarifa={t.ctarifa}
            detalle={a.fila}
            moneda={moneda}
            confirmar
            onCancelar={onCancelar}
            onError={onError}
            onGuardado={onGuardado}
          />
        </div>
      ) : (
        <>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.actualVigenteHoy ? 'Tasa vigente' : 'Última tasa (no vigente hoy)'}
          </p>
          <ResumenTasa tasa={a} moneda={moneda} />
          {!lectura && t.vigente && (
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onEditar}>
              <Pencil className="h-3.5 w-3.5" />
              {t.actualVigenteHoy ? 'Editar tasa vigente' : 'Editar última tasa'}
            </Button>
          )}
        </>
      )}

      {t.historial.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium text-primary">
            Historial de tasas ({t.historial.filter((h) => h.activa).length} activas · {t.historial.filter((h) => !h.activa).length} inactivas)
          </summary>
          <ul className="mt-2 space-y-2">
            {t.historial.map((h) => (
              <li key={`${h.fdesde}-${h.fhasta}-${h.activa}`} className={cn('rounded-lg border border-border/50 p-2', !h.activa && 'opacity-70')}>
                <span className="mb-1 inline-block">
                  <Badge variant={h.activa ? 'default' : 'draft'} className="px-2 py-0 text-[10px]">
                    {h.activa ? 'Activa' : 'Inactiva'}
                  </Badge>
                </span>
                <ResumenTasa tasa={h} moneda={moneda} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ResumenTasa({ tasa, moneda }: { tasa: TasaVigencia; moneda: string }) {
  return (
    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
      <Dato titulo="Tasa" valor={tasa.tasa ? tasaTxt(tasa.tasa) : ''} vacio="Sin tasa" />
      <Dato titulo="Prima fija" valor={tasa.prima ? `${moneda} ${monto(tasa.prima)}` : ''} vacio="Sin prima fija" />
      <Dato titulo="Vigencia" valor={`Desde ${fechaLegible(tasa.fdesde) || '—'}${tasa.fhasta ? ` hasta ${fechaLegible(tasa.fhasta)}` : ' (sin fecha de fin)'}`} />
      <Dato titulo="Suma mínima" valor={tasa.sumaMin == null ? '' : `${moneda} ${monto(tasa.sumaMin)}`} />
      <Dato titulo="Suma máxima" valor={tasa.sumaMax ? `${moneda} ${monto(tasa.sumaMax)}` : ''} vacio="Vacía" />
      <Dato titulo="Deducible" valor={textoDeducible(tasa.deducible, moneda)} ayuda={'Monto o porcentaje que asume el asegurado en cada siniestro (deducible) o tope bajo el cual no se paga (franquicia). Lo lee la emisión desde la tasa vigente.\nEn Sis2000: matarifa_d.bfraded · mdedu_fran · mdedu_franext · pdedu_fran'} />
    </dl>
  );
}

function Seccion({ titulo, ayuda, acciones, children }: { titulo: string; ayuda?: string; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-border/50 pb-1.5">
        <h3 className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          {titulo}
          {ayuda && <InfoTip text={ayuda} />}
        </h3>
        {acciones && <div className="ml-auto flex flex-wrap items-center gap-3">{acciones}</div>}
      </div>
      {children}
    </section>
  );
}

function Dato({ titulo, valor, vacio = '—', ayuda }: { titulo: string; valor: string; vacio?: string; ayuda?: string }) {
  return (
    <div>
      <dt className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        {titulo}
        {ayuda && <InfoTip text={ayuda} />}
      </dt>
      <dd className={cn('font-medium text-slate-800', !valor && 'font-normal text-muted-foreground')}>{valor || vacio}</dd>
    </div>
  );
}

/** Abre la pantalla completa en otra pestaña para no perder lo armado en el asistente. */
function EnlaceNuevaPestana({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </Link>
  );
}
