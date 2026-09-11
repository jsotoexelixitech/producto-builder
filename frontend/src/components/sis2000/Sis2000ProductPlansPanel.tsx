import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, Layers, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import {
  formatPlanMoney,
  formatPlanScalar,
  SIS2000_PLAN_SCALAR_FIELDS,
  type Sis2000Plan,
} from '@/lib/sis2000-plans';
import { Sis2000CoverageNestPanel } from '@/components/sis2000/Sis2000CoverageNestPanel';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const DEFAULT_CENTIDAD = 'P';
const DEFAULT_CITEM = '80080';

interface Sis2000ProductPlansPanelProps {
  cproducto: string;
}

export function Sis2000ProductPlansPanel({ cproducto }: Sis2000ProductPlansPanelProps) {
  const [plans, setPlans] = useState<Sis2000Plan[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [centidad, setCentidad] = useState(DEFAULT_CENTIDAD);
  const [citem, setCitem] = useState(DEFAULT_CITEM);
  const [appliedEntity, setAppliedEntity] = useState(DEFAULT_CENTIDAD);
  const [appliedItem, setAppliedItem] = useState(DEFAULT_CITEM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  async function load(entity = centidad, item = citem) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listSis2000ProductPlans(cproducto, {
        centidad: entity,
        citem: item,
      });
      setPlans(res.plans);
      setMensaje(res.mensaje);
      setAppliedEntity(res.centidad);
      setAppliedItem(res.citem);
      setExpandedKey(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los planes');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCentidad(DEFAULT_CENTIDAD);
    setCitem(DEFAULT_CITEM);
    void load(DEFAULT_CENTIDAD, DEFAULT_CITEM);
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
              valrep/planes/producto + detalle · consulta catálogo (sin emisión de pólizas)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Entidad aplicada: <strong>{appliedEntity}</strong> / ítem{' '}
              <strong>{appliedItem}</strong>
              {loading ? '' : ' · puede tardar ~1 min en RCV'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Recargar planes
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
        <div className="space-y-1">
          <Label htmlFor={`centidad-${cproducto}`} className="text-xs">
            centidad
          </Label>
          <Input
            id={`centidad-${cproducto}`}
            className="h-8 w-16 font-mono text-xs uppercase"
            maxLength={1}
            value={centidad}
            onChange={(e) => setCentidad(e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`citem-${cproducto}`} className="text-xs">
            citem (productor)
          </Label>
          <Input
            id={`citem-${cproducto}`}
            className="h-8 w-28 font-mono text-xs"
            value={citem}
            onChange={(e) => setCitem(e.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void load()}
        >
          Aplicar filtro
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
          <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
          <p className="text-xs text-muted-foreground">Consultando Sis2000…</p>
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin planes para producto {cproducto} con entidad {appliedEntity} / ítem{' '}
          {appliedItem}.
        </p>
      )}

      {!loading && plans.length > 0 && (
        <>
          {mensaje && (
            <p className="mb-3 text-xs text-muted-foreground">{mensaje}</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border/50 bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Plan</th>
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Ramo</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 font-semibold">Moneda</th>
                  <th className="px-3 py-2 font-semibold">Suma ext.</th>
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
                        <td className="max-w-[220px] truncate px-3 py-2 text-xs" title={plan.xplan}>
                          {plan.xplan}
                        </td>
                        <td className="px-3 py-2 text-xs">{plan.cramo}</td>
                        <td className="px-3 py-2">
                          <Badge variant={plan.iestado === 'V' ? 'approved' : 'draft'}>
                            {plan.iestado ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">{plan.cmoneda ?? '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          {formatPlanMoney(plan.msumaasegext)}
                        </td>
                        <td className="px-3 py-2 text-xs">{plan.coberturas.length}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant={isOpen ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => togglePlan(plan)}
                          >
                            {isOpen ? 'Ocultar' : 'Ver todo'}
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
                          <td colSpan={8} className="px-4 py-4">
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

function mergePlanDetail(summary: Sis2000Plan, detail: Sis2000Plan): Sis2000Plan {
  return {
    ...summary,
    ...detail,
    cplan: detail.cplan || summary.cplan,
    cramo: detail.cramo || summary.cramo,
    coberturas: detail.coberturas.length ? detail.coberturas : summary.coberturas,
    parentescos: detail.parentescos.length
      ? detail.parentescos
      : summary.parentescos,
  };
}

function PlanDetailBlock({ plan }: { plan: Sis2000Plan }) {
  const [fullPlan, setFullPlan] = useState<Sis2000Plan>(plan);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [expandedCov, setExpandedCov] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setFullPlan(plan);

    void (async () => {
      try {
        const res = await api.getSis2000PlanDetail(plan.cramo, plan.cplan);
        if (cancelled) return;
        setFullPlan(mergePlanDetail(plan, res.plan));
      } catch (e) {
        if (cancelled) return;
        setDetailError(
          e instanceof Error ? e.message : 'No se pudo cargar el detalle del plan',
        );
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan.cramo, plan.cplan]);

  return (
    <div className="space-y-5">
      {detailLoading && (
        <p className="text-xs text-muted-foreground">Cargando detalle valrep/planes/detalle…</p>
      )}
      {detailError && <Alert variant="error">{detailError}</Alert>}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Datos del plan
        </h4>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SIS2000_PLAN_SCALAR_FIELDS.map(({ key, label }) => (
            <DetailItem
              key={key}
              label={label}
              value={
                key === 'msumaasegext' || key === 'msumaaseg'
                  ? formatPlanMoney(fullPlan[key] as number | null)
                  : formatPlanScalar(fullPlan[key])
              }
            />
          ))}
        </dl>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Parentescos ({fullPlan.parentescos.length})
        </h4>
        {fullPlan.parentescos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin parentescos para este plan.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="border-b border-border/50 bg-muted/20 uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Parentesco</th>
                  <th className="px-3 py-2">Edad mín</th>
                  <th className="px-3 py-2">Edad máx</th>
                </tr>
              </thead>
              <tbody>
                {fullPlan.parentescos.map((p) => (
                  <tr
                    key={`${p.cparen}-${p.xparentesco}`}
                    className="border-b border-border/30"
                  >
                    <td className="px-3 py-2 font-mono">{p.cparen}</td>
                    <td className="px-3 py-2">{p.xparentesco}</td>
                    <td className="px-3 py-2">{formatPlanMoney(p.min_edad)}</td>
                    <td className="px-3 py-2">{formatPlanMoney(p.max_edad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Coberturas ({fullPlan.coberturas.length})
        </h4>
        {fullPlan.coberturas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin coberturas en la respuesta.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-border/50 bg-muted/20 uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Cobertura</th>
                  <th className="px-3 py-2">Suma mín</th>
                  <th className="px-3 py-2">Suma máx</th>
                  <th className="px-3 py-2">Prima</th>
                  <th className="px-3 py-2">% prima</th>
                  <th className="px-3 py-2 text-right">Maestro</th>
                </tr>
              </thead>
              <tbody>
                {fullPlan.coberturas.map((c) => {
                  const covKey = String(c.ccobertura);
                  const isCovOpen = expandedCov === covKey;
                  return (
                    <Fragment key={`${c.ccobertura}-${c.xcobertura}`}>
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-2 font-mono">{c.ccobertura}</td>
                        <td className="px-3 py-2">{c.xcobertura}</td>
                        <td className="px-3 py-2">{formatPlanMoney(c.msumamin)}</td>
                        <td className="px-3 py-2">{formatPlanMoney(c.msumamax)}</td>
                        <td className="px-3 py-2">{formatPlanMoney(c.mprima)}</td>
                        <td className="px-3 py-2">{formatPlanMoney(c.pprima)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant={isCovOpen ? 'default' : 'outline'}
                            size="sm"
                            onClick={() =>
                              setExpandedCov((prev) => (prev === covKey ? null : covKey))
                            }
                          >
                            {isCovOpen ? 'Ocultar' : 'Sis2000'}
                          </Button>
                        </td>
                      </tr>
                      {isCovOpen && c.ccobertura != null && (
                        <tr className="border-b border-border/30">
                          <td colSpan={7} className="px-3 py-2">
                            <Sis2000CoverageNestPanel
                              cramo={fullPlan.cramo}
                              ccobertura={String(c.ccobertura)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm">{value == null || value === '' ? '—' : String(value)}</dd>
    </div>
  );
}
