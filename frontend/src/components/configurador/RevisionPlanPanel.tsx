import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import {
  contarRevision,
  infoSeccion,
  normalizarRevision,
  ordenarRevision,
  type NivelRevision,
  type RevisionPlan,
} from '@/lib/configurador';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { SectionPanel } from '@/components/ui/section-panel';
import { cn } from '@/lib/utils';
import { CargandoModerna } from '@/components/ayudas/CargandoModerna';

const ESTILO: Record<NivelRevision, { icono: typeof AlertCircle; clase: string; texto: string }> = {
  error: { icono: AlertCircle, clase: 'border-red-200 bg-red-50 text-red-800', texto: 'Impide emitir' },
  aviso: { icono: AlertTriangle, clase: 'border-amber-200 bg-amber-50 text-amber-900', texto: 'Revisar' },
  ok: { icono: CheckCircle2, clase: 'border-emerald-200 bg-emerald-50 text-emerald-800', texto: 'Bien' },
};

/**
 * Revisión «¿se puede emitir?» del plan (solo lectura, nest-api). Semáforo: rojo impide emitir, ámbar conviene
 * revisarlo, verde está bien. Cada punto lleva a la sección donde se corrige.
 */
export function RevisionPlanPanel({
  planId,
  onIrSeccion,
  recargar = 0,
}: {
  /** "cramo-cplan". */
  planId: string;
  /** Lleva a la sección (las mismas claves que `secciones` del ramo). */
  onIrSeccion?: (seccion: string) => void;
  /** Cambiar este número vuelve a revisar (p. ej. después de guardar algo). */
  recargar?: number;
}) {
  const [revision, setRevision] = useState<RevisionPlan | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [verOk, setVerOk] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    api
      .revisarSis2000Plan(planId)
      .then((r) => setRevision(normalizarRevision(r)))
      .catch((e) => setError(entenderError(e, { titulo: 'No se pudo revisar el plan' })))
      .finally(() => setCargando(false));
  }, [planId]);

  useEffect(() => {
    cargar();
  }, [cargar, recargar]);

  const cuenta = revision ? contarRevision(revision.items) : null;
  const items = revision ? ordenarRevision(revision.items).filter((i) => verOk || i.nivel !== 'ok') : [];

  return (
    <SectionPanel title="Revisión del plan" description="Revisa, sin cambiar nada, si el plan tiene todo para emitirse: producto, tarifas con una sola tasa vigente, reaseguro, comisiones, formas de pago y quién lo vende. En rojo lo que impide emitir; en ámbar, avisos. Pulsa un punto para ir a corregirlo." icon={ClipboardCheck}>
      <div className="space-y-4 text-xs">
        <AlertaError error={error} onReintentar={cargar} />
        {revision && cuenta && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm',
              revision.listo ? ESTILO.ok.clase : cuenta.error ? ESTILO.error.clase : ESTILO.aviso.clase,
            )}
          >
            {revision.listo ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <p className="flex-1 font-bold">
              {revision.listo ? 'El plan está listo para emitir.' : cuenta.error ? 'El plan todavía no se puede emitir.' : 'El plan se puede emitir, pero hay avisos.'}
            </p>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">{cuenta.error} por corregir</span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">{cuenta.aviso} avisos</span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">{cuenta.ok} bien</span>
          </div>
        )}
        {cargando && !revision && <CargandoModerna texto="Revisando el plan…" clasica={<p className="text-slate-500">Revisando el plan…</p>} />}

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((i, n) => {
              const e = ESTILO[i.nivel];
              const Icono = e.icono;
              const seccion = infoSeccion(i.seccion);
              return (
                <li key={`${i.codigo}-${n}`}>
                  <button
                    type="button"
                    disabled={!onIrSeccion || !i.seccion}
                    onClick={() => i.seccion && onIrSeccion?.(i.seccion)}
                    className={cn('flex w-full items-start gap-2 rounded-xl border p-3 text-left transition-colors hover:brightness-[0.98] disabled:cursor-default', e.clase)}
                    title={i.codigo ? `Código de la revisión: ${i.codigo}` : undefined}
                  >
                    <Icono className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      <span className="font-semibold">{e.texto}: </span>
                      {i.mensaje}
                    </span>
                    {i.seccion && <span className="shrink-0 text-[11px] underline underline-offset-2">Ir a «{seccion.titulo}»</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={cargando}>
            <RefreshCw className={cn('h-3.5 w-3.5', cargando && 'animate-spin')} />
            Volver a revisar
          </Button>
          {cuenta && cuenta.ok > 0 && (
            <label className="inline-flex items-center gap-2 text-slate-600">
              <input type="checkbox" checked={verOk} onChange={(e) => setVerOk(e.target.checked)} />
              Ver también lo que está bien ({cuenta.ok})
            </label>
          )}
        </div>
      </div>
    </SectionPanel>
  );
}
