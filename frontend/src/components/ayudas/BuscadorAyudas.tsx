import { Suspense, lazy, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useAyudas } from './AyudasProvider';

// cmdk y el cuadro del buscador se cargan recién al abrirlo por primera vez.
const BuscadorDialogo = lazy(() => import('./BuscadorDialogo'));

/** Botón «Buscar» + atajo Ctrl+K (o ⌘K). Solo con la vista con ayudas. */
export function BuscadorAyudas() {
  const { activas } = useAyudas();
  const [abierto, setAbierto] = useState(false);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (!activas) return undefined;
    function alTeclear(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCargado(true);
        setAbierto((v) => !v);
      }
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [activas]);

  if (!activas) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCargado(true);
          setAbierto(true);
        }}
        aria-label="Buscar pantallas y pasos (Ctrl+K)"
        title="Buscar (Ctrl+K)"
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <Search className="h-3.5 w-3.5" aria-hidden />
        Buscar
        <kbd className="hidden rounded bg-slate-100 px-1 text-[0.65rem] text-slate-500 sm:inline">Ctrl K</kbd>
      </button>
      {cargado && (
        <Suspense fallback={null}>
          <BuscadorDialogo abierto={abierto} onCambio={setAbierto} />
        </Suspense>
      )}
    </>
  );
}
