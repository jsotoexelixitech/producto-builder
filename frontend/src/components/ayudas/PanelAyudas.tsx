import { useId, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { CheckCircle2, ChevronDown, Circle, Lock, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { construirChecklist, type EstadoItem, type GrupoEntrada, type PasoEntrada } from '@/lib/ayudas/checklist';
import { aNumeroEs, estimarPrimaAuto } from '@/lib/ayudas/prima-auto';
import { resumenEnPalabras, type EntradaResumen } from '@/lib/ayudas/resumen-plan';
import { useAyudas } from './AyudasProvider';

export interface DatosAutoAyudas {
  /** El plan es de auto y tiene la sección de tarifa por días (tasa diaria). */
  mostrar: boolean;
  /** Suma asegurada que ya hay en pantalla (0 = ninguna). */
  sumaInicial: number;
  moneda: string;
}

const ICONO: Record<EstadoItem, { Icono: typeof Circle; clase: string; etiqueta: string }> = {
  hecho: { Icono: CheckCircle2, clase: 'text-emerald-600', etiqueta: 'Hecho' },
  falta: { Icono: TriangleAlert, clase: 'text-amber-600', etiqueta: 'Falta' },
  revisar: { Icono: TriangleAlert, clase: 'text-amber-600', etiqueta: 'Revisar' },
  pendiente: { Icono: Circle, clase: 'text-slate-400', etiqueta: 'Pendiente' },
  bloqueado: { Icono: Lock, clase: 'text-slate-300', etiqueta: 'Bloqueado' },
};

/**
 * Panel lateral de la vista con ayudas (debajo del contenido en pantallas angostas): checklist «¿Se puede emitir?»,
 * resumen en palabras antes de guardar y, en planes de auto con tasa diaria, un estimado de prima. Solo lee lo que ya
 * está en pantalla: no llama al servidor ni guarda nada.
 */
export function PanelAyudas({
  pasos,
  grupos,
  resumen,
  auto,
  paso,
  onIr,
}: {
  pasos: PasoEntrada[];
  grupos: GrupoEntrada[];
  resumen: EntradaResumen;
  auto: DatosAutoAyudas;
  paso: number;
  onIr: (indice: number) => void;
}) {
  const { activas } = useAyudas();
  const [abierto, setAbierto] = useState(true);
  const idCuerpo = useId();
  if (!activas) return null;
  const lista = construirChecklist(pasos, grupos);

  return (
    <aside aria-label="Ayudas del plan" className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={idCuerpo}
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        Ayudas del plan
        <ChevronDown className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', abierto && 'rotate-180')} aria-hidden />
      </button>
      {abierto && (
        <div id={idCuerpo} className="space-y-4 border-t border-slate-100 px-4 py-3 text-xs">
          <section aria-label="¿Se puede emitir?">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-800">¿Se puede emitir?</h3>
              <span className={cn('font-semibold', lista.puedeEmitir ? 'text-emerald-700' : 'text-amber-700')}>
                {lista.hechos} de {lista.total}
              </span>
            </div>
            <div
              className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={lista.porcentaje}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avance para poder emitir"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 motion-reduce:transition-none"
                style={{ width: `${lista.porcentaje}%` }}
              />
            </div>
            <p className={cn('mb-2 font-medium', lista.puedeEmitir ? 'text-emerald-700' : 'text-slate-600')}>
              {lista.puedeEmitir ? 'Sí: todo está listo.' : 'Todavía no: falta lo marcado abajo. Toca un punto para ir a ese paso.'}
            </p>
            <ul className="space-y-1">
              {lista.items.map((it) => {
                const { Icono, clase, etiqueta } = ICONO[it.estado];
                const actual = it.indice === paso;
                return (
                  <li key={it.indice}>
                    <button
                      type="button"
                      disabled={it.estado === 'bloqueado'}
                      onClick={() => onIr(it.indice)}
                      aria-current={actual ? 'step' : undefined}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:hover:bg-transparent',
                        actual && 'bg-indigo-50',
                      )}
                    >
                      <Icono className={cn('mt-0.5 h-4 w-4 shrink-0', clase)} aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-800">
                          {it.titulo} <span className="sr-only">({etiqueta})</span>
                        </span>
                        <span className="block text-slate-500">{it.detalle}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="Antes de guardar" className="border-t border-slate-100 pt-3">
            <h3 className="mb-1 font-semibold text-slate-800">Antes de guardar</h3>
            <p className="leading-relaxed text-slate-600">{resumenEnPalabras(resumen)}</p>
          </section>

          {auto.mostrar && <SimuladorPrima sumaInicial={auto.sumaInicial} moneda={auto.moneda} />}
        </div>
      )}
    </aside>
  );
}

/** Estimado de prima de auto con tasa diaria. Lo que se escribe aquí no se guarda en ninguna parte. */
function SimuladorPrima({ sumaInicial, moneda }: { sumaInicial: number; moneda: string }) {
  const id = useId();
  const [suma, setSuma] = useState<string | null>(null);
  const [tasa, setTasa] = useState('');
  const [dias, setDias] = useState('');
  const [descuento, setDescuento] = useState('');
  const sumaTexto = suma ?? (sumaInicial > 0 ? String(sumaInicial) : '');
  const est = estimarPrimaAuto({
    suma: aNumeroEs(sumaTexto),
    tasaDiariaPct: aNumeroEs(tasa),
    dias: aNumeroEs(dias),
    descuentoPct: descuento.trim() ? aNumeroEs(descuento) : 0,
  });
  const campo = (etiqueta: string, valor: string, set: (v: string) => void, ayuda: string, clave: string) => (
    <label className="block" htmlFor={`${id}-${clave}`}>
      <span className="text-slate-600">{etiqueta}</span>
      <input
        id={`${id}-${clave}`}
        inputMode="decimal"
        value={valor}
        onChange={(e) => set(e.target.value)}
        placeholder={ayuda}
        className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
      />
    </label>
  );
  return (
    <section aria-label="Estimado de prima" className="border-t border-slate-100 pt-3">
      <h3 className="mb-1 font-semibold text-slate-800">Estimado de prima</h3>
      <p className="mb-2 text-slate-500">Escribe los datos para ver una cuenta rápida. Lo que escribes aquí no se guarda.</p>
      <div className="grid grid-cols-2 gap-2">
        {campo('Suma asegurada', sumaTexto, setSuma, 'Ej. 20000', 'suma')}
        {campo('Tasa diaria (%)', tasa, setTasa, 'Ej. 0,072', 'tasa')}
        {campo('Días', dias, setDias, 'Ej. 30', 'dias')}
        {campo('Descuento por deducible (%)', descuento, setDescuento, 'Opcional', 'desc')}
      </div>
      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2" aria-live="polite">
        {est ? (
          <>
            <p className="text-slate-600">
              Sin deducible: <strong>{moneda} <NumberFlow value={est.primaBase} locales="es" format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /></strong>
            </p>
            {est.descuento > 0 && (
              <p className="font-semibold text-emerald-700">
                Con deducible: {moneda} <NumberFlow value={est.primaFinal} locales="es" format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
              </p>
            )}
          </>
        ) : (
          <p className="text-slate-500">Completa suma, tasa y días para ver el estimado.</p>
        )}
      </div>
      <p className="mt-2 font-medium text-amber-800">Estimado: la prima oficial la calcula Sis2000 al cotizar.</p>
    </section>
  );
}
