import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { SIS2000_DEFAULT_PRODUCTOR } from '@/lib/sis2000-nest-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ProductorItem {
  cproductor: number;
  xproductor?: string;
}

/** Quién puede vender el plan (mausuplan): todos, o una lista de productores (uno o varios). */
export interface ProductoresSelection {
  todos: boolean;
  productores: ProductorItem[];
}

export const PRODUCTORES_DEFAULT: ProductoresSelection = {
  todos: false,
  productores: [{ cproductor: SIS2000_DEFAULT_PRODUCTOR }],
};

/** Construye la selección a partir del JSON del plan (all_productor / productores[]). */
export function productoresFromPayload(payload: Record<string, unknown>): ProductoresSelection {
  if (payload.all_productor === true) return { todos: true, productores: [] };
  const lista = Array.isArray(payload.productores) ? (payload.productores as Record<string, unknown>[]) : [];
  const productores = lista
    .map((p) => ({ cproductor: Number(p.cproductor), xproductor: typeof p.xproductor === 'string' ? p.xproductor : undefined }))
    .filter((p) => Number.isInteger(p.cproductor) && p.cproductor > 0);
  return { todos: false, productores: productores.length ? productores : PRODUCTORES_DEFAULT.productores };
}

/** Campos a aplicar en el CreatePlanDto/UpdatePlanDto. */
export function productoresToPayloadFields(sel: ProductoresSelection): {
  all_productor: boolean;
  productores: Array<{ cproductor: number }>;
} {
  return {
    all_productor: sel.todos,
    productores: sel.todos ? [] : sel.productores.map((p) => ({ cproductor: p.cproductor })),
  };
}

export function validarProductores(sel: ProductoresSelection): string | null {
  if (sel.todos) return null;
  if (!sel.productores.length) return 'Selecciona al menos un productor o marca «Todos los productores».';
  return null;
}

interface Props {
  value: ProductoresSelection;
  onChange: (next: ProductoresSelection) => void;
  idPrefix?: string;
  className?: string;
}

/**
 * Selector reutilizable de productores: buscador por nombre/código (maproduc vía nest-api),
 * chips de seleccionados, opción «Todos» y alta manual por código si la lista no responde.
 */
export function ProductoresSelector({ value, onChange, idPrefix = 'prod', className }: Props) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<ProductorItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [listaFallo, setListaFallo] = useState(false);
  const [manual, setManual] = useState('');
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (value.todos) return;
    const t = setTimeout(() => {
      setBuscando(true);
      api
        .listSis2000Productores(q.trim())
        .then((rows) => {
          setResultados(
            (rows ?? []).map((r) => ({ cproductor: Number(r.cproductor), xproductor: String(r.xproductor ?? '').trim() })),
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

  const seleccionados = new Set(value.productores.map((p) => p.cproductor));

  function agregar(p: ProductorItem) {
    if (seleccionados.has(p.cproductor)) return;
    onChange({ todos: false, productores: [...value.productores, p] });
  }
  function quitar(c: number) {
    onChange({ todos: false, productores: value.productores.filter((p) => p.cproductor !== c) });
  }
  function agregarManual() {
    const n = Number(manual);
    if (!(Number.isInteger(n) && n > 0)) return;
    agregar({ cproductor: n });
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
            onChange={() => onChange({ todos: false, productores: value.productores.length ? value.productores : PRODUCTORES_DEFAULT.productores })}
          />
          Productores seleccionados
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={`${idPrefix}-modo`}
            className="h-4 w-4 accent-primary"
            checked={value.todos}
            onChange={() => onChange({ todos: true, productores: value.productores })}
          />
          Todos los productores
        </label>
      </div>

      {!value.todos && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {value.productores.length === 0 && (
              <span className="text-xs text-muted-foreground">Sin productores seleccionados.</span>
            )}
            {value.productores.map((p) => (
              <span
                key={p.cproductor}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium"
              >
                {p.cproductor}
                {p.xproductor ? ` · ${p.xproductor}` : ''}
                <button
                  type="button"
                  aria-label={`Quitar productor ${p.cproductor}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-background"
                  onClick={() => quitar(p.cproductor)}
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
                aria-label="Buscar productor por nombre o código"
                placeholder="Buscar productor por nombre o código…"
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
                  const ya = seleccionados.has(r.cproductor);
                  return (
                    <li key={r.cproductor}>
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
                        <span>{r.xproductor || '(sin nombre)'}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.cproductor}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {listaFallo && (
            <p className="text-xs text-amber-700">
              No se pudo cargar la lista de productores; agrega el código manualmente.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Input
              aria-label="Agregar productor por código (cproductor)"
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
