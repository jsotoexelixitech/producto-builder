import { lazy, Suspense, useMemo, useState } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';
import { construirMapa, serieTarifaEdad, type DatosMapa, type TipoNodoMapa } from '@/lib/ayudas/mapa-plan';

// recharts solo se baja si hay una tabla de edad para graficar y se abre esa pestaña.
const GraficaEdades = lazy(() => import('./GraficaEdades'));

const CLASE: Record<TipoNodoMapa, string> = {
  producto: 'border-indigo-300 bg-indigo-50 text-indigo-900',
  plan: 'border-violet-300 bg-violet-50 text-violet-900',
  cobertura: 'border-slate-300 bg-white text-slate-800',
  tarifa: 'border-emerald-300 bg-emerald-50 text-emerald-900',
};
const TITULO: Record<TipoNodoMapa, string> = { producto: 'Producto', plan: 'Plan', cobertura: 'Cobertura', tarifa: 'Tarifa' };

function NodoPlan({ data }: NodeProps<Node<{ tipo: TipoNodoMapa; etiqueta: string }>>) {
  return (
    <div className={cn('w-[220px] rounded-xl border px-3 py-2 text-xs shadow-sm', CLASE[data.tipo])}>
      <Handle type="target" position={Position.Left} isConnectable={false} className="!bg-slate-300" />
      <p className="text-[0.6rem] font-semibold uppercase tracking-wide opacity-60">{TITULO[data.tipo]}</p>
      <p className="font-semibold leading-snug">{data.etiqueta}</p>
      <Handle type="source" position={Position.Right} isConnectable={false} className="!bg-slate-300" />
    </div>
  );
}
const TIPOS_NODO = { plan: NodoPlan };

/** Mapa de solo lectura del plan con lo que ya está en pantalla, y gráfica de tarifas por edad si hay tablas leídas. */
export default function MapaPlan({ datos }: { datos: DatosMapa }) {
  const [vista, setVista] = useState<'mapa' | string>('mapa');
  const { nodos, aristas } = useMemo(() => construirMapa(datos), [datos]);
  const nodes = useMemo<Node[]>(
    () => nodos.map((n) => ({ id: n.id, type: 'plan', position: { x: n.x, y: n.y }, data: { tipo: n.tipo, etiqueta: n.etiqueta }, draggable: false, connectable: false })),
    [nodos],
  );
  const edges = useMemo<Edge[]>(() => aristas.map((a) => ({ id: a.id, source: a.origen, target: a.destino })), [aristas]);
  const conSerie = datos.tablasEdad.filter((t) => serieTarifaEdad(t).length > 0);
  const tabla = conSerie.find((t) => t.codigo === vista);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {conSerie.length > 0 && (
        <div role="tablist" aria-label="Vista" className="flex flex-wrap gap-1 text-xs">
          {[{ id: 'mapa', titulo: 'Mapa del plan' }, ...conSerie.map((t) => ({ id: t.codigo, titulo: `Tarifa por edad: ${t.nombre || t.codigo}` }))].map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={vista === p.id}
              onClick={() => setVista(p.id)}
              className={cn(
                'rounded-full border px-3 py-1 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                vista === p.id ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {p.titulo}
            </button>
          ))}
        </div>
      )}
      {tabla ? (
        <Suspense fallback={<p className="p-4 text-xs text-slate-500">Cargando gráfica…</p>}>
          <GraficaEdades serie={serieTarifaEdad(tabla)} />
        </Suspense>
      ) : (
        <div className="min-h-[320px] flex-1 rounded-xl border border-slate-200" aria-label="Mapa del plan: producto, plan, coberturas y tarifas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={TIPOS_NODO}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      )}
      <p className="text-xs text-slate-500">Solo lectura: se arma con lo que ya tienes en pantalla; no guarda ni cambia nada.</p>
    </div>
  );
}
