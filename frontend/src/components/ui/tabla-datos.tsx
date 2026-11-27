import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ColumnaTabla<T> {
  id: string;
  titulo: ReactNode;
  /** Valor para ordenar y buscar. Sin él la columna no ordena (p. ej. acciones). */
  valor?: (fila: T) => string | number | null | undefined;
  /** Cómo se dibuja la celda (por defecto, el valor). */
  celda?: (fila: T, indice: number) => ReactNode;
  alinear?: 'derecha';
  className?: string;
}

interface Props<T> {
  filas: T[];
  columnas: ColumnaTabla<T>[];
  /** Clave estable de la fila; `indice` es la posición en `filas` (antes de ordenar). */
  claveFila: (fila: T, indice: number) => string;
  /** Texto buscable de la fila; por defecto, los valores de las columnas. */
  textoBusqueda?: (fila: T) => string;
  placeholderBusqueda?: string;
  /** «3 coberturas»: recibe la cantidad. */
  contar: (n: number) => string;
  /** Pantalla vacía con guía (mensaje + botón de crear) cuando no hay ninguna fila. */
  vacio: ReactNode;
  /** Fila desplegada bajo una fila (p. ej. un editor); devuelve null si no hay. */
  filaExtra?: (fila: T, indice: number) => ReactNode | null;
  minWidth?: number;
  /** Contenido junto a la búsqueda (filtros extra). */
  barra?: ReactNode;
}

type Orden = { id: string; dir: 1 | -1 } | null;

const comparar = (a: string | number | null | undefined, b: string | number | null | undefined) => {
  const vacioA = a == null || a === '';
  const vacioB = b == null || b === '';
  if (vacioA || vacioB) return vacioA === vacioB ? 0 : vacioA ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
};

/**
 * Tabla de listas del configurador: encabezado fijo al hacer scroll, búsqueda por texto, orden por columna
 * (clic en el título; segundo clic invierte; tercero quita el orden) y pantalla vacía con guía.
 */
export function TablaDatos<T>({
  filas,
  columnas,
  claveFila,
  textoBusqueda,
  placeholderBusqueda = 'Buscar…',
  contar,
  vacio,
  filaExtra,
  minWidth = 720,
  barra,
}: Props<T>) {
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState<Orden>(null);

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    let items = filas.map((fila, indice) => ({ fila, indice }));
    if (texto) {
      items = items.filter(({ fila }) => {
        const t = textoBusqueda ? textoBusqueda(fila) : columnas.map((c) => c.valor?.(fila) ?? '').join(' ');
        return t.toLowerCase().includes(texto);
      });
    }
    const col = orden ? columnas.find((c) => c.id === orden.id) : undefined;
    if (orden && col?.valor) {
      const valor = col.valor;
      const dir = orden.dir;
      items = [...items].sort((x, y) => dir * comparar(valor(x.fila), valor(y.fila)));
    }
    return items;
  }, [filas, columnas, q, orden, textoBusqueda]);

  if (filas.length === 0) return <>{vacio}</>;

  function alternar(id: string) {
    setOrden((o) => (!o || o.id !== id ? { id, dir: 1 } : o.dir === 1 ? { id, dir: -1 } : null));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="!py-2 pl-8 pr-8 text-sm"
            placeholder={placeholderBusqueda}
            aria-label={placeholderBusqueda}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => setQ('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {barra}
        <p className="ml-auto text-xs text-muted-foreground">
          {q.trim() && visibles.length !== filas.length
            ? `${visibles.length} de ${contar(filas.length)}`
            : contar(filas.length)}
        </p>
      </div>

      <div className="tabla-cabecera-fija rounded-xl border border-border/60">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              {columnas.map((c) => {
                const activa = orden?.id === c.id;
                const ordenable = Boolean(c.valor);
                return (
                  <th
                    key={c.id}
                    className={cn('px-3 py-2', c.alinear === 'derecha' && 'text-right', c.className)}
                    aria-sort={activa ? (orden?.dir === 1 ? 'ascending' : 'descending') : ordenable ? 'none' : undefined}
                  >
                    {ordenable ? (
                      <button
                        type="button"
                        className={cn('inline-flex items-center gap-1 uppercase hover:text-foreground', activa && 'text-foreground')}
                        onClick={() => alternar(c.id)}
                        title="Ordenar por esta columna"
                      >
                        {c.titulo}
                        {activa ? (
                          orden?.dir === 1 ? (
                            <ArrowUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
                        )}
                      </button>
                    ) : (
                      c.titulo
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.map(({ fila, indice }) => (
              <Fragment key={claveFila(fila, indice)}>
                <tr className="border-b border-border/30">
                  {columnas.map((c) => (
                    <td key={c.id} className={cn('px-3 py-2 text-xs', c.alinear === 'derecha' && 'text-right', c.className)}>
                      {c.celda ? c.celda(fila, indice) : (c.valor?.(fila) ?? '—')}
                    </td>
                  ))}
                </tr>
                {filaExtra?.(fila, indice)}
              </Fragment>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nada coincide con «{q}».{' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => setQ('')}
                  >
                    Quitar la búsqueda
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Pantalla vacía con guía: qué es esta lista, por qué está vacía y el botón para crear lo primero. */
export function VacioConGuia({
  icono,
  titulo,
  texto,
  accion,
}: {
  icono?: ReactNode;
  titulo: string;
  texto: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      {icono && <div className="mb-3 text-primary">{icono}</div>}
      <h2 className="text-base font-bold">{titulo}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{texto}</p>
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
