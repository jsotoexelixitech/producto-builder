import { useCallback, useEffect, useState } from 'react';
import { ShieldMinus } from 'lucide-react';
import { api } from '@/lib/api';
import {
  cuerpoDeducible,
  deducibleDeFila,
  detalleVigente,
  fechaIso,
  textoDeducible,
  validarDeducible,
  type CoberturaDelPlan,
  type DeducibleForm,
} from '@/lib/configurador';
import { entenderError, type ErrorEntendible } from '@/lib/errores';
import { Alert } from '@/components/ui/alert';
import { AlertaError } from '@/components/ui/errores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionPanel } from '@/components/ui/section-panel';
import { DeducibleCampos } from './DeducibleCampos';

type Fila = Record<string, unknown>;

interface Props {
  /** "cramo-cplan". */
  planId: string;
  cramo: number;
  coberturas: CoberturaDelPlan[];
  /** Filas de maplancob del plan si la lectura del plan las trae (para mostrar la copia actual). */
  filasPlan?: Fila[];
  moneda?: string;
  /** Copia del deducible en el plan (maplancob): solo cosas y auto; en personas nest-api no la tiene. */
  conCopiaEnPlan?: boolean;
  onCambio?: () => void;
}

/**
 * Deducibles de todas las familias. El que se usa al emitir está en la tasa vigente de la tarifa; el plan guarda una
 * copia por cobertura (más el desembolso máximo). La tarifa puede estar en otros planes del ramo: se avisa.
 */
export function DeduciblesPanel({ planId, cramo, coberturas, filasPlan = [], moneda = '$', conCopiaEnPlan = true, onCambio }: Props) {
  const [motivo, setMotivo] = useState('');
  return (
    <SectionPanel
      title="Deducibles"
      description={
        conCopiaEnPlan
          ? 'Lo que paga el asegurado en cada siniestro. El de la tarifa es el que se usa al emitir; el del plan es su copia.'
          : 'Lo que paga el asegurado en cada siniestro. Se guarda en la tarifa de cada cobertura.'
      }
      icon={ShieldMinus}
    >
      <div className="space-y-4 text-xs">
        {!coberturas.length && <Alert variant="info">El plan todavía no tiene coberturas.</Alert>}
        {coberturas.map((c) => (
          <DeducibleCobertura
            key={`${c.ccobertura}|${c.ctarifa}`}
            planId={planId}
            cramo={cramo}
            cobertura={c}
            filaPlan={filasPlan.find((f) => String(f.ccobertura ?? f.ccober ?? '').trim().toUpperCase() === c.ccobertura.toUpperCase())}
            moneda={moneda}
            conCopiaEnPlan={conCopiaEnPlan}
            motivo={motivo}
            onGuardado={() => {
              setMotivo('');
              onCambio?.();
            }}
          />
        ))}
        {coberturas.length > 0 && (
          <div className="max-w-md">
            <Label htmlFor="deducibles-motivo">Motivo del cambio (opcional, queda en el historial)</Label>
            <Input id="deducibles-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        )}
      </div>
    </SectionPanel>
  );
}

function DeducibleCobertura({
  planId,
  cramo,
  cobertura,
  filaPlan,
  moneda,
  conCopiaEnPlan,
  motivo,
  onGuardado,
}: {
  planId: string;
  cramo: number;
  cobertura: CoberturaDelPlan;
  filaPlan?: Fila;
  moneda: string;
  conCopiaEnPlan: boolean;
  motivo: string;
  onGuardado: () => void;
}) {
  const [detalle, setDetalle] = useState<Fila | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enTarifa, setEnTarifa] = useState<DeducibleForm>(deducibleDeFila(null));
  const [enPlan, setEnPlan] = useState<DeducibleForm>(deducibleDeFila(filaPlan));
  const [desembolso, setDesembolso] = useState({
    mmax_desem: filaPlan?.mmax_desem == null ? '' : String(filaPlan.mmax_desem),
    mmax_desemext: filaPlan?.mmax_desemext == null ? '' : String(filaPlan.mmax_desemext),
  });
  const [intento, setIntento] = useState<'tarifa' | 'plan' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ErrorEntendible | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    api
      .listSis2000Tarifas(cramo, cobertura.ccobertura)
      .then((tarifas) => {
        const tarifa = tarifas.find((t) => String(t.ctarifa ?? '').trim().toUpperCase() === cobertura.ctarifa.toUpperCase());
        const d = detalleVigente(Array.isArray(tarifa?.detalles) ? (tarifa.detalles as Fila[]) : []);
        setDetalle(d);
        setEnTarifa(deducibleDeFila(d));
        if (!filaPlan) setEnPlan(deducibleDeFila(d));
      })
      .catch((e) => setError(entenderError(e, { titulo: 'No se pudo leer la tarifa de la cobertura' })))
      .finally(() => setCargando(false));
  }, [cramo, cobertura.ccobertura, cobertura.ctarifa, filaPlan]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const erroresTarifa = intento === 'tarifa' ? validarDeducible(enTarifa) : {};
  const erroresPlan = intento === 'plan' ? validarDeducible(enPlan) : {};
  const fdesde = detalle ? fechaIso(detalle.fdesde) : '';

  async function guardar(donde: 'tarifa' | 'plan') {
    setIntento(donde);
    const form = donde === 'tarifa' ? enTarifa : enPlan;
    if (Object.keys(validarDeducible(form)).length) return;
    const n = (v: string) => (v.trim() ? Number(v.trim().replace(',', '.')) : undefined);
    if (donde === 'plan' && [desembolso.mmax_desem, desembolso.mmax_desemext].some((v) => v.trim() && !(Number(n(v)) >= 0))) {
      setError(entenderError(new Error('El desembolso máximo no puede ser negativo.')));
      return;
    }
    setGuardando(true);
    setError(null);
    setOk(null);
    try {
      if (donde === 'tarifa') {
        if (!fdesde) throw new Error('La tarifa no tiene una tasa con vigencia: créala primero en «Tarifas y tasas».');
        await api.editarSis2000DetalleTarifa(cramo, cobertura.ccobertura, cobertura.ctarifa, fdesde, {
          ...cuerpoDeducible(enTarifa, true),
          motivoCambio: motivo || undefined,
        });
        setOk(`Deducible guardado en la tarifa ${cobertura.ctarifa} (tasa desde ${fdesde}).`);
        cargar();
      } else {
        await api.editarSis2000DeducibleCoberturaPlan(planId, cobertura.ccobertura, {
          ...cuerpoDeducible(enPlan, true),
          mmax_desem: n(desembolso.mmax_desem),
          mmax_desemext: n(desembolso.mmax_desemext),
          motivoCambio: motivo || undefined,
        });
        setOk('Copia del deducible guardada en el plan.');
      }
      setIntento(null);
      onGuardado();
    } catch (e) {
      setError(
        entenderError(e, {
          titulo: donde === 'tarifa' ? 'No se pudo guardar el deducible en la tarifa' : 'No se pudo guardar el deducible en el plan',
          duplicado: 'Ya hay otra tasa vigente para esta tarifa; ciérrala antes de reactivar esta.',
        }),
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">
        {cobertura.nombre} <span className="font-mono text-xs text-slate-500">({cobertura.ccobertura} · tarifa {cobertura.ctarifa})</span>
      </p>
      <AlertaError error={error} className="mb-3" />
      {ok && (
        <Alert variant="success" className="mb-3">
          {ok}
        </Alert>
      )}
      {cargando ? (
        <p className="text-slate-500">Leyendo la tarifa…</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="font-semibold text-slate-700">
              Al emitir (tarifa {cobertura.ctarifa}
              {fdesde ? `, tasa desde ${fdesde}` : ''}) · hoy: {textoDeducible(deducibleDeFila(detalle), moneda)}
            </p>
            <p className="text-[11px] text-slate-500">Esta tarifa la pueden usar otros planes del ramo: el cambio les aplica también.</p>
            <DeducibleCampos
              idBase={`ded-tar-${cobertura.ccobertura}`}
              valor={enTarifa}
              onChange={setEnTarifa}
              errores={erroresTarifa}
              moneda={moneda}
              deshabilitado={guardando || !fdesde}
            />
            <Button type="button" size="sm" onClick={() => void guardar('tarifa')} disabled={guardando || !fdesde}>
              Guardar en la tarifa
            </Button>
          </div>
          {conCopiaEnPlan && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="font-semibold text-slate-700">Copia en este plan</p>
            <DeducibleCampos
              idBase={`ded-plan-${cobertura.ccobertura}`}
              valor={enPlan}
              onChange={setEnPlan}
              errores={erroresPlan}
              moneda={moneda}
              deshabilitado={guardando}
            />
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <Label htmlFor={`ded-plan-${cobertura.ccobertura}-desem`}>Desembolso máximo (Bs)</Label>
                <Input
                  id={`ded-plan-${cobertura.ccobertura}-desem`}
                  inputMode="decimal"
                  value={desembolso.mmax_desem}
                  onChange={(e) => setDesembolso({ ...desembolso, mmax_desem: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`ded-plan-${cobertura.ccobertura}-desemext`}>Desembolso máximo ({moneda})</Label>
                <Input
                  id={`ded-plan-${cobertura.ccobertura}-desemext`}
                  inputMode="decimal"
                  value={desembolso.mmax_desemext}
                  onChange={(e) => setDesembolso({ ...desembolso, mmax_desemext: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEnPlan(enTarifa)} disabled={guardando}>
                Copiar lo de la tarifa
              </Button>
              <Button type="button" size="sm" onClick={() => void guardar('plan')} disabled={guardando}>
                Guardar en el plan
              </Button>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
