import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResumenErrores } from '@/components/ui/errores';
import {
  generarTramosPorAncho,
  siguienteTramo,
  validarTramos,
  type OpcionesTramos,
  type TramoEditable,
} from '@/lib/configurador';
import { idCelda, TablaEditable, type FilaTexto } from './TablaEditable';

// Tramos «desde / hasta / valor» sin huecos ni solapes, validados en el cliente antes de enviar. Lo usan las tasas
// por antigüedad (auto) y sirve igual para la tabla de edad (personas): cambian las etiquetas y `inicio`.

export interface TramosEditorProps extends OpcionesTramos {
  idBase: string;
  tramos: TramoEditable[];
  onChange: (tramos: TramoEditable[]) => void;
  etiquetaDesde?: string;
  etiquetaHasta?: string;
  etiquetaValor?: string;
  ayudaValor?: string;
  /** Muestra los errores (después del primer intento de guardar, para no regañar mientras se escribe). */
  mostrarErrores?: boolean;
  deshabilitado?: boolean;
}

/** true si los tramos se pueden enviar. */
export function tramosValidos(tramos: TramoEditable[], opciones: OpcionesTramos = {}) {
  return validarTramos(tramos, opciones).length === 0;
}

export function TramosEditor({
  idBase,
  tramos,
  onChange,
  etiquetaDesde = 'Desde',
  etiquetaHasta = 'Hasta',
  etiquetaValor = 'Valor',
  ayudaValor,
  mostrarErrores = true,
  deshabilitado,
  ...opciones
}: TramosEditorProps) {
  const inicio = opciones.inicio ?? 0;
  const errores = useMemo(() => validarTramos(tramos, opciones), [tramos, opciones]);
  const porFila = useMemo(() => {
    const out: Array<Record<string, string>> = tramos.map(() => ({}));
    for (const e of errores) {
      if (e.indice < 0 || e.campo === 'tabla') continue;
      const clave = e.campo;
      out[e.indice][clave] = out[e.indice][clave] ?? e.mensaje;
    }
    return out;
  }, [errores, tramos]);

  const [generar, setGenerar] = useState({ hasta: '', ancho: '', valor: '' });
  const [verGenerador, setVerGenerador] = useState(false);

  const filas: FilaTexto[] = tramos.map((t) => ({ desde: t.desde, hasta: t.hasta, valor: t.valor }));
  const aTramos = (f: FilaTexto[]): TramoEditable[] => f.map((x) => ({ desde: x.desde ?? '', hasta: x.hasta ?? '', valor: x.valor ?? '' }));

  const generados = generarTramosPorAncho(inicio, Number(generar.hasta), Number(generar.ancho), generar.valor.trim());

  return (
    <div className="space-y-3">
      {mostrarErrores && errores.length > 0 && (
        <ResumenErrores
          titulo={errores.length === 1 ? 'Hay 1 tramo por corregir:' : `Hay ${errores.length} cosas por corregir en los tramos:`}
          errores={errores.map((e) => ({
            id: e.indice >= 0 ? idCelda(idBase, e.indice, e.campo === 'tabla' ? 'desde' : e.campo) : undefined,
            mensaje: e.mensaje,
          }))}
        />
      )}
      <TablaEditable
        idBase={idBase}
        columnas={[
          { clave: 'desde', titulo: etiquetaDesde, tipo: 'entero', ancho: 'w-28' },
          { clave: 'hasta', titulo: etiquetaHasta, tipo: 'entero', ancho: 'w-28' },
          { clave: 'valor', titulo: etiquetaValor, tipo: 'numero', ayuda: ayudaValor },
        ]}
        filas={filas}
        onChange={(f) => onChange(aTramos(f))}
        errores={porFila}
        mostrarErrores={mostrarErrores}
        filaNueva={(f) => {
          const s = siguienteTramo(aTramos(f), inicio);
          return { desde: s.desde, hasta: s.hasta, valor: s.valor };
        }}
        textoAgregar="Agregar tramo"
        deshabilitada={deshabilitado}
      />
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setVerGenerador((v) => !v)} disabled={deshabilitado}>
          <Wand2 className="h-3.5 w-3.5" />
          {verGenerador ? 'Ocultar carga rápida' : 'Carga rápida: tramos de igual ancho'}
        </Button>
        {verGenerador && (
          <div className="mt-2 grid gap-2 rounded-xl border border-dashed border-slate-200 p-3 sm:grid-cols-4">
            <div>
              <Label htmlFor={`${idBase}-gen-hasta`}>Hasta</Label>
              <Input id={`${idBase}-gen-hasta`} inputMode="numeric" value={generar.hasta} onChange={(e) => setGenerar({ ...generar, hasta: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`${idBase}-gen-ancho`}>Cada cuánto</Label>
              <Input id={`${idBase}-gen-ancho`} inputMode="numeric" value={generar.ancho} onChange={(e) => setGenerar({ ...generar, ancho: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`${idBase}-gen-valor`}>{etiquetaValor} (opcional)</Label>
              <Input id={`${idBase}-gen-valor`} inputMode="decimal" value={generar.valor} onChange={(e) => setGenerar({ ...generar, valor: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                disabled={!generados.length}
                onClick={() => {
                  if (tramos.length && !window.confirm(`Se reemplazan los ${tramos.length} tramos de la tabla por ${generados.length} tramos nuevos. ¿Seguir?`)) return;
                  onChange(generados);
                  setVerGenerador(false);
                }}
              >
                {generados.length ? `Crear ${generados.length} tramos` : 'Crear tramos'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 sm:col-span-4">
              Desde {inicio} hasta el número indicado, en tramos del mismo ancho (el último puede quedar más corto).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
