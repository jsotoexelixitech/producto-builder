import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface Parentesco {
  cparen: number;
  xparentesco: string;
}

/** Nombres conocidos por si el catálogo de Sis2000 (maparent) no responde. */
const RESPALDO: Parentesco[] = [{ cparen: 1, xparentesco: 'TITULAR' }];

/** «1, 2, 3» → [1, 2, 3] (ignora lo que no sea entero ≥ 1). */
export function codigosDeTexto(texto: string): number[] {
  return texto
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x))
    .map(Number)
    .filter((n) => n >= 1);
}

const aTexto = (codigos: number[]) => [...new Set(codigos)].sort((a, b) => a - b).join(', ');

/** Nombre legible: «Titular», «Cónyuge»… (maparent viene en mayúsculas). */
export function nombreParentesco(p: Parentesco | undefined, cparen: number): string {
  const x = (p?.xparentesco ?? '').trim();
  if (!x) return `Parentesco ${cparen}`;
  return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
}

interface Props {
  /** Códigos como texto («1, 2»): es lo que guarda la pantalla. */
  value: string;
  onChange: (texto: string) => void;
  idPrefix?: string;
  /** Avisa el catálogo cargado (para mostrar nombres en el resumen). */
  onCatalogo?: (lista: Parentesco[]) => void;
}

/**
 * Selector múltiple de parentescos con nombre (catálogo maparent de Sis2000). Si el catálogo no responde, deja escribir
 * los códigos separados por coma como antes.
 */
export function ParentescosSelector({ value, onChange, idPrefix = 'paren', onCatalogo }: Props) {
  const [lista, setLista] = useState<Parentesco[] | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    api
      .listSis2000Parentescos()
      .then((rows) => {
        if (!vigente) return;
        const out = (rows ?? [])
          .map((r) => ({ cparen: Number(r.cparen), xparentesco: String(r.xparentesco ?? '').trim() }))
          .filter((r) => Number.isInteger(r.cparen) && r.cparen >= 1);
        setLista(out.length ? out : RESPALDO);
        setFallo(!out.length);
        onCatalogo?.(out.length ? out : RESPALDO);
      })
      .catch(() => {
        if (!vigente) return;
        setLista(RESPALDO);
        setFallo(true);
        onCatalogo?.(RESPALDO);
      });
    return () => {
      vigente = false;
    };
    // onCatalogo solo se avisa al cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elegidos = codigosDeTexto(value);

  function alternar(cparen: number, marcado: boolean) {
    const sin = elegidos.filter((c) => c !== cparen);
    onChange(aTexto(marcado ? [...sin, cparen] : sin));
  }

  if (!lista) return <div className="h-[42px] animate-pulse rounded-xl bg-muted/60" />;

  // Códigos escritos que no están en el catálogo: se muestran igual para no perderlos.
  const extra = elegidos.filter((c) => !lista.some((p) => p.cparen === c));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Parentescos del plan">
        {[...lista, ...extra.map((c) => ({ cparen: c, xparentesco: '' }))].map((p) => {
          const marcado = elegidos.includes(p.cparen);
          return (
            <label
              key={p.cparen}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                marcado ? 'border-indigo-400 bg-indigo-50 text-indigo-900' : 'border-border/60 bg-card',
              )}
            >
              <input
                id={`${idPrefix}-${p.cparen}`}
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={marcado}
                onChange={(e) => alternar(p.cparen, e.target.checked)}
              />
              {nombreParentesco(p, p.cparen)}
              <span className="font-mono text-[10px] text-muted-foreground">{p.cparen}</span>
            </label>
          );
        })}
      </div>
      {fallo && (
        <div className="space-y-1">
          <p className="text-xs text-amber-700">
            No se pudo leer el catálogo de parentescos de Sis2000. Escribe los códigos separados por coma (1 = titular).
          </p>
          <Input id={`${idPrefix}-texto`} value={value} placeholder="1, 2, 3" onChange={(e) => onChange(e.target.value)} />
        </div>
      )}
    </div>
  );
}
