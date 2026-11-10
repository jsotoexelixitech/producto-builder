import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Alto máximo de la lista (17rem) y separación respecto del buscador. */
const ALTO_MAX = 272;
const SEPARACION = 6;

interface Props {
  /** Elemento al que se ancla la lista (normalmente el contenedor del buscador). */
  anclaRef: RefObject<HTMLElement | null>;
  abierto: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Lista desplegable de un buscador pintada en document.body (como InfoTip), para que no la recorten
 * las tarjetas con overflow-hidden. Sigue al buscador al hacer scroll o cambiar el tamaño de la ventana
 * y se abre hacia arriba si abajo no hay espacio. No roba el foco del buscador.
 */
export function ListaFlotante({ anclaRef, abierto, id, className, children }: Props) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!abierto) {
      setPos(null);
      return;
    }
    function ubicar() {
      const r = anclaRef.current?.getBoundingClientRect();
      if (!r) return;
      const abajo = window.innerHeight - r.bottom - SEPARACION - 8;
      const arriba = r.top - SEPARACION - 8;
      const haciaArriba = abajo < 160 && arriba > abajo;
      const maxHeight = Math.max(120, Math.min(ALTO_MAX, haciaArriba ? arriba : abajo));
      setPos(
        haciaArriba
          ? { bottom: window.innerHeight - r.top + SEPARACION, left: r.left, width: r.width, maxHeight }
          : { top: r.bottom + SEPARACION, left: r.left, width: r.width, maxHeight },
      );
    }
    ubicar();
    window.addEventListener('scroll', ubicar, true);
    window.addEventListener('resize', ubicar);
    return () => {
      window.removeEventListener('scroll', ubicar, true);
      window.removeEventListener('resize', ubicar);
    };
  }, [abierto, anclaRef]);

  if (!abierto || !pos) return null;

  return createPortal(
    <ul
      id={id}
      role="listbox"
      style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
      className={cn(
        'fixed z-[90] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-lg',
        className,
      )}
      // Evita que el buscador pierda el foco al usar la barra de scroll o hacer clic en una opción.
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </ul>,
    document.body,
  );
}

interface OpcionBuscador {
  codigo: number;
  nombre?: string;
}

interface BuscadorProps {
  id: string;
  placeholder: string;
  q: string;
  onQ: (q: string) => void;
  opciones: OpcionBuscador[];
  buscando: boolean;
  /** Si la lista no cargó no se abre (el componente muestra el alta manual). */
  listaFallo: boolean;
  yaElegido: (codigo: number) => boolean;
  onElegir: (o: OpcionBuscador) => void;
}

/**
 * Buscador con ícono y lista flotante: se abre al enfocar, se cierra al salir del campo o con Escape,
 * y se navega con flechas + Enter. Lo usan los selectores de productores y canales.
 */
export function BuscadorConLista({ id, placeholder, q, onQ, opciones, buscando, listaFallo, yaElegido, onElegir }: BuscadorProps) {
  const anclaRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const visible = abierto && !listaFallo;
  const listaId = `${id}-lista`;

  const firma = opciones.map((o) => o.codigo).join(',');
  useEffect(() => setActivo(-1), [firma]);

  useEffect(() => {
    if (activo < 0) return;
    document.getElementById(`${listaId}-${activo}`)?.scrollIntoView({ block: 'nearest' });
  }, [activo, listaId]);

  function mover(delta: number) {
    if (!opciones.length) return;
    setAbierto(true);
    setActivo((i) => {
      let n = i;
      for (let k = 0; k < opciones.length; k++) {
        n = (n + delta + opciones.length) % opciones.length;
        if (!yaElegido(opciones[n].codigo)) return n;
      }
      return i;
    });
  }

  return (
    <div ref={anclaRef} className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        id={id}
        role="combobox"
        aria-label={placeholder.replace(/…$/, '')}
        aria-expanded={visible}
        aria-controls={listaId}
        aria-activedescendant={visible && activo >= 0 ? `${listaId}-${activo}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        className="pl-10"
        value={q}
        onChange={(e) => {
          onQ(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onClick={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            mover(1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            mover(-1);
          } else if (e.key === 'Enter' && visible && activo >= 0) {
            e.preventDefault();
            const o = opciones[activo];
            if (o && !yaElegido(o.codigo)) onElegir(o);
          } else if (e.key === 'Escape' && visible) {
            e.preventDefault();
            e.stopPropagation();
            setAbierto(false);
          }
        }}
      />
      <ListaFlotante anclaRef={anclaRef} abierto={visible} id={listaId}>
        {buscando && <li className="px-3.5 py-2 text-[0.72rem] text-slate-500">Buscando…</li>}
        {!buscando && opciones.length === 0 && (
          <li className="px-3.5 py-2 text-[0.72rem] text-slate-500">Sin resultados.</li>
        )}
        {opciones.map((o, i) => {
          const ya = yaElegido(o.codigo);
          return (
            <li
              key={o.codigo}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={i === activo}
              aria-disabled={ya}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-sm text-slate-800',
                i === activo ? 'bg-indigo-50' : 'hover:bg-slate-50',
                ya && 'cursor-default text-slate-400 hover:bg-transparent',
              )}
              onMouseEnter={() => !ya && setActivo(i)}
              onClick={() => !ya && onElegir(o)}
            >
              <span className="min-w-0 truncate">{o.nombre || '(sin nombre)'}</span>
              <span className="shrink-0 font-mono text-xs text-slate-400">{ya ? `${o.codigo} · agregado` : o.codigo}</span>
            </li>
          );
        })}
      </ListaFlotante>
    </div>
  );
}

/** Chip de un elemento seleccionado con botón para quitarlo. */
export function ChipSeleccion({ codigo, nombre, etiqueta, onQuitar }: { codigo: number; nombre?: string; etiqueta: string; onQuitar: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 py-1 pl-3 pr-1 text-xs font-medium text-indigo-800">
      <span className="font-mono">{codigo}</span>
      {nombre && <span className="min-w-0 truncate text-indigo-700/80">· {nombre}</span>}
      <button
        type="button"
        aria-label={`Quitar ${etiqueta} ${codigo}`}
        title="Quitar"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
        onClick={onQuitar}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
