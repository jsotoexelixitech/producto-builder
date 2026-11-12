import { useMemo, useState } from 'react';
import { Divide } from 'lucide-react';
import {
  diasDeEjemplo,
  formatoMonto2,
  leerNumero,
  redondear2,
  repartirIgual,
  repartirPorcentaje,
} from '@/lib/sis2000-tramos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InfoTip } from '@/components/ui/info-tip';

interface Props {
  /** Coberturas del plan (código + nombre). */
  coberturas: Array<{ ccobertura: string; nombre: string }>;
  /** Códigos de las obligatorias (se proponen para el reparto). Vacío = todas. */
  obligatorias?: string[];
  /** Prima diaria actual por cobertura (texto del input). */
  primas: Record<string, string>;
  diasMin: number;
  diasMax: number;
  moneda: string;
  /** Aplica las primas diarias calculadas (código → monto con 2 decimales). */
  onAplicar: (primas: Record<string, string>) => void;
}

/**
 * Plan por días (viajero): reparte una prima diaria total entre las coberturas (partes iguales o por porcentaje, a 2
 * decimales con el centavo ajustado en la última) y muestra cuánto se cobraría por 1, 3, 7 y el máximo de días.
 */
export function RepartoPrimaDiaria({ coberturas, obligatorias = [], primas, diasMin, diasMax, moneda, onAplicar }: Props) {
  const [total, setTotal] = useState('');
  const [modo, setModo] = useState<'igual' | 'porcentaje'>('igual');
  const [soloObligatorias, setSoloObligatorias] = useState(obligatorias.length > 0);
  const [porcentajes, setPorcentajes] = useState<Record<string, string>>({});

  const destino = useMemo(() => {
    const oblig = new Set(obligatorias.map((c) => c.trim().toUpperCase()));
    return soloObligatorias && oblig.size ? coberturas.filter((c) => oblig.has(c.ccobertura.toUpperCase())) : coberturas;
  }, [coberturas, obligatorias, soloObligatorias]);

  const totalNum = Number(leerNumero(total));
  const pesos = destino.map((c) => Number(leerNumero(porcentajes[c.ccobertura] ?? '')) || 0);
  const sumaPesos = pesos.reduce((s, p) => s + p, 0);
  const partes =
    totalNum > 0 && destino.length
      ? modo === 'igual'
        ? repartirIgual(totalNum, destino.length)
        : repartirPorcentaje(totalNum, pesos)
      : [];

  const totalActual = redondear2(
    coberturas.reduce((s, c) => s + (Number(leerNumero(primas[c.ccobertura] ?? '')) || 0), 0),
  );
  const ejemplos = diasDeEjemplo(diasMax, diasMin);

  function aplicar() {
    if (!partes.length) return;
    const nuevas: Record<string, string> = {};
    // Las coberturas que no entran en el reparto quedan en 0.
    coberturas.forEach((c) => {
      nuevas[c.ccobertura] = '0';
    });
    destino.forEach((c, i) => {
      nuevas[c.ccobertura] = partes[i].toFixed(2);
    });
    onAplicar(nuevas);
  }

  return (
    <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
        <Divide className="h-3.5 w-3.5" />
        Repartir una prima diaria entre las coberturas
        <InfoTip text="Ej.: si el plan cobra 1,53 por día, escribe 1,53 y se reparte entre las coberturas. Cada parte se redondea a 2 decimales y el centavo que sobre o falte se suma a la última, así el total da exacto." />
      </p>
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="grid gap-1">
          Prima diaria total ({moneda || '—'})
          <Input
            className="h-8 w-28 px-2 text-right text-xs"
            inputMode="decimal"
            placeholder="1,53"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="radio" className="accent-primary" checked={modo === 'igual'} onChange={() => setModo('igual')} />
          Partes iguales
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="radio" className="accent-primary" checked={modo === 'porcentaje'} onChange={() => setModo('porcentaje')} />
          Por porcentaje
        </label>
        {obligatorias.length > 0 && (
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              className="accent-primary"
              checked={soloObligatorias}
              onChange={(e) => setSoloObligatorias(e.target.checked)}
            />
            Solo coberturas obligatorias
          </label>
        )}
      </div>

      {destino.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1">Cobertura</th>
              {modo === 'porcentaje' && <th className="w-24 py-1 text-right">%</th>}
              <th className="w-28 py-1 text-right">Quedaría</th>
            </tr>
          </thead>
          <tbody>
            {destino.map((c, i) => (
              <tr key={c.ccobertura} className="border-t border-indigo-100">
                <td className="py-1">
                  <span className="font-mono">{c.ccobertura}</span>
                  {c.nombre && <span className="text-slate-500"> · {c.nombre}</span>}
                </td>
                {modo === 'porcentaje' && (
                  <td className="py-1 text-right">
                    <Input
                      aria-label={`Porcentaje de ${c.ccobertura}`}
                      className="ml-auto h-7 w-20 px-2 text-right text-xs"
                      inputMode="decimal"
                      value={porcentajes[c.ccobertura] ?? ''}
                      onChange={(e) => setPorcentajes((p) => ({ ...p, [c.ccobertura]: e.target.value }))}
                    />
                  </td>
                )}
                <td className="py-1 text-right font-medium">{partes[i] != null ? formatoMonto2(partes[i]) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modo === 'porcentaje' && sumaPesos > 0 && Math.abs(sumaPesos - 100) > 0.001 && (
        <p className="text-xs text-amber-700">
          Los porcentajes suman {formatoMonto2(sumaPesos)} %: se reparten en proporción (como si sumaran 100 %).
        </p>
      )}
      <Button type="button" size="sm" onClick={aplicar} disabled={!partes.length}>
        Poner estas primas diarias
      </Button>

      {totalActual > 0 && (
        <div className="rounded-lg border border-border/50 bg-white p-2 text-xs">
          <p className="mb-1 font-semibold text-slate-700">
            Así se cobrará (prima diaria {formatoMonto2(totalActual)} {moneda} × días, máximo {diasMax || '—'} días)
          </p>
          <div className="flex flex-wrap gap-2">
            {ejemplos.map((d) => (
              <span key={d} className="rounded-md bg-slate-50 px-2 py-1">
                {d} día{d === 1 ? '' : 's'}: <strong>{formatoMonto2(redondear2(totalActual * d))}</strong> {moneda}
                {d === diasMax ? ' (máximo)' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
