import { useId, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import NumberFlow from '@number-flow/react';
import { ArrowRight, CheckCircle2, Circle, Lock, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Checklist, EstadoItem } from '@/lib/ayudas/checklist';
import { aNumeroEs, estimarPrimaAuto } from '@/lib/ayudas/prima-auto';
import { resumenEnPalabras, type EntradaResumen } from '@/lib/ayudas/resumen-plan';
import type { DatosMapa } from '@/lib/ayudas/mapa-plan';
import { useAyudas } from './AyudasProvider';
import { GuiaCombo } from './GuiaCombo';
import { BotonMapa } from './BotonMapa';

export interface DatosAutoAyudas {
  /** El plan es de auto y tiene la sección de tarifa por días (tasa diaria). */
  mostrar: boolean;
  /** Suma asegurada que ya hay en pantalla (0 = ninguna). */
  sumaInicial: number;
  moneda: string;
}

/** Lo que ya mostraba «Tu plan», ahora en la pestaña Resumen. */
export interface DatosResumenPlan {
  producto: string;
  tipo: string;
  coberturas: number;
  /** Prima de referencia ya formateada (null = no aplica, p. ej. personas). */
  prima: string | null;
  /** Asegurados (solo personas). */
  asegurados: string | null;
  plan: string;
}

const ICONO: Record<EstadoItem, { Icono: typeof Circle; clase: string; etiqueta: string }> = {
  hecho: { Icono: CheckCircle2, clase: 'text-emerald-600', etiqueta: 'Hecho' },
  falta: { Icono: TriangleAlert, clase: 'text-amber-600', etiqueta: 'Falta' },
  revisar: { Icono: TriangleAlert, clase: 'text-amber-600', etiqueta: 'Revisar' },
  pendiente: { Icono: Circle, clase: 'text-slate-500', etiqueta: 'Pendiente' },
  bloqueado: { Icono: Lock, clase: 'text-slate-500', etiqueta: 'Bloqueado' },
};

/** Anillo de avance. El número es el mismo de la barra de pasos (una sola fuente: el checklist). */
function Anillo({ porcentaje }: { porcentaje: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="cb-anillo" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del plan">
      <svg viewBox="0 0 80 80" aria-hidden>
        <defs>
          <linearGradient id="cb-anillo-neon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a98bff" />
            <stop offset="55%" stopColor="#6fb1ff" />
            <stop offset="100%" stopColor="#ff8f91" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} className="cb-anillo-fondo" />
        <circle cx="40" cy="40" r={r} className="cb-anillo-valor" strokeDasharray={c} strokeDashoffset={c - (c * porcentaje) / 100} />
      </svg>
      <span>{porcentaje} %</span>
    </div>
  );
}

/**
 * Panel derecho de la vista con ayudas: un solo panel con pestañas Resumen, Checklist y (planes de auto con tasa
 * diaria) Estimado. Solo lee lo que ya está en pantalla: no llama al servidor ni guarda nada.
 */
export function PanelAyudas({
  checklist,
  datos,
  resumen,
  auto,
  mapa,
  paso,
  onIr,
}: {
  checklist: Checklist;
  datos: DatosResumenPlan;
  resumen: EntradaResumen;
  auto: DatosAutoAyudas;
  mapa: DatosMapa;
  paso: number;
  onIr: (indice: number) => void;
}) {
  const { activas } = useAyudas();
  const [pestana, setPestana] = useState('resumen');
  if (!activas) return null;
  const lista = checklist;
  const proximos = lista.items.filter((i) => i.estado === 'falta' || i.estado === 'revisar' || i.estado === 'pendiente').slice(0, 3);
  const pestanas = [
    { id: 'resumen', titulo: 'Resumen' },
    { id: 'checklist', titulo: 'Checklist' },
    ...(auto.mostrar ? [{ id: 'estimado', titulo: 'Estimado' }] : []),
  ];
  const valorPestana = pestanas.some((p) => p.id === pestana) ? pestana : 'resumen';

  return (
    <aside aria-label="Ayudas del plan" className="cb-panel-caja">
      <Tabs.Root value={valorPestana} onValueChange={setPestana}>
        <Tabs.List aria-label="Panel del plan" className="cb-tabs">
          {pestanas.map((p) => (
            <Tabs.Trigger key={p.id} value={p.id} className="cb-tab">
              {p.titulo}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="resumen" className="cb-tab-contenido">
          <section aria-label="Resumen del plan">
            <div className="cb-resumen-cabeza">
              <Anillo porcentaje={lista.porcentaje} />
              <div>
                <p className={cn('cb-resumen-estado', lista.puedeEmitir ? 'text-emerald-700' : 'text-slate-900')}>
                  {lista.puedeEmitir ? 'Todo listo para emitir' : `${lista.hechos} de ${lista.total} pasos listos`}
                </p>
                <p className="text-slate-600">{lista.puedeEmitir ? 'No falta nada.' : 'Esto es lo que sigue.'}</p>
              </div>
            </div>
            <dl className="cb-datos">
              <div><dt>Producto</dt><dd>{datos.producto || '—'}</dd></div>
              <div><dt>Tipo</dt><dd>{datos.tipo}</dd></div>
              <div><dt>Coberturas</dt><dd>{datos.coberturas}</dd></div>
              {datos.prima && <div><dt>Prima de referencia</dt><dd className="cb-dato-neon">{datos.prima}</dd></div>}
              {datos.asegurados && <div><dt>Asegurados</dt><dd>{datos.asegurados}</dd></div>}
              <div><dt>Plan</dt><dd>{datos.plan || '—'}</dd></div>
            </dl>
            {proximos.length > 0 && (
              <div className="cb-proximos">
                <h3>Lo que sigue</h3>
                <ul>
                  {proximos.map((it) => {
                    const { Icono, clase } = ICONO[it.estado];
                    return (
                      <li key={it.indice}>
                        <Icono className={cn('h-5 w-5 shrink-0', clase)} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <strong>{it.titulo}</strong>
                          <span>{it.detalle}</span>
                        </span>
                        <button type="button" onClick={() => onIr(it.indice)} aria-label={`Ir a ${it.titulo}`}>
                          Ir <ArrowRight className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
          <section aria-label="Antes de guardar" className="cb-antes">
            <h3>Antes de guardar</h3>
            <p>{resumenEnPalabras(resumen)}</p>
          </section>
        </Tabs.Content>

        <Tabs.Content value="checklist" className="cb-tab-contenido">
          <section aria-label="¿Se puede emitir?">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">¿Se puede emitir?</h3>
              <span className={cn('font-semibold', lista.puedeEmitir ? 'text-emerald-700' : 'text-amber-700')}>
                {lista.hechos} de {lista.total}
              </span>
            </div>
            <p className={cn('mb-3 font-medium', lista.puedeEmitir ? 'text-emerald-700' : 'text-slate-600')}>
              {lista.puedeEmitir ? 'Sí: todo está listo.' : 'Todavía no. Toca un punto para ir a ese paso.'}
            </p>
            <ul className="cb-lista-check">
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
                      className={cn(actual && 'is-actual')}
                    >
                      <Icono className={cn('mt-0.5 h-5 w-5 shrink-0', clase)} aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">
                          {it.titulo} <span className="sr-only">({etiqueta})</span>
                        </span>
                        <span className="block text-slate-600">{it.detalle}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </Tabs.Content>

        {auto.mostrar && (
          <Tabs.Content value="estimado" className="cb-tab-contenido">
            <SimuladorPrima sumaInicial={auto.sumaInicial} moneda={auto.moneda} />
          </Tabs.Content>
        )}
      </Tabs.Root>
      <div className="cb-panel-acciones cb-panel-acciones-pie">
        <GuiaCombo />
        <BotonMapa datos={mapa} />
      </div>
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
      <span className="text-slate-700">{etiqueta}</span>
      <input
        id={`${id}-${clave}`}
        inputMode="decimal"
        value={valor}
        onChange={(e) => set(e.target.value)}
        placeholder={ayuda}
        className="cb-campo-sim"
      />
    </label>
  );
  return (
    <section aria-label="Estimado de prima">
      <h3 className="mb-1 font-semibold text-slate-900">Estimado de prima</h3>
      <p className="mb-3 text-slate-600">Escribe los datos para ver una cuenta rápida. Lo que escribes aquí no se guarda.</p>
      <div className="grid grid-cols-2 gap-3">
        {campo('Suma asegurada', sumaTexto, setSuma, 'Ej. 20000', 'suma')}
        {campo('Tasa diaria (%)', tasa, setTasa, 'Ej. 0,072', 'tasa')}
        {campo('Días', dias, setDias, 'Ej. 30', 'dias')}
        {campo('Descuento por deducible (%)', descuento, setDescuento, 'Opcional', 'desc')}
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3" aria-live="polite">
        {est ? (
          <>
            <p className="text-slate-700">
              Sin deducible: <strong>{moneda} <NumberFlow value={est.primaBase} locales="es" format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /></strong>
            </p>
            {est.descuento > 0 && (
              <p className="font-semibold text-emerald-700">
                Con deducible: {moneda} <NumberFlow value={est.primaFinal} locales="es" format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
              </p>
            )}
          </>
        ) : (
          <p className="text-slate-600">Completa suma, tasa y días para ver el estimado.</p>
        )}
      </div>
      <p className="mt-3 font-medium text-amber-800">Estimado: la prima oficial la calcula Sis2000 al cotizar.</p>
    </section>
  );
}
