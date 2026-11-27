import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileCog, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import {
  coberturasDelPlan,
  infoSeccion,
  normalizarRamo,
  PASOS_PREVIOS_NUEVO_PLAN,
  pasosDespuesDelPlan,
  SECCIONES_BASE,
  type RamoConfigurador,
} from '@/lib/configurador';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { AppShell } from '@/components/layout/AppShell';
import { BarraPasos, type EstadoPaso } from '@/components/sis2000/AsistentePasos';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { SeccionPlan } from '@/components/configurador/SeccionPlan';
import { cn } from '@/lib/utils';
import { BandaPagina } from '@/components/ayudas/BandaPagina';

type Fila = Record<string, unknown>;
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

/**
 * Ficha del plan (/sis2000/plans/:id/configurar): una pestaña por cada sección que el ramo declara en
 * GET ramos/:cramo → secciones (no se decide por número de ramo). Con ?asistente=1 es la segunda mitad del flujo
 * «Nuevo plan»: después de guardar el plan en el asistente de planes, sigue con las secciones que faltan, en orden.
 */
export function Sis2000PlanFichaPage() {
  const { id: idParam = '' } = useParams<{ id: string }>();
  const id = decodeURIComponent(idParam);
  const cramo = Number(id.split('-')[0]);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const asistente = params.get('asistente') === '1';

  const [ramo, setRamo] = useState<RamoConfigurador | null>(null);
  const [errorRamo, setErrorRamo] = useState<ErrorEntendible | null>(null);
  const [leido, setLeido] = useState<{ plan: Fila; filas?: Record<string, Fila[]>; advertencias?: string[] } | null>(null);
  const [errorPlan, setErrorPlan] = useState<ErrorEntendible | null>(null);
  const [catalogo, setCatalogo] = useState<Fila[]>([]);
  const [cambios, setCambios] = useState(0);

  const cargarPlan = useCallback(() => {
    setErrorPlan(null);
    api
      .leerSis2000Plan(id)
      .then((r) => setLeido(r as unknown as { plan: Fila; filas?: Record<string, Fila[]>; advertencias?: string[] }))
      .catch((e) => setErrorPlan(entenderError(e, { titulo: `No se pudo leer el plan ${id}` })));
  }, [id]);

  const cargarRamo = useCallback(() => {
    if (!(cramo > 0)) return;
    setErrorRamo(null);
    api
      .leerSis2000Ramo(cramo)
      .then((r) => setRamo(normalizarRamo(r)))
      .catch((e) => setErrorRamo(entenderError(e, { titulo: 'No se pudieron leer las secciones del ramo' })));
  }, [cramo]);

  useEffect(() => {
    cargarPlan();
    cargarRamo();
    if (cramo > 0) api.listSis2000CoberturasByRamo(cramo).then(setCatalogo).catch(() => setCatalogo([]));
  }, [cargarPlan, cargarRamo, cramo]);

  // Sin GET ramos/:cramo (nest-api sin actualizar) se muestran las secciones genéricas del contrato y el error.
  const secciones = ramo?.secciones.length ? ramo.secciones : SECCIONES_BASE;
  const pasos = useMemo(() => pasosDespuesDelPlan(secciones), [secciones]);
  const visibles = asistente ? pasos : secciones;
  const pedida = params.get('seccion') ?? '';
  const seccion = visibles.includes(pedida) ? pedida : (visibles[0] ?? '');

  const plan = leido?.plan ?? null;
  const coberturas = useMemo(() => coberturasDelPlan(plan, catalogo), [plan, catalogo]);
  const filasPlanCob = useMemo(() => leido?.filas?.maplancob ?? [], [leido]);
  const moneda = txt(plan?.cmoneda) || '$';
  const familia = ramo?.familia ?? (txt((leido as { type?: unknown } | null)?.type) === 'personas' ? 'personas' : undefined);
  const cplan = txt(plan?.cplan) || id.split('-').slice(1).join('-');

  const irA = (s: string) => {
    const p = new URLSearchParams(params);
    p.set('seccion', s);
    setParams(p, { replace: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Tras guardar en cualquier panel: se vuelve a leer el plan (coberturas, cabecera) y la revisión se recalcula.
  const alCambiar = () => {
    setCambios((n) => n + 1);
    cargarPlan();
  };
  const editarPlan = `/sis2000/plans/${encodeURIComponent(id)}/edit`;
  const modoAvanzado = `/sis2000/plans/${encodeURIComponent(id)}/json`;
  /** Fianzas (o lo que nest-api marque de solo lectura): se consulta, no se edita. */
  const soloLectura = ramo?.soloLectura === true || familia === 'fianzas';

  // Barra del flujo «Nuevo plan»: los 3 primeros pasos ya se hicieron en el asistente de planes.
  const pasosBarra = [
    ...PASOS_PREVIOS_NUEVO_PLAN,
    ...pasos.map((s) => ({ id: s, titulo: infoSeccion(s).titulo, resumen: infoSeccion(s).resumen })),
  ];
  const actualBarra = PASOS_PREVIOS_NUEVO_PLAN.length + Math.max(0, pasos.indexOf(seccion));
  const estadoBarra = (i: number): EstadoPaso => (i === actualBarra ? 'actual' : i < actualBarra ? 'hecho' : 'pendiente');
  const irBarra = (i: number) => {
    if (i < PASOS_PREVIOS_NUEVO_PLAN.length) navigate(editarPlan);
    else irA(pasos[i - PASOS_PREVIOS_NUEVO_PLAN.length]);
  };
  const indicePaso = pasos.indexOf(seccion);
  /** Desde la revisión: a la pestaña si está; si es una sección fuera del paso a paso, a la ficha; si no, al plan. */
  const irSeccionRevision = (s: string) => {
    if (visibles.includes(s)) irA(s);
    else if (secciones.includes(s)) setParams(new URLSearchParams({ seccion: s }));
    else navigate(editarPlan);
  };

  return (
    <AppShell title={`Plan ${cplan}`}>
      <BandaPagina className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/sis2000/plans" className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground">
            ← Planes de Sis2000
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <FileCog className="h-5 w-5 text-primary" />
            {asistente ? 'Nuevo plan: completa la configuración' : 'Ficha del plan'} {cplan}
            {plan?.xplan ? <span className="font-normal text-muted-foreground">· {txt(plan.xplan)}</span> : null}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Ramo {cramo}
            {ramo?.xdescripcion_l ? ` (${ramo.xdescripcion_l})` : ''}
            {plan?.cproducto ? ` · producto ${txt(plan.cproducto)}` : ''}
            {asistente
              ? '. El plan ya está guardado en Sis2000; sigue los pasos para dejarlo listo para emitir.'
              : '. Cada pestaña es una parte del plan; lo que se guarda queda en el historial con lo que había antes.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!soloLectura && (
            <Link to={editarPlan} title="Abre el asistente de planes con este plan cargado: coberturas, sumas, tasas o primas, formas de pago y quién lo ofrece">
              <Button type="button" variant="outline" size="sm">
                <Pencil className="h-3.5 w-3.5" />
                Asistente de planes
              </Button>
            </Link>
          )}
          {!soloLectura && (
            <Link
              to={modoAvanzado}
              className="self-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              title="Editor del plan completo en formato técnico (JSON), solo para casos que las pestañas no cubren"
            >
              Modo avanzado (JSON)
            </Link>
          )}
          {asistente ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams({ seccion }))}>
              Ver como ficha
            </Button>
          ) : (
            pasos.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams({ asistente: '1' }))}>
                Seguir paso a paso
              </Button>
            )
          )}
        </div>
      </BandaPagina>

      <AlertaError error={errorPlan} onReintentar={cargarPlan} className="mb-3" />
      {errorRamo && (
        <AlertaError
          error={{ ...errorRamo, mensaje: `${errorRamo.mensaje} Mientras tanto se muestran las secciones comunes a todos los ramos.` }}
          onReintentar={cargarRamo}
          className="mb-3"
        />
      )}
      {soloLectura && (
        <Alert variant="info" className="mb-3">
          {familia === 'fianzas'
            ? 'Ramo de fianzas: sin flujo de emisión Nexus. La ficha solo se puede consultar.'
            : 'Este ramo es de solo lectura en el configurador.'}
        </Alert>
      )}
      {ramo && ramo.avisos.length > 0 && (
        <Alert variant="warning" className="mb-3">
          <ul className="list-disc pl-4 text-xs">
            {ramo.avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Alert>
      )}
      {leido?.advertencias && leido.advertencias.length > 0 && (
        <Alert variant="info" className="mb-3">
          <p className="font-semibold">Avisos al leer el plan:</p>
          <ul className="list-disc pl-4 text-xs">
            {leido.advertencias.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Alert>
      )}

      {asistente ? (
        <BarraPasos pasos={pasosBarra} actual={actualBarra} estado={estadoBarra} onIr={irBarra} />
      ) : (
        <nav aria-label="Secciones del plan" className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {visibles.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => irA(s)}
              aria-current={s === seccion ? 'page' : undefined}
              title={infoSeccion(s).resumen}
              className={cn(
                'whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
                s === seccion ? 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {infoSeccion(s).titulo}
            </button>
          ))}
        </nav>
      )}

      {cramo > 0 && seccion && (
        <div className="space-y-2">
          {infoSeccion(seccion).tabla && (
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              {infoSeccion(seccion).resumen}
              <InfoTip text={`En Sis2000: ${infoSeccion(seccion).tabla}.`} />
            </p>
          )}
          <SeccionPlan
            seccion={seccion}
            id={id}
            cramo={cramo}
            plan={plan}
            coberturas={coberturas}
            filasPlanCob={filasPlanCob}
            moneda={moneda}
            familia={familia}
            soloLectura={soloLectura}
            catalogo={catalogo}
            editarPlan={editarPlan}
            cambios={cambios}
            onCambio={alCambiar}
            onIrSeccion={irSeccionRevision}
          />
        </div>
      )}

      {asistente && indicePaso >= 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => (indicePaso === 0 ? navigate(editarPlan) : irA(pasos[indicePaso - 1]))}
          >
            <ArrowLeft className="h-4 w-4" />
            {indicePaso === 0 ? 'Volver a los datos del plan' : 'Atrás'}
          </Button>
          {indicePaso < pasos.length - 1 ? (
            <Button type="button" onClick={() => irA(pasos[indicePaso + 1])}>
              {pasos[indicePaso + 1] === 'revision' ? 'Revisar el plan' : `Siguiente: ${infoSeccion(pasos[indicePaso + 1]).titulo}`}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={() => setParams(new URLSearchParams({ seccion: 'revision' }))}>
              Terminar y ver la ficha
            </Button>
          )}
        </div>
      )}
    </AppShell>
  );
}
