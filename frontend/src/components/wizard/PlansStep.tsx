import { Plus, Trash2 } from 'lucide-react';
import type { Coverage, ProductPlan } from '@/types/product';
import { SectionPanel } from '@/components/ui/section-panel';
import { FormField as FormFieldWrap, FormGrid } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ToggleField } from '@/components/ui/toggle-field';
import { GuideBanner } from '@/components/flow/GuideBanner';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { LayoutGrid } from 'lucide-react';

interface PlansStepProps {
  plans: ProductPlan[];
  coverages: Coverage[];
  onPlansChange: (plans: ProductPlan[]) => void;
}

function toggleCoverage(
  plan: ProductPlan,
  coverageId: string,
  checked: boolean,
  coverages: Coverage[],
): ProductPlan {
  const current = plan.coverageIds ?? [];
  const nextIds = checked
    ? [...current, coverageId]
    : current.filter((id) => id !== coverageId);
  const byId = new Map(coverages.filter((c) => c.id).map((c) => [c.id!, c.name]));
  const nextLabels = nextIds.map((id) => byId.get(id)).filter((n): n is string => !!n);
  return { ...plan, coverageIds: nextIds, coverageLabels: nextLabels };
}

export function PlansStep({ plans, coverages, onPlansChange }: PlansStepProps) {
  const selectableCoverages = coverages.filter((c) => c.id && c.name);

  return (
    <div className="space-y-6">
      <GuideBanner>
        Define los <strong>planes comerciales</strong> que el cliente podrá elegir. Cada plan
        incluye un subconjunto de las coberturas que configuraste en el paso anterior.
      </GuideBanner>

      {selectableCoverages.length === 0 ? (
        <Alert variant="warning">
          Primero guarda al menos una cobertura en el paso «Coberturas». Los planes necesitan
          coberturas con identificador persistido para poder asociarlas.
        </Alert>
      ) : (
        <div className="space-y-4">
          {plans.map((plan, i) => {
            const selectedIds = new Set(plan.coverageIds ?? []);
            return (
              <div
                key={i}
                className="space-y-4 rounded-xl border border-border/60 bg-card p-4"
              >
                <FormGrid>
                  <FormFieldWrap label="Nombre del plan">
                    <Input
                      value={plan.name}
                      onChange={(e) => {
                        const next = [...plans];
                        next[i] = { ...plan, name: e.target.value };
                        onPlansChange(next);
                      }}
                    />
                  </FormFieldWrap>
                  <FormFieldWrap label="Badge">
                    <Input
                      value={plan.badge ?? ''}
                      placeholder="Recomendado"
                      onChange={(e) => {
                        const next = [...plans];
                        next[i] = { ...plan, badge: e.target.value };
                        onPlansChange(next);
                      }}
                    />
                  </FormFieldWrap>
                  <FormFieldWrap label="Factor de precio" hint="1.0 = prima base actuarial">
                    <Input
                      type="number"
                      step="0.05"
                      value={plan.priceFactor ?? 1}
                      onChange={(e) => {
                        const next = [...plans];
                        next[i] = { ...plan, priceFactor: Number(e.target.value) };
                        onPlansChange(next);
                      }}
                    />
                  </FormFieldWrap>
                </FormGrid>

                <SectionPanel
                  icon={LayoutGrid}
                  title="Coberturas incluidas"
                  description="Selecciona las coberturas de este producto que forman parte del plan."
                  className="border-0 bg-muted/15 p-0 shadow-none"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectableCoverages.map((coverage) => {
                      const checked = selectedIds.has(coverage.id!);
                      return (
                        <label
                          key={coverage.id}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                            checked
                              ? 'border-primary/35 bg-primary/5'
                              : 'border-border/60 bg-card hover:bg-muted/30',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-primary"
                            checked={checked}
                            onChange={(e) => {
                              const next = [...plans];
                              next[i] = toggleCoverage(
                                plan,
                                coverage.id!,
                                e.target.checked,
                                selectableCoverages,
                              );
                              onPlansChange(next);
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{coverage.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {coverage.isBasicMandatory ? 'Básica obligatoria' : 'Accesoria'}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {(plan.coverageIds?.length ?? 0) === 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      Selecciona al menos una cobertura para este plan.
                    </p>
                  )}
                </SectionPanel>

                <div className="flex items-center justify-between">
                  <ToggleField
                    id={`plan-rec-${i}`}
                    label="Marcar como recomendado"
                    checked={!!plan.isRecommended}
                    onChange={(v) => {
                      const next = plans.map((p, j) => ({
                        ...p,
                        isRecommended: j === i ? v : false,
                      }));
                      onPlansChange(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onPlansChange(plans.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            className="border-dashed"
            onClick={() =>
              onPlansChange([
                ...plans,
                {
                  name: `Plan ${plans.length + 1}`,
                  badge: 'Nuevo',
                  priceFactor: 1,
                  isRecommended: plans.length === 0,
                  coverageIds: selectableCoverages.slice(0, 1).map((c) => c.id!),
                  coverageLabels: selectableCoverages.slice(0, 1).map((c) => c.name),
                },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Agregar plan
          </Button>
        </div>
      )}
    </div>
  );
}
