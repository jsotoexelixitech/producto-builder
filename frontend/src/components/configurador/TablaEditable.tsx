import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { cn } from '@/lib/utils';

// Tabla de filas editables con validación por campo. Genérica: la usan los tramos (antigüedad, edad) y cualquier
// sección que necesite cargar varias filas a la vez. Los valores se editan como texto; quien la usa convierte al guardar.

export type FilaTexto = Record<string, string>;

export interface ColumnaEditable {
  clave: string;
  titulo: string;
  tipo?: 'texto' | 'numero' | 'entero' | 'fecha' | 'select';
  opciones?: Array<{ valor: string; etiqueta: string }>;
  /** Ayuda del (i) junto al título (aquí puede ir el nombre de la columna en Sis2000). */
  ayuda?: string;
  placeholder?: string;
  soloLectura?: boolean;
  /** Clase del ancho de la columna (p. ej. «w-28»). */
  ancho?: string;
  /** Error del campo para esa fila (undefined = bien). */
  validar?: (valor: string, fila: FilaTexto, indice: number) => string | undefined;
}

/** Errores de cada fila por columna, con las reglas `validar` de las columnas. */
export function validarTabla(columnas: ColumnaEditable[], filas: FilaTexto[]): Array<Record<string, string>> {
  return filas.map((fila, i) => {
    const e: Record<string, string> = {};
    for (const c of columnas) {
      const m = c.validar?.(fila[c.clave] ?? '', fila, i);
      if (m) e[c.clave] = m;
    }
    return e;
  });
}

/** id del input de una celda (para llevar el foco desde un resumen de errores). */
export const idCelda = (idBase: string, indice: number, clave: string) => `${idBase}-${indice}-${clave}`;

export function TablaEditable({
  idBase,
  columnas,
  filas,
  onChange,
  errores = [],
  mostrarErrores = true,
  filaNueva,
  textoAgregar = 'Agregar fila',
  puedeQuitar = true,
  minimoFilas = 0,
  deshabilitada,
  className,
}: {
  idBase: string;
  columnas: ColumnaEditable[];
  filas: FilaTexto[];
  onChange: (filas: FilaTexto[]) => void;
  /** Errores por fila y columna (de validarTabla o de reglas de la tabla completa, p. ej. tramos). */
  errores?: Array<Record<string, string> | undefined>;
  mostrarErrores?: boolean;
  /** Si se da, aparece «Agregar fila» y la fila nueva sale de aquí (recibe las filas actuales). */
  filaNueva?: (filas: FilaTexto[]) => FilaTexto;
  textoAgregar?: string;
  puedeQuitar?: boolean;
  minimoFilas?: number;
  deshabilitada?: boolean;
  className?: string;
}) {
  const cambiar = (i: number, clave: string, valor: string) =>
    onChange(filas.map((f, j) => (j === i ? { ...f, [clave]: valor } : f)));

  return (
    <div className={cn('space-y-2', className)}>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase text-slate-500">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              {columnas.map((c) => (
                <th key={c.clave} className={cn('px-2 py-2', c.ancho)}>
                  <span className="inline-flex items-center gap-1">
                    {c.titulo}
                    {c.ayuda && <InfoTip text={c.ayuda} />}
                  </span>
                </th>
              ))}
              {puedeQuitar && <th className="w-10 px-2 py-2" aria-label="Quitar" />}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={columnas.length + 2} className="px-3 py-4 text-center text-slate-500">
                  No hay filas.
                </td>
              </tr>
            )}
            {filas.map((fila, i) => (
              <tr key={i} className="border-b border-slate-100 align-top last:border-0">
                <td className="px-2 py-2 text-slate-400">{i + 1}</td>
                {columnas.map((c) => {
                  const error = mostrarErrores ? errores[i]?.[c.clave] : undefined;
                  const id = idCelda(idBase, i, c.clave);
                  const comun = {
                    id,
                    'aria-label': `${c.titulo} (fila ${i + 1})`,
                    'aria-invalid': Boolean(error),
                    disabled: deshabilitada || c.soloLectura,
                    className: cn(
                      'h-9 w-full rounded-lg border bg-white px-2 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500',
                      error ? 'border-red-300 bg-red-50/40' : 'border-slate-200',
                    ),
                  };
                  return (
                    <td key={c.clave} className="px-2 py-1.5">
                      {c.tipo === 'select' ? (
                        <select {...comun} value={fila[c.clave] ?? ''} onChange={(e) => cambiar(i, c.clave, e.target.value)}>
                          {(c.opciones ?? []).map((o) => (
                            <option key={o.valor} value={o.valor}>
                              {o.etiqueta}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          {...comun}
                          type={c.tipo === 'fecha' ? 'date' : 'text'}
                          inputMode={c.tipo === 'numero' ? 'decimal' : c.tipo === 'entero' ? 'numeric' : undefined}
                          placeholder={c.placeholder}
                          value={fila[c.clave] ?? ''}
                          onChange={(e) => cambiar(i, c.clave, e.target.value)}
                        />
                      )}
                      {error && <p className="mt-0.5 text-[11px] leading-snug text-red-700">{error}</p>}
                    </td>
                  );
                })}
                {puedeQuitar && (
                  <td className="px-1 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2"
                      aria-label={`Quitar fila ${i + 1}`}
                      title="Quitar fila"
                      disabled={deshabilitada || filas.length <= minimoFilas}
                      onClick={() => onChange(filas.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filaNueva && (
        <Button type="button" variant="outline" size="sm" disabled={deshabilitada} onClick={() => onChange([...filas, filaNueva(filas)])}>
          <Plus className="h-3.5 w-3.5" />
          {textoAgregar}
        </Button>
      )}
    </div>
  );
}
