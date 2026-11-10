import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BuscadorConLista, ChipSeleccion } from '@/components/ui/lista-flotante';
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
  /** Bandera apagada en el servidor: se muestra el campo con la explicación, sin poder elegir. */
  deshabilitado?: boolean;
}

/**
 * Selector de canales alternos: buscador por nombre o código (macanalalt vía nest-api), chips de seleccionados,
 * opción «Todos los canales» y alta manual por código si la lista no responde.
 */
export function CanalesSelector({ value, onChange, idPrefix = 'canal', className, deshabilitado = false }: Props) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<CanalItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [listaFallo, setListaFallo] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (value.todos || deshabilitado) return;
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
  }, [q, value.todos, deshabilitado]);

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

  if (deshabilitado) {
    return (
      <p className={cn('rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[0.72rem] leading-relaxed text-slate-500', className)}>
        Elegir canales está desactivado en este servidor (bandera SIS2000_PLAN_CANALES del builder). Mientras esté
        apagada el plan se guarda sin canales alternos (solo productores).
      </p>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[0.72rem] leading-relaxed text-slate-500">
        Los canales se agregan al plan y nunca se borran: quitar uno aquí no lo quita de Sis2000.
      </p>
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
          <div className="flex min-h-[1.75rem] flex-wrap items-center gap-1.5">
            {value.canales.length === 0 && (
              <span className="text-[0.72rem] leading-relaxed text-slate-500">Ningún canal alterno (solo productores).</span>
            )}
            {value.canales.map((c) => (
              <ChipSeleccion
                key={c.ccanalalt}
                codigo={c.ccanalalt}
                nombre={c.xcanalalt}
                etiqueta="canal"
                onQuitar={() => quitar(c.ccanalalt)}
              />
            ))}
          </div>

          <BuscadorConLista
            id={`${idPrefix}-buscar`}
            placeholder="Buscar canal por nombre o código…"
            q={q}
            onQ={setQ}
            opciones={resultados.map((r) => ({ codigo: r.ccanalalt, nombre: r.xcanalalt }))}
            buscando={buscando}
            listaFallo={listaFallo}
            yaElegido={(codigo) => seleccionados.has(codigo)}
            onElegir={(o) => agregar({ ccanalalt: o.codigo, xcanalalt: o.nombre })}
          />

          {listaFallo && (
            <p className="text-[0.72rem] leading-relaxed text-amber-700">
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
