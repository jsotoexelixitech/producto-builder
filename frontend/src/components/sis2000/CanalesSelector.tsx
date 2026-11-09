import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface CanalItem {
  ccanalalt: number;
  xcanalalt?: string;
}

/** Canales alternos que pueden vender el plan (mausuplan centidad C): ninguno, uno o varios, o todos. */
export interface CanalesSelection {
  todos: boolean;
  canales: CanalItem[];
}

/** Por defecto ninguno: es lo que se envía hoy (all_canal false, canales vacíos). */
export const CANALES_DEFAULT: CanalesSelection = { todos: false, canales: [] };

/** Construye la selección a partir del JSON del plan (all_canal / canales[]). */
export function canalesFromPayload(payload: Record<string, unknown>): CanalesSelection {
  if (payload.all_canal === true) return { todos: true, canales: [] };
  const lista = Array.isArray(payload.canales) ? (payload.canales as unknown[]) : [];
  const canales = lista
    .map((c) => {
      const o = (typeof c === 'object' && c !== null ? c : { ccanalalt: c }) as Record<string, unknown>;
      return { ccanalalt: Number(o.ccanalalt), xcanalalt: typeof o.xcanalalt === 'string' ? o.xcanalalt : undefined };
    })
    .filter((c) => Number.isInteger(c.ccanalalt) && c.ccanalalt > 0);
  return { todos: false, canales };
}

/** Campos a aplicar en el JSON del plan. */
export function canalesToPayloadFields(sel: CanalesSelection): {
  all_canal: boolean;
  canales: Array<{ ccanalalt: number }>;
} {
  return {
    all_canal: sel.todos,
    canales: sel.todos ? [] : sel.canales.map((c) => ({ ccanalalt: c.ccanalalt })),
  };
}

interface Props {
  value: CanalesSelection;
  onChange: (next: CanalesSelection) => void;
  idPrefix?: string;
  className?: string;
}

/**
 * Selector de canales alternos: buscador por nombre o código (macanalalt vía nest-api), chips de seleccionados,
 * opción «Todos los canales» y alta manual por código si la lista no responde.
 */
export function CanalesSelector({ value, onChange, idPrefix = 'canal', className }: Props) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<CanalItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [listaFallo, setListaFallo] = useState(false);
  const [manual, setManual] = useState('');
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (value.todos) return;
    const t = setTimeout(() => {
      setBuscando(true);
      api
        .listSis2000Canales(q.trim())
        .then((rows) => {
          setResultados(
            (rows ?? []).map((r) => ({ ccanalalt: Number(r.ccanalalt), xcanalalt: String(r.xcanalalt ?? '').trim() })),
          );
          setListaFallo(false);
        })
        .catch(() => {
          setResultados([]);
          setListaFallo(true);
        })
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, value.todos]);

  const seleccionados = new Set(value.canales.map((c) => c.ccanalalt));

  function agregar(c: CanalItem) {
    if (seleccionados.has(c.ccanalalt)) return;
    onChange({ todos: false, canales: [...value.canales, c] });
  }
  function quitar(codigo: number) {
    onChange({ todos: false, canales: value.canales.filter((c) => c.ccanalalt !== codigo) });
  }
  function agregarManual() {
    const n = Number(manual);
    if (!(Number.isInteger(n) && n > 0)) return;
    agregar({ ccanalalt: n });
    setManual('');
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={`${idPrefix}-modo`}
            className="h-4 w-4 accent-primary"
            checked={!value.todos}
            onChange={() => onChange({ todos: false, canales: value.canales })}
          />
          Canales seleccionados
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={`${idPrefix}-modo`}
            className="h-4 w-4 accent-primary"
            checked={value.todos}
            onChange={() => onChange({ todos: true, canales: value.canales })}
          />
          Todos los canales
        </label>
      </div>

      {!value.todos && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {value.canales.length === 0 && (
              <span className="text-xs text-muted-foreground">Ningún canal alterno (solo productores).</span>
            )}
            {value.canales.map((c) => (
              <span
                key={c.ccanalalt}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium"
              >
                {c.ccanalalt}
                {c.xcanalalt ? ` · ${c.xcanalalt}` : ''}
                <button
                  type="button"
                  aria-label={`Quitar canal ${c.ccanalalt}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-background"
                  onClick={() => quitar(c.ccanalalt)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="relative">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`${idPrefix}-buscar`}
                aria-label="Buscar canal por nombre o código"
                placeholder="Buscar canal por nombre o código…"
                className="pl-7"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setAbierto(true)}
                onBlur={() => setTimeout(() => setAbierto(false), 150)}
              />
            </div>
            {abierto && !listaFallo && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-background shadow-md">
                {buscando && <li className="px-3 py-1.5 text-xs text-muted-foreground">Buscando…</li>}
                {!buscando && resultados.length === 0 && (
                  <li className="px-3 py-1.5 text-xs text-muted-foreground">Sin resultados.</li>
                )}
                {resultados.map((r) => {
                  const ya = seleccionados.has(r.ccanalalt);
                  return (
                    <li key={r.ccanalalt}>
                      <button
                        type="button"
                        disabled={ya}
                        className={cn(
                          'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted',
                          ya && 'cursor-default opacity-50',
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => agregar(r)}
                      >
                        <span>{r.xcanalalt || '(sin nombre)'}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.ccanalalt}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {listaFallo && (
            <p className="text-xs text-amber-700">
              No se pudo cargar la lista de canales; agrega el código manualmente.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Input
              aria-label="Agregar canal por código (ccanalalt)"
              type="number"
              min={1}
              step={1}
              placeholder="Código manual"
              className="w-40"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregarManual();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={agregarManual} disabled={!(Number(manual) > 0)}>
              Agregar código
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
