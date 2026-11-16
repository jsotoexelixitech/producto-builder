import { AlertCircle, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ErrorEntendible } from '@/lib/errores';
import { cn } from '@/lib/utils';

/** Un error de un campo del formulario (para el resumen clicable). */
export interface ErrorDeCampo {
  /** id del input (o de un contenedor) al que lleva el clic; sin id solo se muestra. */
  id?: string;
  /** Nombre del campo, p. ej. «Suma asegurada mínima». */
  etiqueta?: string;
  mensaje: string;
  /** Sección plegada donde está el campo (se menciona en el resumen). */
  seccion?: string;
}

/**
 * Lleva el foco al campo: abre las secciones plegadas (<details>) que lo contengan, hace scroll y lo enfoca.
 * Devuelve false si el campo no está en pantalla.
 */
export function irACampo(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  let padre = el.parentElement?.closest('details');
  while (padre) {
    (padre as HTMLDetailsElement).open = true;
    padre = padre.parentElement?.closest('details') ?? null;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const enfocable = el.matches('input, select, textarea, button, [tabindex]')
    ? el
    : el.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]');
  window.setTimeout(() => enfocable?.focus({ preventScroll: true }), 250);
  return true;
}

/** Resumen arriba del formulario: cada error con su campo, clicable para ir a corregirlo. */
export function ResumenErrores({
  errores,
  titulo,
  className,
}: {
  errores: ErrorDeCampo[];
  titulo?: string;
  className?: string;
}) {
  if (!errores.length) return null;
  return (
    <div role="alert" className={cn('alert-banner border-red-200 bg-red-50 text-red-800', className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">
          {titulo ??
            (errores.length === 1 ? 'Hay 1 dato por corregir:' : `Hay ${errores.length} datos por corregir:`)}
        </p>
        <ul className="mt-1 space-y-1">
          {errores.map((e, i) => (
            <li key={`${e.id ?? 'x'}-${i}`}>
              {e.id ? (
                <button
                  type="button"
                  className="text-left underline decoration-red-300 underline-offset-2 hover:decoration-red-700"
                  onClick={() => irACampo(e.id as string)}
                >
                  {e.etiqueta && <strong>{e.etiqueta}: </strong>}
                  {e.mensaje}
                  {e.seccion && <span className="text-red-700/80"> (en «{e.seccion}»)</span>}
                </button>
              ) : (
                <>
                  {e.etiqueta && <strong>{e.etiqueta}: </strong>}
                  {e.mensaje}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Error del servidor ya traducido (lib/errores): mensaje claro, campos rechazados (clicables si hay id),
 * «Reintentar» cuando tiene sentido y «Ver detalle técnico» plegado para soporte. También acepta un texto simple.
 */
export function AlertaError({
  error,
  titulo,
  onReintentar,
  reintentando,
  idDeCampo,
  onIrCampo = irACampo,
  className,
}: {
  error: ErrorEntendible | string | null | undefined;
  /** Qué falló, p. ej. «No se pudo crear la cobertura». */
  titulo?: string;
  onReintentar?: () => void;
  reintentando?: boolean;
  /** Propiedad del DTO → id del input, para que los campos rechazados lleven al campo. */
  idDeCampo?: (propiedad: string, indice?: number) => string | undefined;
  /** Cómo llegar al campo (p. ej. cambiar de paso antes); por defecto irACampo. */
  onIrCampo?: (id: string) => void;
  className?: string;
}) {
  if (!error) return null;
  const e: ErrorEntendible =
    typeof error === 'string'
      ? { tipo: 'servidor', mensaje: error, campos: [], reintentable: false, detalle: { crudo: '' } }
      : error;
  const tecnico = typeof error !== 'string' && (e.detalle.status !== undefined || e.detalle.endpoint || e.detalle.crudo);
  return (
    <div role="alert" className={cn('alert-banner border-red-200 bg-red-50 text-red-800', className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        {(titulo ?? e.titulo) && <p className="font-semibold">{titulo ?? e.titulo}</p>}
        <p>{e.mensaje}</p>
        {e.campos.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {e.campos.map((c, i) => {
              const id = idDeCampo?.(c.propiedad, c.indice);
              return (
                <li key={`${c.propiedad}-${i}`}>
                  {id ? (
                    <button type="button" className="text-left underline underline-offset-2" onClick={() => onIrCampo(id)}>
                      {c.mensaje}
                    </button>
                  ) : (
                    c.mensaje
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {onReintentar && e.reintentable && (
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onReintentar} disabled={reintentando}>
            <RefreshCw className={cn('h-3.5 w-3.5', reintentando && 'animate-spin')} />
            {reintentando ? 'Reintentando…' : 'Reintentar'}
          </Button>
        )}
        {tecnico && (
          <details className="group mt-2 text-xs">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-red-700/80">
              Ver detalle técnico
              <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="mt-1 space-y-0.5 rounded-lg bg-white/70 p-2 font-mono text-[11px] text-slate-700">
              {e.detalle.status !== undefined && (
                <div>
                  <dt className="inline font-semibold">Código: </dt>
                  <dd className="inline">{e.detalle.status === 0 ? '0 (sin conexión)' : e.detalle.status}</dd>
                </div>
              )}
              {e.detalle.endpoint && (
                <div>
                  <dt className="inline font-semibold">Llamada: </dt>
                  <dd className="inline break-all">{e.detalle.endpoint}</dd>
                </div>
              )}
              <div>
                <dt className="inline font-semibold">Respuesta: </dt>
                <dd className="inline break-words">{e.detalle.crudo}</dd>
              </div>
            </dl>
          </details>
        )}
      </div>
    </div>
  );
}
