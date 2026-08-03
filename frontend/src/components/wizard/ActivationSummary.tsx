import type { Coverage, Product, ProductPlan, RequiredDocument } from '@/types/product';
import { SectionPanel } from '@/components/ui/section-panel';
import { branchLabel } from '@/lib/flow-step-features';
import { calculatePlanPremiumTotal } from '@/lib/product-plans';
import { ClipboardList } from 'lucide-react';

interface ActivationSummaryProps {
  product: Product | null;
  commercialName: string;
  branch: Product['branch'];
  internalCode: string;
  coverages: Coverage[];
  plans: ProductPlan[];
  requiredDocuments: RequiredDocument[];
  emissionStepCount: number;
  commercialPremium: number;
}

function formatMoney(value: number) {
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ActivationSummary({
  product,
  commercialName,
  branch,
  internalCode,
  coverages,
  plans,
  requiredDocuments,
  emissionStepCount,
  commercialPremium,
}: ActivationSummaryProps) {
  const activePlans = plans.filter((p) => p.isActive !== false);
  const name = product?.commercialName ?? commercialName;
  const code = product?.internalCode ?? internalCode;

  return (
    <SectionPanel
      icon={ClipboardList}
      title="Resumen del producto"
      description="Revisa cómo quedará configurado antes de activar o enviar a revisión."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Identificación
          </h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Nombre comercial</dt>
              <dd className="text-right font-medium">{name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Código interno</dt>
              <dd className="font-mono text-right text-xs">{code || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Ramo</dt>
              <dd className="text-right font-medium">{branchLabel(branch)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Prima comercial (actuarial)</dt>
              <dd className="tabular-nums text-right font-semibold text-primary">
                {formatMoney(commercialPremium)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Coberturas ({coverages.length})
          </h4>
          {coverages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin coberturas configuradas.</p>
          ) : (
            <ul className="max-h-40 space-y-1.5 overflow-y-auto text-sm">
              {coverages.map((c, i) => (
                <li key={c.id ?? i} className="flex justify-between gap-2 border-b border-border/30 pb-1">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatMoney(Number(c.tariffPremium ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Planes activos ({activePlans.length})
          </h4>
          {activePlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin planes activos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activePlans.map((plan, i) => (
                <li
                  key={`${plan.name}-${i}`}
                  className="rounded-lg border border-border/50 bg-card px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{plan.name}</span>
                    {plan.badge && (
                      <span className="text-xs text-muted-foreground">{plan.badge}</span>
                    )}
                    {plan.isRecommended && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prima plan: {formatMoney(calculatePlanPremiumTotal(plan, coverages))} ·{' '}
                    {(plan.coverageIds?.length ?? 0)} cobertura(s)
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Emisión y documentos
          </h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Pasos del flujo activos</dt>
              <dd className="font-medium">{emissionStepCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Documentos requeridos</dt>
              <dd className="font-medium">{requiredDocuments.length}</dd>
            </div>
          </dl>
          {requiredDocuments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {requiredDocuments.slice(0, 8).map((d) => (
                <span
                  key={d.documentKey}
                  className="rounded-md border border-border/60 bg-card px-2 py-0.5 text-xs"
                >
                  {d.label}
                </span>
              ))}
              {requiredDocuments.length > 8 && (
                <span className="text-xs text-muted-foreground">
                  +{requiredDocuments.length - 8} más
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionPanel>
  );
}
