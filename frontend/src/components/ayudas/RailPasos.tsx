import { Check, Lock } from 'lucide-react';
import type { EstadoPaso } from '@/components/sis2000/AsistentePasos';
import type { PasoAsistente } from '@/components/sis2000/AsistentePasos';
import { cn } from '@/lib/utils';

/**
 * Pasos del asistente en vista moderna: dos grupos («Crear el plan» y «Completar»), nombre completo, estado con
 * ícono y línea conectora. En pantallas medianas se muestra compacto (solo número o ícono y el paso actual con nombre).
 * Es la misma lista y los mismos estados que la barra clásica: solo cambia cómo se ve.
 */
export function RailPasos({
  pasos,
  corte,
  actual,
  estado,
  onIr,
  avance,
}: {
  pasos: readonly PasoAsistente[];
  /** Cantidad de pasos del primer grupo («Crear el plan»). */
  corte: number;
  actual: number;
  estado: (indice: number) => EstadoPaso;
  onIr: (indice: number) => void;
  /** Porcentaje de avance (el mismo que muestra el panel derecho). */
  avance: number;
}) {
  const grupos = [
    { titulo: 'Crear el plan', desde: 0, hasta: Math.min(corte, pasos.length) },
    { titulo: 'Completar el plan', desde: corte, hasta: pasos.length },
  ].filter((g) => g.hasta > g.desde);
  const hayBloqueados = pasos.some((_, i) => i >= corte && estado(i) === 'bloqueado');

  return (
    <nav aria-label="Pasos" className="cb-rail">
      <div className="cb-rail-avance">
        <span>
          Paso {actual + 1} de {pasos.length}
        </span>
        <strong>{avance} %</strong>
      </div>
      <div className="cb-rail-barra" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del plan">
        <span style={{ width: `${avance}%` }} />
      </div>
      {grupos.map((g) => (
        <div key={g.titulo} className="cb-rail-grupo">
          <p className="cb-rail-titulo">{g.titulo}</p>
          <ol>
            {pasos.slice(g.desde, g.hasta).map((p, k) => {
              const i = g.desde + k;
              const e = estado(i);
              return (
                <li key={p.id} data-estado={e}>
                  <button
                    type="button"
                    onClick={() => onIr(i)}
                    disabled={e === 'bloqueado'}
                    aria-current={e === 'actual' ? 'step' : undefined}
                    aria-label={`Paso ${i + 1}: ${p.titulo}${e === 'bloqueado' ? ' (bloqueado)' : e === 'hecho' ? ' (hecho)' : ''}`}
                    title={p.titulo}
                  >
                    <span className="cb-rail-marca" aria-hidden>
                      {e === 'hecho' ? <Check className="h-4 w-4" /> : e === 'bloqueado' ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="cb-rail-texto">
                      <span className="cb-rail-nombre">{p.titulo}</span>
                      {p.etiqueta && e !== 'bloqueado' && (
                        <span className={cn('cb-rail-etiqueta', p.tono && `cb-tono-${p.tono}`)}>{p.etiqueta}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {g.desde >= corte && hayBloqueados && <p className="cb-rail-nota">Se habilitan al guardar el plan.</p>}
        </div>
      ))}
    </nav>
  );
}
