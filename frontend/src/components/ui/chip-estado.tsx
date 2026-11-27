import { cn } from '@/lib/utils';
import { estadoDeValor, ETIQUETA_ESTADO, type EstadoChip } from '@/lib/estado-chip';

const CLASES: Record<EstadoChip, string> = {
  activo: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  inactivo: 'border-slate-200 bg-slate-100 text-slate-600',
  borrador: 'border-[#663af3]/25 bg-[#663af3]/10 text-[#663af3]',
  errores: 'border-[#e84f51]/30 bg-[#e84f51]/10 text-[#c23a3c]',
  otro: 'border-border bg-muted/40 text-muted-foreground',
};
const PUNTO: Record<EstadoChip, string> = {
  activo: 'bg-emerald-500',
  inactivo: 'bg-slate-400',
  borrador: 'bg-[#663af3]',
  errores: 'bg-[#e84f51]',
  otro: 'bg-slate-300',
};

/** Chip de estado único para todas las listas. `valor` crudo (A, I, DRAFT...) o `estado` ya resuelto. */
export function ChipEstado({
  valor,
  estado,
  texto,
  className,
}: {
  valor?: unknown;
  estado?: EstadoChip;
  /** Texto a mostrar; si no, el estándar del estado (o el valor crudo si no se reconoce). */
  texto?: string;
  className?: string;
}) {
  const e = estado ?? estadoDeValor(valor);
  const crudo = valor == null ? '' : String(valor).trim();
  const etiqueta = texto ?? (e === 'otro' ? crudo || ETIQUETA_ESTADO.otro : ETIQUETA_ESTADO[e]);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold',
        CLASES[e],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', PUNTO[e])} aria-hidden="true" />
      {etiqueta}
    </span>
  );
}
