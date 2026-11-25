import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AyudaCampo } from '@/components/ayudas/AyudaCampo';
import { useAyudas } from '@/components/ayudas/AyudasProvider';

const ANCHO = 300;
const PREFIJO_TABLA = 'En Sis2000:';

/**
 * Ícono (i) junto al título de un campo: explica qué hace al pasar el mouse o enfocarlo con teclado.
 * Se pinta en document.body para que no lo recorten las tarjetas con overflow-hidden.
 * Cada salto de línea es un párrafo; la línea que empieza con «En Sis2000:» (tabla.campo) sale aparte y discreta.
 */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { activas } = useAyudas();

  function mostrar() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - ANCHO / 2),
      window.innerWidth - ANCHO - 8,
    );
    setPos({ top: r.bottom + 6, left });
  }

  if (activas) return <AyudaCampo text={text} className={className} />;

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-label={text}
        onMouseEnter={mostrar}
        onMouseLeave={() => setPos(null)}
        onFocus={mostrar}
        onBlur={() => setPos(null)}
        className={cn(
          'inline-flex shrink-0 cursor-help text-slate-400 outline-none hover:text-indigo-500 focus-visible:text-indigo-500',
          className,
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </span>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: pos.top, left: pos.left, width: ANCHO }}
            className="pointer-events-none fixed z-[100] rounded-lg bg-slate-900 px-3 py-2 text-[0.72rem] font-normal leading-relaxed text-white shadow-lg"
          >
            {text
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .map((linea, i) =>
                linea.startsWith(PREFIJO_TABLA) ? (
                  <span key={i} className="mt-1.5 block border-t border-white/15 pt-1 text-[0.66rem] text-slate-400">
                    {linea}
                  </span>
                ) : (
                  <span key={i} className={cn('block', i > 0 && 'mt-1')}>
                    {linea}
                  </span>
                ),
              )}
          </span>,
          document.body,
        )}
    </>
  );
}
