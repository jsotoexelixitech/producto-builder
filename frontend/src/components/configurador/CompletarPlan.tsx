import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  coberturasDelPlan,
  infoSeccion,
  normalizarRamo,
  normalizarRevision,
  type RamoConfigurador,
  type RevisionPlan,
} from '@/lib/configurador';
import type { GrupoCompletar } from '@/lib/configurador-combo';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { InfoTip } from '@/components/ui/info-tip';
import { SeccionPlan } from '@/components/configurador/SeccionPlan';

type Fila = Record<string, unknown>;
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

/**
 * Datos para completar un plan sin salir del Combo: secciones y familia del ramo (GET ramos/:cramo, la misma fuente que
 * la ficha), el plan leído de Sis2000, el catálogo de coberturas y la revisión «¿se puede emitir?» (solo para el estado
 * de cada paso). El ramo se lee en cuanto hay ramo (para mostrar los pasos bloqueados); el resto, cuando el plan existe.
 */
export function usePlanCompletar(cramo: number, planId: string | null) {
  const [ramo, setRamo] = useState<RamoConfigurador | null>(null);
  const [errorRamo, setErrorRamo] = useState<ErrorEntendible | null>(null);
  const [leido, setLeido] = useState<{ plan: Fila; filas?: Record<string, Fila[]> } | null>(null);
  const [errorPlan, setErrorPlan] = useState<ErrorEntendible | null>(null);
  const [catalogo, setCatalogo] = useState<Fila[]>([]);
  const [revision, setRevision] = useState<RevisionPlan | null>(null);
  const [cambios, setCambios] = useState(0);

  const cargarRamo = useCallback(() => {
    if (!(cramo > 0)) return;
    setErrorRamo(null);
    let vigente = true;
    api
      .leerSis2000Ramo(cramo)
      .then((r) => vigente && setRamo(normalizarRamo(r ?? {})))
      .catch((e) => vigente && setErrorRamo(entenderError(e, { titulo: 'No se pudieron leer las secciones del ramo' })));
    return () => {
      vigente = false;
    };
  }, [cramo]);

  useEffect(() => {
    setRamo(null);
    return cargarRamo();
  }, [cargarRamo]);

  const cargarPlan = useCallback(() => {
    if (!planId) return;
    setErrorPlan(null);
    api
      .leerSis2000Plan(planId)
      .then((r) => setLeido(r as unknown as { plan: Fila; filas?: Record<string, Fila[]> }))
      .catch((e) => setErrorPlan(entenderError(e, { titulo: `No se pudo leer el plan ${planId}` })));
    // Sin dato de la revisión (endpoint caído) el estado de los pasos queda en visitado / sin visitar.
    api
      .revisarSis2000Plan(planId)
      .then((r) => setRevision(normalizarRevision(r)))
      .catch(() => setRevision(null));
  }, [planId]);

  useEffect(() => {
    setLeido(null);
    setRevision(null);
    cargarPlan();
  }, [cargarPlan]);

  useEffect(() => {
    if (!planId || !(cramo > 0)) {
      setCatalogo([]);
      return;
    }
    api.listSis2000CoberturasByRamo(cramo).then(setCatalogo).catch(() => setCatalogo([]));
  }, [planId, cramo]);

  /** Tras guardar en cualquier panel: se vuelve a leer el plan y la revisión se recalcula. */
  const alCambiar = useCallback(() => {
    setCambios((n) => n + 1);
    cargarPlan();
  }, [cargarPlan]);

  return { ramo, errorRamo, cargarRamo, leido, errorPlan, catalogo, revision, cambios, alCambiar, cargarPlan };
}

export type PlanCompletar = ReturnType<typeof usePlanCompletar>;

/**
 * Pasos de «completar el plan»: cada grupo muestra, uno tras otro, los paneles de sus secciones (los mismos de la
 * ficha). Un grupo se monta al abrirlo por primera vez y se queda montado (oculto) para no perder lo escrito.
 */
export function CompletarPlan({
  grupos,
  activo,
  visitados,
  planId,
  cramo,
  datos,
  onIrSeccion,
}: {
  grupos: GrupoCompletar[];
  /** Id del grupo abierto (null = ninguno: se está en los pasos del combo). */
  activo: string | null;
  visitados: ReadonlySet<string>;
  planId: string | null;
  cramo: number;
  datos: PlanCompletar;
  onIrSeccion: (seccion: string) => void;
}) {
  const { ramo, leido, errorPlan, catalogo, cambios, alCambiar, cargarPlan } = datos;
  const plan = leido?.plan ?? null;
  const coberturas = useMemo(() => coberturasDelPlan(plan, catalogo), [plan, catalogo]);
  const filasPlanCob = useMemo(() => leido?.filas?.maplancob ?? [], [leido]);
  const familia = ramo?.familia ?? (txt((leido as { type?: unknown } | null)?.type) === 'personas' ? 'personas' : undefined);
  const soloLectura = ramo?.soloLectura === true || familia === 'fianzas';
  const moneda = txt(plan?.cmoneda) || '$';
  const editarPlan = planId ? `/sis2000/plans/${encodeURIComponent(planId)}/edit` : '';

  if (!planId) return null;
  return (
    <div data-completar>
      <AlertaError error={errorPlan} onReintentar={cargarPlan} className="mb-3" />
      {soloLectura && (
        <Alert variant="info" className="mb-3">
          {familia === 'fianzas'
            ? 'Ramo de fianzas: sin flujo de emisión Nexus. Solo se puede consultar.'
            : 'Este ramo es de solo lectura en el configurador.'}
        </Alert>
      )}
      {grupos.map((g) => {
        if (!visitados.has(g.id) && activo !== g.id) return null;
        return (
          <div key={g.id} hidden={activo !== g.id} data-grupo={g.id} className="space-y-6">
            {g.secciones.map((s) => {
              const info = infoSeccion(s);
              return (
                <section key={s} className="space-y-2" aria-label={info.titulo}>
                  {g.secciones.length > 1 && (
                    <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
                      {info.titulo}
                      {info.afectaRamo && <InsigniaRamo />}
                    </h2>
                  )}
                  <AyudaSeccion seccion={s} conInsignia={g.secciones.length === 1} />
                  {plan || errorPlan ? (
                    <SeccionPlan
                      seccion={s}
                      id={planId}
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
                      onIrSeccion={onIrSeccion}
                    />
                  ) : (
                    <p className="text-xs text-slate-500">Leyendo el plan…</p>
                  )}
                </section>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function InsigniaRamo() {
  return (
    <span
      className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
      title="Lo que guardes aquí vale para todos los planes del ramo, no solo para este"
    >
      Afecta a todo el ramo
    </span>
  );
}

/** Qué es, para qué sirve y un ejemplo; el nombre de la tabla va solo en el tooltip. */
function AyudaSeccion({ seccion, conInsignia }: { seccion: string; conInsignia: boolean }) {
  const info = infoSeccion(seccion);
  if (!info.ayuda && !info.resumen) return null;
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs text-sky-950">
      <p className="flex flex-wrap items-center gap-1">
        {conInsignia && info.afectaRamo && <InsigniaRamo />}
        <span>{info.ayuda ?? info.resumen}</span>
        {info.tabla && <InfoTip text={`En Sis2000: ${info.tabla}.`} />}
      </p>
      {info.ejemplo && (
        <p className="mt-1 text-sky-900">
          <span className="font-semibold">Ejemplo: </span>
          {info.ejemplo}
        </p>
      )}
    </div>
  );
}
