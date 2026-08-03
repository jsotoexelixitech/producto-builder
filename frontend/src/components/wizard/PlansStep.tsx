import { useMemo, useState } from 'react';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import type { Coverage, ProductPlan } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { SectionPanel } from '@/components/ui/section-panel';
import { ToggleField } from '@/components/ui/toggle-field';
import { GuideBanner } from '@/components/flow/GuideBanner';
import { Alert } from '@/components/ui/alert';
import { clampText, FIELD_LIMITS } from '@/lib/field-limits';
import {
  calculatePlanPremiumTotal,
  planCoverageTariff,
} from '@/lib/product-plans';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

function emptyDraft(): ProductPlan {
  return {
    name: '',
    badge: '',
    priceFactor: 0,
    isRecommended: false,
    coverageIds: [],
    coverageLabels: [],
    coverageTariffs: {},
    isActive: true,
  };
}

function formatPremium(value: number) {
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface PlansStepProps {
  plans: ProductPlan[];
  coverages: Coverage[];
  onPlansChange: (plans: ProductPlan[]) => void;
}

export function PlansStep({ plans, coverages, onPlansChange }: PlansStepProps) {
  const selectableCoverages = coverages.filter((c) => c.id && c.name);
  const [draft, setDraft] = useState<ProductPlan>(emptyDraft());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const draftPremium = useMemo(
    () => calculatePlanPremiumTotal(draft, selectableCoverages),
    [draft, selectableCoverages],
  );

  const selectedIds = new Set(draft.coverageIds ?? []);

  function resetDraft() {
    setDraft(emptyDraft());
    setEditingIndex(null);
  }

  function patchDraft(patch: Partial<ProductPlan>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function toggleDraftCoverage(coverageId: string, checked: boolean) {
    const current = draft.coverageIds ?? [];
    const coverage = selectableCoverages.find((c) => c.id === coverageId);
    if (!coverage) return;

    let nextIds: string[];
    let nextTariffs = { ...(draft.coverageTariffs ?? {}) };

    if (checked) {
      nextIds = [...current, coverageId];
      if (nextTariffs[coverageId] == null) {
        nextTariffs[coverageId] = Number(coverage.tariffPremium ?? 0);
      }
    } else {
      nextIds = current.filter((id) => id !== coverageId);
      const { [coverageId]: _, ...rest } = nextTariffs;
      nextTariffs = rest;
    }

    const byId = new Map(selectableCoverages.map((c) => [c.id!, c.name]));
    patchDraft({
      coverageIds: nextIds,
      coverageLabels: nextIds.map((id) => byId.get(id)).filter((n): n is string => !!n),
      coverageTariffs: nextTariffs,
    });
  }

  function setCoverageTariff(coverageId: string, value: number) {
    patchDraft({
      coverageTariffs: {
        ...(draft.coverageTariffs ?? {}),
        [coverageId]: value,
      },
    });
  }

  function handleAddOrUpdate() {
    const name = draft.name.trim();
    if (name.length < 2) return;
    if ((draft.coverageIds?.length ?? 0) === 0) return;

    const entry: ProductPlan = {
      ...draft,
      name: clampText(name, FIELD_LIMITS.plan.name),
      badge: draft.badge ? clampText(draft.badge, FIELD_LIMITS.plan.badge) : undefined,
      priceFactor: calculatePlanPremiumTotal(draft, selectableCoverages),
    };

    if (editingIndex != null) {
      const next = [...plans];
      next[editingIndex] = { ...plans[editingIndex], ...entry };
      onPlansChange(
        entry.isRecommended
          ? next.map((p, j) => ({ ...p, isRecommended: j === editingIndex }))
          : next,
      );
    } else {
      const next = [...plans, entry];
      onPlansChange(
        entry.isRecommended
          ? next.map((p, j) => ({ ...p, isRecommended: j === next.length - 1 }))
          : next,
      );
    }
    resetDraft();
  }

  function handleEdit(index: number) {
    setEditingIndex(index);
    setDraft({
      ...plans[index],
      coverageTariffs: { ...(plans[index].coverageTariffs ?? {}) },
    });
  }

  function handleDelete(index: number) {
    onPlansChange(plans.filter((_, i) => i !== index));
    if (editingIndex === index) resetDraft();
    else if (editingIndex != null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  }

  function togglePlanActive(index: number) {
    const next = [...plans];
    next[index] = { ...next[index], isActive: next[index].isActive === false };
    onPlansChange(next);
  }

  const canSubmit =
    draft.name.trim().length >= 2 && (draft.coverageIds?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <GuideBanner>
        Define los <strong>planes comerciales</strong> con un formulario y agrégalos a la tabla.
        Puedes ajustar la <strong>tarifa por cobertura</strong> en cada plan.
      </GuideBanner>

      {selectableCoverages.length === 0 ? (
        <Alert variant="warning">
          Primero guarda al menos una cobertura en el paso «Coberturas». Los planes necesitan
          coberturas con identificador persistido.
        </Alert>
      ) : (
        <>
          <SectionPanel
            title={editingIndex != null ? 'Editar plan' : 'Nuevo plan'}
            description="Nombre, tag, coberturas incluidas y tarifas por cobertura."
          >
            <FormGrid>
              <FormField label="Nombre del plan">
                <Input
                  maxLength={FIELD_LIMITS.plan.name}
                  value={draft.name}
                  placeholder="Plan Estándar"
                  onChange={(e) =>
                    patchDraft({ name: clampText(e.target.value, FIELD_LIMITS.plan.name) })
                  }
                />
              </FormField>
              <FormField
                label="Tag del plan"
                hint="Etiqueta corta visible al cliente (ej. Esencial, Recomendado)."
              >
                <Input
                  maxLength={FIELD_LIMITS.plan.badge}
                  value={draft.badge ?? ''}
                  placeholder="Recomendado"
                  onChange={(e) =>
                    patchDraft({ badge: clampText(e.target.value, FIELD_LIMITS.plan.badge) })
                  }
                />
              </FormField>
              <FormField
                label="Prima total del plan"
                hint="Suma de las tarifas configuradas abajo."
              >
                <Input
                  readOnly
                  value={formatPremium(draftPremium)}
                  className="bg-muted/30 font-semibold tabular-nums"
                />
              </FormField>
              <FormField span={2}>
                <ToggleField
                  id="draft-plan-recommended"
                  label="Marcar como recomendado"
                  checked={!!draft.isRecommended}
                  onChange={(v) => patchDraft({ isRecommended: v })}
                />
              </FormField>
            </FormGrid>

            <SectionPanel
              icon={LayoutGrid}
              title="Coberturas y tarifas del plan"
              description="Marca las coberturas incluidas y define la prima de cada una en este plan."
              className="mt-4 border-0 bg-muted/15 p-0 shadow-none"
            >
              <div className="space-y-2">
                {selectableCoverages.map((coverage) => {
                  const id = coverage.id!;
                  const checked = selectedIds.has(id);
                  const defaultTariff = Number(coverage.tariffPremium ?? 0);
                  const tariff = checked
                    ? (draft.coverageTariffs?.[id] ?? defaultTariff)
                    : defaultTariff;
                  return (
                    <div
                      key={id}
                      className={cn(
                        'flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between',
                        checked
                          ? 'border-primary/35 bg-primary/5'
                          : 'border-border/60 bg-card',
                      )}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-primary"
                          checked={checked}
                          onChange={(e) => toggleDraftCoverage(id, e.target.checked)}
                        />
                        <span>
                          <span className="block text-sm font-medium">{coverage.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Tarifa base paso coberturas: {formatPremium(defaultTariff)}
                          </span>
                        </span>
                      </label>
                      {checked && (
                        <FormField label="Tarifa en este plan" className="w-full sm:w-36">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={tariff}
                            onChange={(e) =>
                              setCoverageTariff(id, Number(e.target.value) || 0)
                            }
                          />
                        </FormField>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionPanel>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={handleAddOrUpdate} disabled={!canSubmit}>
                <Plus className="h-4 w-4" />
                {editingIndex != null ? 'Guardar cambios' : 'Agregar a la tabla'}
              </Button>
              {editingIndex != null && (
                <Button type="button" variant="outline" onClick={resetDraft}>
                  Cancelar edición
                </Button>
              )}
            </div>
          </SectionPanel>

          <div className="overflow-hidden rounded-xl border border-border/60">
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <h3 className="text-sm font-semibold">Planes registrados ({plans.length})</h3>
            </div>
            {plans.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No hay planes todavía. Usa el formulario de arriba para agregar el primero.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Plan</th>
                      <th className="px-4 py-3 font-semibold">Tag</th>
                      <th className="px-4 py-3 font-semibold">Prima</th>
                      <th className="px-4 py-3 font-semibold">Coberturas</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan, i) => {
                      const active = plan.isActive !== false;
                      const premium = calculatePlanPremiumTotal(plan, selectableCoverages);
                      return (
                        <tr
                          key={`${plan.name}-${i}`}
                          className={cn(
                            'border-t border-border/40 hover:bg-muted/10',
                            !active && 'opacity-60',
                            editingIndex === i && 'bg-primary/5',
                          )}
                        >
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {plan.name}
                            {plan.isRecommended && (
                              <span className="ml-2 text-[10px] font-semibold uppercase text-primary">
                                Rec.
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{plan.badge ?? '—'}</td>
                          <td className="px-4 py-3 tabular-nums">{formatPremium(premium)}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {plan.coverageIds?.length ?? 0}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                                active
                                  ? 'bg-emerald-500/10 text-emerald-700'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePlanActive(i)}
                                aria-label={active ? 'Desactivar plan' : 'Activar plan'}
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(i)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(i)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
