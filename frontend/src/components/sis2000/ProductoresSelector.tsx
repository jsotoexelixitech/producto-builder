import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SIS2000_DEFAULT_PRODUCTOR } from '@/lib/sis2000-nest-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BuscadorConLista, ChipSeleccion } from '@/components/ui/lista-flotante';
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
          <div className="flex min-h-[1.75rem] flex-wrap items-center gap-1.5">
            {value.productores.length === 0 && (
              <span className="text-[0.72rem] leading-relaxed text-slate-500">Sin productores seleccionados.</span>
            )}
            {value.productores.map((c) => (
              <ChipSeleccion
                key={c.cproductor}
                codigo={c.cproductor}
                nombre={c.xproductor}
                etiqueta="productor"
                onQuitar={() => quitar(c.cproductor)}
              />
            ))}
          </div>

          <BuscadorConLista
            id={`${idPrefix}-buscar`}
            placeholder="Buscar productor por nombre o código…"
            q={q}
            onQ={setQ}
            opciones={resultados.map((r) => ({ codigo: r.cproductor, nombre: r.xproductor }))}
            buscando={buscando}
            listaFallo={listaFallo}
            yaElegido={(codigo) => seleccionados.has(codigo)}
            onElegir={(o) => agregar({ cproductor: o.codigo, xproductor: o.nombre })}
          />

          {listaFallo && (
            <p className="text-[0.72rem] leading-relaxed text-amber-700">
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
