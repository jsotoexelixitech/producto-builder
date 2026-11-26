import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const PREFIJO_TABLA = 'En Sis2000:';

/**
 * Ayuda de un campo con la vista con ayudas: mismo texto que el (i) clásico, pero se abre con clic, Enter o
 * espacio (también en pantallas táctiles), con el mouse encima, y se cierra con Esc. Mantiene el foco del teclado.
 */
export function AyudaCampo({ text, className }: { text: string; className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [fijo, setFijo] = useState(false);
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelarCierre = () => {
    if (cierre.current) clearTimeout(cierre.current);
    cierre.current = null;
  };
  const cerrarPronto = () => {
    cancelarCierre();
    cierre.current = setTimeout(() => !fijo && setAbierto(false), 150);
  };
  const lineas = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setFijo(false);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Ayuda: ${lineas[0] ?? ''}`}
          onClick={(e) => {
            e.preventDefault();
            setFijo(true);
            setAbierto(true);
          }}
          onMouseEnter={() => {
            cancelarCierre();
            setAbierto(true);
          }}
          onMouseLeave={cerrarPronto}
          className={cn(
            'inline-flex shrink-0 cursor-help rounded-full text-slate-400 outline-none hover:text-indigo-500 focus-visible:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400',
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={6}
          collisionPadding={8}
          onMouseEnter={cancelarCierre}
          onMouseLeave={cerrarPronto}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="ayuda-contenido z-[100] w-[300px] max-w-[calc(100vw-1rem)] rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg outline-none"
        >
          {lineas.map((linea, i) =>
            linea.startsWith(PREFIJO_TABLA) ? (
              <span key={i} className="mt-1.5 block border-t border-white/15 pt-1 text-[0.75rem] text-slate-400">
                {linea}
              </span>
            ) : (
              <span key={i} className={cn('block', i > 0 && 'mt-1')}>
                {linea}
              </span>
            ),
          )}
          <Popover.Arrow className="fill-slate-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
