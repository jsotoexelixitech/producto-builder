import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAyudas } from './AyudasProvider';

/** Interruptor «Vista con ayudas / Vista clásica» de la barra superior. No se pinta si el build lo apagó. */
export function AyudasToggle() {
  const { disponible, activas, setActivas } = useAyudas();
  if (!disponible) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activas}
      onClick={() => setActivas(!activas)}
      title={activas ? 'Pasar a la vista clásica (sin ayudas ni animaciones)' : 'Pasar a la vista con ayudas'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400',
        activas ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600',
      )}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {activas ? 'Vista con ayudas' : 'Vista clásica'}
    </button>
  );
}
