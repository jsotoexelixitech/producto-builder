import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ListaFlotante } from '@/components/ui/lista-flotante';
import { cn } from '@/lib/utils';

export interface OpcionCombo {
  /** Valor que se guarda (único). */
  valor: string;
  /** Lo que ve el usuario en la lista y en el campo. */
  etiqueta: string;
  /** Texto gris a la derecha (opcional). */
  detalle?: string;
  /** Texto extra que también se busca pero no se muestra (p. ej. códigos). */
  buscar?: string;
  deshabilitada?: boolean;
}

interface Props {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  opciones: OpcionCombo[];
  placeholder?: string;
  /** Nombre accesible del campo. */
  ariaLabel: string;
  disabled?: boolean;
  /** Muestra «Cargando…» en la lista. */
  cargando?: boolean;
  className?: string;
}

/** Minúsculas y sin acentos: «Automóvil» y «automovil» se encuentran igual. */
export function normalizarBusqueda(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Selector con buscador escrito (combobox): se escribe para filtrar por nombre o número, se navega con ↑/↓, Enter
 * elige y Esc cierra. Al salir del campo vuelve a mostrar lo elegido. La lista se pinta en document.body
 * (ListaFlotante) para que no la recorten las tarjetas.
 */
export function ComboBuscable({
  id,
  value,
  onChange,
  opciones,
  placeholder = 'Escribe para buscar…',
  ariaLabel,
  disabled,
  cargando,
  className,
}: Props) {
  const anclaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  /** Texto escrito; null = no se está escribiendo (el campo muestra lo elegido). */
  const [q, setQ] = useState<string | null>(null);
  const [activo, setActivo] = useState(-1);
  const listaId = `${id}-lista`;
  const elegida = opciones.find((o) => o.valor === value);

  const filtradas = useMemo(() => {
    const terminos = normalizarBusqueda(q ?? '').split(/\s+/).filter(Boolean);
    if (!terminos.length) return opciones;
    return opciones.filter((o) => {
      const pajar = normalizarBusqueda(`${o.etiqueta} ${o.detalle ?? ''} ${o.buscar ?? ''} ${o.valor}`);
      return terminos.every((t) => pajar.includes(t));
    });
  }, [opciones, q]);

  // Al escribir, queda resaltada la primera opción disponible (Enter la elige).
  useEffect(() => {
    if (q === null) return;
    setActivo(filtradas.findIndex((o) => !o.deshabilitada));
  }, [q, filtradas]);

  useEffect(() => {
    if (activo < 0 || !abierto) return;
    document.getElementById(`${listaId}-${activo}`)?.scrollIntoView({ block: 'nearest' });
  }, [activo, abierto, listaId]);

  function abrir() {
    if (disabled) return;
    setAbierto(true);
    setQ(null);
    setActivo(opciones.findIndex((o) => o.valor === value));
  }

  function cerrar() {
    setAbierto(false);
    setQ(null);
  }

  function elegir(o: OpcionCombo | undefined) {
    if (!o || o.deshabilitada) return;
    onChange(o.valor);
    cerrar();
  }

  function mover(delta: number) {
    if (!abierto) {
      abrir();
      return;
    }
    if (!filtradas.length) return;
    setActivo((i) => {
      let n = i;
      for (let k = 0; k < filtradas.length; k += 1) {
        n = (n + delta + filtradas.length) % filtradas.length;
        if (!filtradas[n].deshabilitada) return n;
      }
      return i;
    });
  }

  return (
    <div ref={anclaRef} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-activedescendant={abierto && activo >= 0 ? `${listaId}-${activo}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        className="pl-10 pr-10"
        value={q ?? elegida?.etiqueta ?? ''}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
        }}
        onFocus={(e) => {
          abrir();
          e.currentTarget.select();
        }}
        onClick={() => !abierto && abrir()}
        onBlur={cerrar}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            mover(1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            mover(-1);
          } else if (e.key === 'Enter' && abierto) {
            e.preventDefault();
            elegir(activo >= 0 ? filtradas[activo] : filtradas.length === 1 ? filtradas[0] : undefined);
          } else if (e.key === 'Escape' && abierto) {
            e.preventDefault();
            e.stopPropagation();
            cerrar();
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={abierto ? 'Cerrar lista' : 'Abrir lista'}
        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
        // No roba el foco: el campo sigue enfocado y la lista no se cierra por el blur.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (abierto) cerrar();
          else {
            inputRef.current?.focus();
            abrir();
          }
        }}
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', abierto && 'rotate-180')} />
      </button>
      <ListaFlotante anclaRef={anclaRef} abierto={abierto} id={listaId}>
        {cargando && <li className="px-3.5 py-2 text-[0.72rem] text-slate-500">Cargando…</li>}
        {!cargando && filtradas.length === 0 && (
          <li className="px-3.5 py-2 text-[0.72rem] text-slate-500">Sin resultados.</li>
        )}
        {filtradas.map((o, i) => (
          <li
            key={o.valor}
            id={`${listaId}-${i}`}
            role="option"
            aria-selected={o.valor === value}
            aria-disabled={o.deshabilitada}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-sm text-slate-800',
              i === activo ? 'bg-indigo-50' : 'hover:bg-slate-50',
              o.valor === value && 'font-semibold text-indigo-800',
              o.deshabilitada && 'cursor-default text-slate-400 hover:bg-transparent',
            )}
            onMouseEnter={() => !o.deshabilitada && setActivo(i)}
            onClick={() => elegir(o)}
          >
            <span className="min-w-0 truncate">{o.etiqueta}</span>
            {o.detalle && <span className="shrink-0 text-xs font-normal text-slate-400">{o.detalle}</span>}
          </li>
        ))}
      </ListaFlotante>
    </div>
  );
}
