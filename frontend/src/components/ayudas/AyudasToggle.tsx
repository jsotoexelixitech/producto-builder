import { cn } from '@/lib/utils';
import { useAyudas } from './AyudasProvider';

/** Selector de vista «Moderna | Clásica» de la barra superior. No se pinta si el build lo apagó. */
export function AyudasToggle() {
  const { disponible, activas, setActivas } = useAyudas();
  if (!disponible) return null;
  const opcion = (valor: boolean, texto: string, ayuda: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={activas === valor}
      title={ayuda}
      onClick={() => setActivas(valor)}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400',
        activas === valor ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
      )}
    >
      {texto}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Vista de la pantalla" className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5">
      {opcion(true, 'Moderna', 'Vista moderna, con ayudas y animaciones')}
      {opcion(false, 'Clásica', 'Vista clásica, como antes (sin ayudas ni animaciones)')}
    </div>
  );
}
