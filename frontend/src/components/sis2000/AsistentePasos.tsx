import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, HelpCircle, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Piezas del asistente por pasos del configurador (Combos de coberturas y edición de planes).
// Misma identidad visual del builder: tarjetas blancas, borde slate, acento índigo.

export interface PasoAsistente {
  id: string;
  titulo: string;
  /** Una línea: qué se hace en el paso. */
  resumen: string;
  /** Estado corto bajo el título (p. ej. «Falta», «Hecho»). */
  etiqueta?: string;
  /** Color de la etiqueta. */
  tono?: 'bien' | 'falta' | 'aviso';
  /** Texto del paso bloqueado (por defecto: completar los pasos anteriores). */
  bloqueo?: string;
}

export type EstadoPaso = 'actual' | 'hecho' | 'pendiente' | 'bloqueado';

/** Barra superior: progreso y pasos (se puede volver a cualquier paso ya habilitado). */
export function BarraPasos({
  pasos,
  actual,
  estado,
  onIr,
}: {
  pasos: readonly PasoAsistente[];
  actual: number;
  estado: (indice: number) => EstadoPaso;
  onIr: (indice: number) => void;
}) {
  const progreso = pasos.length > 1 ? Math.round((actual / (pasos.length - 1)) * 100) : 100;
  return (
    <nav
      aria-label="Pasos"
      className="sticky top-0 z-30 mb-5 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-slate-700">
          Paso {actual + 1} de {pasos.length}: {pasos[actual]?.titulo}
        </span>
        <span className="text-slate-500">{progreso} %</span>
      </div>
      <div
        className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={progreso}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-300"
          style={{ width: `${progreso}%` }}
        />
      </div>
      <ol className="flex gap-1 overflow-x-auto">
        {pasos.map((p, i) => {
          const e = estado(i);
          return (
            <li key={p.id} className="min-w-[7.5rem] flex-1">
              <button
                type="button"
                onClick={() => onIr(i)}
                disabled={e === 'bloqueado'}
                aria-current={e === 'actual' ? 'step' : undefined}
                title={e === 'bloqueado' ? (p.bloqueo ?? 'Completa los pasos anteriores para llegar aquí') : p.resumen}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors',
                  e === 'actual' && 'bg-indigo-50 font-bold text-indigo-800 ring-1 ring-indigo-200',
                  e === 'hecho' && 'text-emerald-800 hover:bg-emerald-50',
                  e === 'pendiente' && 'text-slate-700 hover:bg-slate-50',
                  e === 'bloqueado' && 'cursor-not-allowed text-slate-400',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    e === 'actual' && 'bg-gradient-to-br from-indigo-600 to-violet-500 text-white',
                    e === 'hecho' && 'bg-emerald-600 text-white',
                    (e === 'pendiente' || e === 'bloqueado') && 'bg-slate-100 text-slate-500',
                  )}
                >
                  {e === 'hecho' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{p.titulo}</span>
                  {p.etiqueta && (
                    <span
                      className={cn(
                        'block text-[10px] font-normal leading-tight',
                        p.tono === 'bien' && 'text-emerald-700',
                        p.tono === 'falta' && 'text-red-700',
                        p.tono === 'aviso' && 'text-amber-700',
                        !p.tono && 'text-slate-500',
                      )}
                    >
                      {p.etiqueta}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Pie del paso: Atrás / Siguiente (o la acción final) y lo que falta para avanzar. */
export function NavegacionPasos({
  actual,
  total,
  onAtras,
  onSiguiente,
  faltan,
  mostrarFaltan,
  etiquetaSiguiente,
  accionFinal,
  onIrCampo,
}: {
  actual: number;
  total: number;
  onAtras: () => void;
  onSiguiente: () => void;
  /** Lo que impide pasar al siguiente paso. */
  faltan: Array<{ texto: string; campo?: string }>;
  /** Lleva al campo donde se corrige (si la falta lo indica). */
  onIrCampo?: (id: string) => void;
  /** true después de pulsar «Siguiente» con cosas pendientes. */
  mostrarFaltan: boolean;
  etiquetaSiguiente?: string;
  /** En el último paso reemplaza a «Siguiente». */
  accionFinal?: ReactNode;
}) {
  const ultimo = actual >= total - 1;
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      {mostrarFaltan && faltan.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
          <p className="font-bold">Para seguir te falta:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {faltan.map((f, i) => (
              <li key={`${i}-${f.texto}`}>
                {f.campo && onIrCampo ? (
                  <button
                    type="button"
                    className="text-left underline decoration-amber-400 underline-offset-2 hover:decoration-amber-800"
                    onClick={() => onIrCampo(f.campo as string)}
                  >
                    {f.texto}
                  </button>
                ) : (
                  f.texto
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onAtras} disabled={actual === 0}>
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </Button>
        {ultimo ? (
          accionFinal
        ) : (
          <Button type="button" onClick={onSiguiente}>
            {etiquetaSiguiente ?? 'Siguiente'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

const leer = (clave: string): boolean | null => {
  try {
    const v = window.localStorage.getItem(clave);
    return v == null ? null : v === '1';
  } catch {
    return null;
  }
};

const guardar = (clave: string, abierto: boolean) => {
  try {
    window.localStorage.setItem(clave, abierto ? '1' : '0');
  } catch {
    // Sin almacenamiento: el panel funciona igual, solo no recuerda si estaba abierto.
  }
};

/**
 * Panel plegable «¿Cómo se usa?» con la guía del paso. Abierto la primera vez; después recuerda (en este
 * navegador) si el usuario lo cerró.
 */
export function ComoSeUsa({ id, titulo = '¿Cómo se usa?', children }: { id: string; titulo?: string; children: ReactNode }) {
  const clave = `pb.guia.${id}`;
  const [abierto, setAbierto] = useState(() => leer(clave) ?? true);
  return (
    <details
      open={abierto}
      onToggle={(e) => {
        const v = (e.currentTarget as HTMLDetailsElement).open;
        setAbierto(v);
        guardar(clave, v);
      }}
      className="group mb-4 rounded-2xl border border-sky-200 bg-sky-50/70 text-sky-950"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold">
        <HelpCircle className="h-4 w-4 text-sky-600" />
        {titulo}
        <ChevronDown className="ml-auto h-4 w-4 text-sky-600 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 px-4 pb-4 text-[0.8rem] leading-relaxed">{children}</div>
    </details>
  );
}

/** Sección plegable con códigos internos (para soporte y Técnico); cerrada por defecto. */
export function DetallesTecnicos({
  children,
  titulo = 'Detalles técnicos',
  className,
  abierto,
}: {
  children: ReactNode;
  titulo?: string;
  className?: string;
  /** true lo abre (p. ej. cuando hay un error dentro); si no, el usuario lo abre y cierra a mano. */
  abierto?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (abierto && ref.current) ref.current.open = true;
  }, [abierto]);
  return (
    <details ref={ref} className={cn('group mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500">
        <Wrench className="h-3.5 w-3.5" />
        {titulo}
        <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 px-3 pb-3 text-[0.72rem] text-slate-600">{children}</div>
    </details>
  );
}

/** Diálogo de confirmación antes de escribir en Sis2000. */
export function ConfirmarDialog({
  titulo,
  children,
  confirmar,
  cancelar = 'Volver a revisar',
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  children: ReactNode;
  confirmar: string;
  cancelar?: string;
  ocupado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const botonCancelar = useRef<HTMLButtonElement>(null);
  /** Últimos valores para el manejador de Escape (sin volver a registrarlo en cada render). */
  const actual = useRef({ ocupado, onCancelar });
  actual.current = { ocupado, onCancelar };
  useEffect(() => {
    // Foco en «Volver» al abrir: confirmar exige un clic deliberado.
    botonCancelar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actual.current.ocupado) actual.current.onCancelar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="font-display text-base font-bold text-slate-900">{titulo}</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-700">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button ref={botonCancelar} type="button" variant="outline" onClick={onCancelar} disabled={ocupado}>
            {cancelar}
          </Button>
          <Button type="button" onClick={onConfirmar} disabled={ocupado}>
            {confirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
