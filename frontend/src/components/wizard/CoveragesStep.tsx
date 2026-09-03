import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Coverage, ProductBranch, PremiumCalculationType } from '@/types/product';
import { api } from '@/lib/api';
import type { CoreCoverageCatalogItem } from '@/lib/core-catalog';
import { resolveCoveragePremium } from '@/lib/core-catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { SectionPanel } from '@/components/ui/section-panel';
import { clampInt, clampText, FIELD_LIMITS } from '@/lib/field-limits';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';

const EMPTY_DRAFT: Coverage = {
  name: '',
  isBasicMandatory: false,
  waitingPeriodDays: 0,
  premiumCalculationType: 'PRIMA_FIJA',
  insuredSumFixed: undefined,
  tariffPremium: undefined,
  tariffRate: undefined,
};

function formatMoney(value?: number) {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CoveragesStepProps {
  branch: ProductBranch;
  subBranchCode?: string;
  coverages: Coverage[];
  onCoveragesChange: (coverages: Coverage[]) => void;
}

export function CoveragesStep({
  branch,
  subBranchCode,
  coverages,
  onCoveragesChange,
}: CoveragesStepProps) {
  const [draft, setDraft] = useState<Coverage>({ ...EMPTY_DRAFT });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [coreCatalog, setCoreCatalog] = useState<CoreCoverageCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedCoreCode, setSelectedCoreCode] = useState('__manual__');
  const [newCoreName, setNewCoreName] = useState('');
  const [newCoreAccounting, setNewCoreAccounting] = useState('');
  const [creatingCore, setCreatingCore] = useState(false);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const rows = await api.listCoreCoverages(branch, subBranchCode || undefined);
      setCoreCatalog(rows);
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo CORE');
    } finally {
      setCatalogLoading(false);
    }
  }, [branch, subBranchCode]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const otherCoverageNames = useMemo(
    () =>
      coverages
        .filter((_, idx) => idx !== editingIndex && coverages[idx]?.name)
        .map((c) => c.name),
    [coverages, editingIndex],
  );

  const parentSumForDraft = useMemo(() => {
    if (!draft.dependsOnCoverageName) return undefined;
    const parent = coverages.find((c) => c.name === draft.dependsOnCoverageName);
    return parent?.insuredSumFixed ?? parent?.insuredSumMin;
  }, [coverages, draft.dependsOnCoverageName]);

  const draftComputedPremium = useMemo(
    () =>
      resolveCoveragePremium({
        ...draft,
        parentSum: parentSumForDraft,
      }),
    [draft, parentSumForDraft],
  );

  function patchDraft(patch: Partial<Coverage>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function resetDraft() {
    setDraft({ ...EMPTY_DRAFT });
    setEditingIndex(null);
    setSelectedCoreCode('__manual__');
  }

  function applyCoreSelection(code: string) {
    setSelectedCoreCode(code);
    if (code === '__manual__' || code === '__new__') return;
    const item = coreCatalog.find((c) => c.code === code);
    if (!item) return;
    patchDraft({
      name: item.name,
      coberturaInternaCode: item.code,
      accountingCode: item.accountingCode ?? undefined,
    });
  }

  async function handleCreateInCore() {
    const name = newCoreName.trim();
    if (name.length < 2) return;
    setCreatingCore(true);
    setCatalogError(null);
    try {
      const created = await api.createCoreCoverage({
        branch,
        subBranchCode: subBranchCode || undefined,
        name,
        accountingCode: newCoreAccounting.trim() || undefined,
      });
      await loadCatalog();
      setSelectedCoreCode(created.code);
      patchDraft({
        name: created.name,
        coberturaInternaCode: created.code,
        accountingCode: created.accountingCode ?? undefined,
      });
      setNewCoreName('');
      setNewCoreAccounting('');
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : 'Error al crear cobertura en CORE');
    } finally {
      setCreatingCore(false);
    }
  }

  function handleAddOrUpdate() {
    const name = draft.name.trim();
    if (name.length < 2) return;

    const entry: Coverage = {
      ...draft,
      name: clampText(name, FIELD_LIMITS.coverage.name),
      premiumCalculationType:
        (draft.premiumCalculationType as PremiumCalculationType) ?? 'PRIMA_FIJA',
      waitingPeriodDays: clampInt(
        draft.waitingPeriodDays ?? 0,
        0,
        FIELD_LIMITS.coverage.waitingPeriodDays,
      ),
      tariffPremium:
        draft.premiumCalculationType === 'PRIMA_FIJA'
          ? draft.tariffPremium
          : draftComputedPremium,
    };

    if (editingIndex != null) {
      const next = [...coverages];
      next[editingIndex] = { ...coverages[editingIndex], ...entry };
      onCoveragesChange(next);
    } else {
      onCoveragesChange([...coverages, entry]);
    }
    resetDraft();
  }

  function handleEdit(index: number) {
    setEditingIndex(index);
    setDraft({ ...coverages[index] });
    setSelectedCoreCode(coverages[index].coberturaInternaCode ?? '__manual__');
  }

  function handleDelete(index: number) {
    onCoveragesChange(coverages.filter((_, i) => i !== index));
    if (editingIndex === index) resetDraft();
    else if (editingIndex != null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  }

  const canSubmit = draft.name.trim().length >= 2;
  const isRate = draft.premiumCalculationType === 'TASA_PORCENTUAL';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Selecciona coberturas del catálogo CORE o crea una nueva. Define prima fija o tasa
        porcentual según la suma asegurada.
      </p>

      {catalogError && (
        <Alert variant="error">{catalogError}</Alert>
      )}

      <SectionPanel
        title={editingIndex != null ? 'Editar cobertura' : 'Nueva cobertura'}
        description="Catálogo CORE, suma asegurada, cálculo de prima y sub-límites."
      >
        <FormGrid>
          <FormField label="Cobertura CORE" span={2}>
            <Select
              value={selectedCoreCode}
              onValueChange={applyCoreSelection}
              disabled={catalogLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={catalogLoading ? 'Cargando CORE…' : 'Seleccionar'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">Texto manual (sin código CORE)</SelectItem>
                <SelectItem value="__new__">+ Crear nueva en CORE…</SelectItem>
                {coreCatalog.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} — {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {selectedCoreCode === '__new__' && (
            <>
              <FormField label="Nombre nueva cobertura CORE" span={2}>
                <Input
                  value={newCoreName}
                  placeholder="Ej. Atención médica domiciliaria"
                  onChange={(e) => setNewCoreName(e.target.value)}
                />
              </FormField>
              <FormField label="Código contable (opcional)">
                <Input
                  value={newCoreAccounting}
                  placeholder="10-99"
                  onChange={(e) => setNewCoreAccounting(e.target.value)}
                />
              </FormField>
              <FormField>
                <Button
                  type="button"
                  variant="outline"
                  disabled={creatingCore || newCoreName.trim().length < 2}
                  onClick={handleCreateInCore}
                >
                  Registrar en CORE
                </Button>
              </FormField>
            </>
          )}

          <FormField label="Nombre de la cobertura" span={2}>
            <Input
              maxLength={FIELD_LIMITS.coverage.name}
              value={draft.name}
              placeholder="Ej. Daños a terceros"
              onChange={(e) =>
                patchDraft({ name: clampText(e.target.value, FIELD_LIMITS.coverage.name) })
              }
            />
          </FormField>

          <FormField label="Código contable">
            <Input
              maxLength={30}
              value={draft.accountingCode ?? draft.coberturaInternaCode ?? ''}
              onChange={(e) =>
                patchDraft({
                  accountingCode: clampText(e.target.value, 30),
                  coberturaInternaCode: clampText(e.target.value, 20),
                })
              }
            />
          </FormField>

          <FormField label="Tipo de cálculo">
            <Select
              value={draft.premiumCalculationType ?? 'PRIMA_FIJA'}
              onValueChange={(v) =>
                patchDraft({
                  premiumCalculationType: v as PremiumCalculationType,
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIMA_FIJA">Prima fija</SelectItem>
                <SelectItem value="TASA_PORCENTUAL">Tasa porcentual (%)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Suma asegurada mínima">
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={draft.insuredSumMin ?? ''}
              onChange={(e) =>
                patchDraft({
                  insuredSumMin: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </FormField>
          <FormField label="Suma asegurada">
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={draft.insuredSumFixed ?? ''}
              onChange={(e) =>
                patchDraft({
                  insuredSumFixed: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </FormField>

          {isRate ? (
            <FormField label="Tasa (%)" hint="Prima = suma × tasa / 100">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.0001}
                value={draft.tariffRate ?? ''}
                onChange={(e) =>
                  patchDraft({
                    tariffRate: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </FormField>
          ) : (
            <FormField label="Prima de la cobertura">
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={draft.tariffPremium ?? ''}
                onChange={(e) =>
                  patchDraft({
                    tariffPremium: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </FormField>
          )}

          <FormField label="Prima calculada" hint="Vista previa según tipo de cálculo.">
            <Input readOnly value={formatMoney(draftComputedPremium)} className="bg-muted/30" />
          </FormField>

          <FormField label="Sub-límite (% de cobertura madre)" hint="Patrimoniales: límite hijo como % de la madre.">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={draft.subLimitPercent ?? ''}
              onChange={(e) =>
                patchDraft({
                  subLimitPercent: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </FormField>

          <FormField label="Carencia (días)">
            <Input
              type="number"
              min={0}
              max={FIELD_LIMITS.coverage.waitingPeriodDays}
              value={draft.waitingPeriodDays ?? 0}
              onChange={(e) =>
                patchDraft({
                  waitingPeriodDays: clampInt(
                    Number(e.target.value),
                    0,
                    FIELD_LIMITS.coverage.waitingPeriodDays,
                  ),
                })
              }
            />
          </FormField>

          <FormField label="Depende de otra cobertura" span={2}>
            <Select
              value={draft.dependsOnCoverageName ?? '__none__'}
              onValueChange={(v) =>
                patchDraft({
                  dependsOnCoverageName: v === '__none__' ? undefined : v,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Ninguna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Ninguna (cobertura madre)</SelectItem>
                {otherCoverageNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField span={2}>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={!!draft.isBasicMandatory}
                onChange={(e) => patchDraft({ isBasicMandatory: e.target.checked })}
              />
              Básica obligatoria
            </label>
          </FormField>
        </FormGrid>

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
          <h3 className="text-sm font-semibold">Coberturas registradas ({coverages.length})</h3>
        </div>
        {coverages.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay coberturas todavía. Usa el formulario de arriba para agregar la primera.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Cálculo</th>
                  <th className="px-4 py-3 font-semibold">Suma</th>
                  <th className="px-4 py-3 font-semibold">Prima</th>
                  <th className="px-4 py-3 font-semibold">Sub-límite</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {coverages.map((c, i) => {
                  const parent = c.dependsOnCoverageName
                    ? coverages.find((x) => x.name === c.dependsOnCoverageName)
                    : undefined;
                  const premium = resolveCoveragePremium({
                    ...c,
                    parentSum: parent?.insuredSumFixed ?? parent?.insuredSumMin,
                  });
                  return (
                    <tr
                      key={c.id ?? `row-${i}`}
                      className="border-t border-border/40 hover:bg-muted/10"
                    >
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">
                        {c.name}
                        {c.coberturaInternaCode && (
                          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                            {c.coberturaInternaCode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {c.premiumCalculationType === 'TASA_PORCENTUAL'
                          ? `Tasa ${c.tariffRate ?? 0}%`
                          : 'Prima fija'}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatMoney(c.insuredSumFixed ?? c.insuredSumMin)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatMoney(premium)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {c.subLimitPercent != null ? `${c.subLimitPercent}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(i)}
                            aria-label={`Editar ${c.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(i)}
                            aria-label={`Eliminar ${c.name}`}
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
    </div>
  );
}
