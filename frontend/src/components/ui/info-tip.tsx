import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const ANCHO = 280;

/**
 * Ícono (i) junto al título de un campo: explica qué hace al pasar el mouse o enfocarlo con teclado.
 * Se pinta en document.body para que no lo recorten las tarjetas con overflow-hidden.
 */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function mostrar() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - ANCHO / 2),
      window.innerWidth - ANCHO - 8,
    );
    setPos({ top: r.bottom + 6, left });
  }

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
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}
