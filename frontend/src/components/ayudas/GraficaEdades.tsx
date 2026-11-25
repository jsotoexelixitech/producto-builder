import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoEdad } from '@/lib/ayudas/mapa-plan';

/** Barras de la tasa (% sobre la suma) por tramo de edad. Las tablas con prima fija en vez de tasa muestran la prima. */
export default function GraficaEdades({ serie }: { serie: PuntoEdad[] }) {
  const conTasa = serie.some((p) => p.tasa > 0);
  const clave = conTasa ? 'tasa' : 'prima';
  const nombre = conTasa ? 'Tasa (%)' : 'Prima fija';
  return (
    <div className="min-h-[320px] flex-1 rounded-xl border border-slate-200 p-3" role="img" aria-label={`Gráfica de ${nombre.toLowerCase()} por tramo de edad`}>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={serie} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="tramo" tick={{ fontSize: 11 }} label={{ value: 'Edad (años)', position: 'insideBottom', offset: -2, fontSize: 11 }} height={40} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip formatter={(v) => [String(v), nombre]} labelFormatter={(l) => `Edad ${l}`} />
          <Bar dataKey={clave} name={nombre} fill="#4f46e5" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
