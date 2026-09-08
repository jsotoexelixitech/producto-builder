import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, Layers, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import {
  formatPlanMoney,
  type Sis2000Plan,
} from '@/lib/sis2000-plans';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Sis2000ProductPlansPanelProps {
  cproducto: string;
}

export function Sis2000ProductPlansPanel({ cproducto }: Sis2000ProductPlansPanelProps) {
  const [plans, setPlans] = useState<Sis2000Plan[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listSis2000ProductPlans(cproducto);
      setPlans(res.plans);
      setMensaje(res.mensaje);
      setExpandedKey(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los planes');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [cproducto]);

  function planKey(plan: Sis2000Plan) {
    return `${plan.cramo}:${plan.cplan}`;
  }

  function togglePlan(plan: Sis2000Plan) {
    const key = planKey(plan);
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className="mt-6 rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Layers className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Planes del producto {cproducto}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              valrep/planes/producto · puede tardar ~1 min en RCV · expande un plan para ver
              coberturas
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Recargar planes
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading && (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
          <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
          <p className="text-xs text-muted-foreground">Consultando Sis2000…</p>
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin planes asociados para este producto y entidad (P/80080).
        </p>
      )}

      {!loading && plans.length > 0 && (
        <>
          {mensaje && (
            <p className="mb-3 text-xs text-muted-foreground">{mensaje}</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Plan</th>
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Ramo</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 font-semibold">Moneda</th>
                  <th className="px-3 py-2 font-semibold">Coberturas</th>
                  <th className="px-3 py-2 font-semibold text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const key = planKey(plan);
                  const isOpen = expandedKey === key;
                  return (
                    <Fragment key={key}>
                      <tr
                        className={cn(
                          'border-b border-border/40',
                          isOpen && 'bg-primary/5',
                        )}
                      >
                        <td className="px-3 py-2 font-mono text-xs font-semibold">
                          {plan.cplan}
                        </td>
                        <td className="max-w-[240px] truncate px-3 py-2 text-xs">
                          {plan.xplan}
                        </td>
                        <td className="px-3 py-2 text-xs">{plan.cramo}</td>
                        <td className="px-3 py-2">
                          <Badge variant={plan.iestado === 'V' ? 'approved' : 'draft'}>
                            {plan.iestado ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">{plan.cmoneda ?? '—'}</td>
                        <td className="px-3 py-2 text-xs">{plan.coberturas.length}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant={isOpen ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => togglePlan(plan)}
                          >
                            {isOpen ? 'Ocultar' : 'Ver'}
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 transition-transform',
                                isOpen && 'rotate-180',
                              )}
                            />
                          </Button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border/40 bg-muted/10">
                          <td colSpan={7} className="px-4 py-4">
                            <PlanDetailBlock plan={plan} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {plans.length} plan{plans.length === 1 ? '' : 'es'} · fuente nest-api valrep
          </p>
        </>
      )}
    </div>
  );
}

function PlanDetailBlock({ plan }: { plan: Sis2000Plan }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem label="cplan" value={plan.cplan} />
        <DetailItem label="xplan_c" value={plan.xplan_c} />
        <DetailItem label="cproducto (plan)" value={plan.cproducto} />
        <DetailItem label="cproductor" value={plan.cproductor} />
        <DetailItem label="msumaasegext" value={formatPlanMoney(plan.msumaasegext)} />
        <DetailItem label="parentescos" value={plan.parentescos.length} />
      </dl>

      {plan.coberturas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin coberturas en la respuesta.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-border/50 bg-muted/20 uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Cobertura</th>
                <th className="px-3 py-2">Suma mín</th>
                <th className="px-3 py-2">Suma máx</th>
                <th className="px-3 py-2">Prima</th>
                <th className="px-3 py-2">% prima</th>
              </tr>
            </thead>
            <tbody>
              {plan.coberturas.map((c) => (
                <tr key={`${c.ccobertura}-${c.xcobertura}`} className="border-b border-border/30">
                  <td className="px-3 py-2 font-mono">{c.ccobertura}</td>
                  <td className="px-3 py-2">{c.xcobertura}</td>
                  <td className="px-3 py-2">{formatPlanMoney(c.msumamin)}</td>
                  <td className="px-3 py-2">{formatPlanMoney(c.msumamax)}</td>
                  <td className="px-3 py-2">{formatPlanMoney(c.mprima)}</td>
                  <td className="px-3 py-2">{formatPlanMoney(c.pprima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background px-3 py-2">
      <dt className="font-mono text-[10px] uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value == null || value === '' ? '—' : String(value)}</dd>
    </div>
  );
}
