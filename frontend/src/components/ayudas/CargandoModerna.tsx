import { useEffect, useState, type ReactNode } from 'react';
import { useAyudas } from './AyudasProvider';

/** Segundos desde que empezó la carga (la barra avanza sin reiniciarse). */
function useSegundos(): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    const inicio = Date.now();
    const t = window.setInterval(() => setS((Date.now() - inicio) / 1000), 250);
    return () => window.clearInterval(t);
  }, []);
  return s;
}

function Esqueleto({ texto, filas }: { texto: string; filas: number }) {
  const seg = useSegundos();
  // Avanza rápido al inicio y se frena cerca del 95 %: nunca vuelve a 0 mientras espera.
  const avance = 95 * (1 - Math.exp(-seg / 12));
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <div className="lm-cargando flex items-center gap-3 text-sm font-semibold">
        <span className="lm-orbita" aria-hidden="true" />
        <span>
          {texto.replace(/[.…]+$/, '')}
          <span className="lm-puntos" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="lm-progreso flex-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance)}>
          <div style={{ width: `${Math.max(4, avance)}%` }} />
        </div>
        <span className="font-mono text-xs tabular-nums text-slate-500">{Math.floor(seg)} s</span>
      </div>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="lm-esqueleto h-4" style={{ width: `${100 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Estado de carga: en vista moderna muestra un esqueleto con ola de brillo y una barra que avanza (como el tablero de
 * Perfil Comercial). En vista clásica devuelve exactamente `clasica`, lo mismo que había antes.
 */
export function CargandoModerna({ texto, clasica, filas = 3 }: { texto: string; clasica: ReactNode; filas?: number }) {
  const { activas } = useAyudas();
  if (!activas) return <>{clasica}</>;
  return <Esqueleto texto={texto} filas={filas} />;
}
