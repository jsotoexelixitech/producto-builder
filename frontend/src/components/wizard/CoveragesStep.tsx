import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Coverage } from '@/types/product';
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

const EMPTY_DRAFT: Coverage = {
  name: '',
  isBasicMandatory: false,
  waitingPeriodDays: 0,
  insuredSumFixed: undefined,
  tariffPremium: undefined,
};

function formatMoney(value?: number) {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CoveragesStepProps {
  coverages: Coverage[];
  onCoveragesChange: (coverages: Coverage[]) => void;
}

export function CoveragesStep({ coverages, onCoveragesChange }: CoveragesStepProps) {
  const [draft, setDraft] = useState<Coverage>({ ...EMPTY_DRAFT });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const otherCoverageNames = useMemo(
    () =>
      coverages
        .filter((_, idx) => idx !== editingIndex && coverages[idx]?.name)
        .map((c) => c.name),
    [coverages, editingIndex],
  );

  function patchDraft(patch: Partial<Coverage>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function resetDraft() {
    setDraft({ ...EMPTY_DRAFT });
    setEditingIndex(null);
  }

  function handleAddOrUpdate() {
    const name = draft.name.trim();
    if (name.length < 2) return;

    const entry: Coverage = {
      ...draft,
      name: clampText(name, FIELD_LIMITS.coverage.name),
      waitingPeriodDays: clampInt(
        draft.waitingPeriodDays ?? 0,
        0,
        FIELD_LIMITS.coverage.waitingPeriodDays,
      ),
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
  }

  function handleDelete(index: number) {
    onCoveragesChange(coverages.filter((_, i) => i !== index));
    if (editingIndex === index) resetDraft();
    else if (editingIndex != null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  }

  const canSubmit = draft.name.trim().length >= 2;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Completa el formulario y agrega cada cobertura a la tabla. Puedes editar o eliminar filas
        en cualquier momento.
      </p>

      <SectionPanel
        title={editingIndex != null ? 'Editar cobertura' : 'Nueva cobertura'}
        description="Datos de suma asegurada, prima y vigencia."
      >
        <FormGrid>
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
          <FormField label="Suma asegurada mínima">
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={draft.insuredSumMin ?? ''}
              onChange={(e) =>
                patchDraft({
                  insuredSumMin:
                    e.target.value === '' ? undefined : Number(e.target.value),
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
                  insuredSumFixed:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </FormField>
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
                <SelectItem value="__none__">Ninguna</SelectItem>
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

        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/15 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reaseguro (opcional)
          </p>
          <FormGrid>
            <FormField label="Código de contrato">
              <Input
                maxLength={FIELD_LIMITS.coverage.reinsuranceContractCode}
                value={draft.reinsuranceContractCode ?? ''}
                onChange={(e) =>
                  patchDraft({
                    reinsuranceContractCode: clampText(
                      e.target.value,
                      FIELD_LIMITS.coverage.reinsuranceContractCode,
                    ),
                  })
                }
              />
            </FormField>
            <FormField label="Nombre del contrato">
              <Input
                maxLength={FIELD_LIMITS.coverage.reinsuranceContractName}
                value={draft.reinsuranceContractName ?? ''}
                onChange={(e) =>
                  patchDraft({
                    reinsuranceContractName: clampText(
                      e.target.value,
                      FIELD_LIMITS.coverage.reinsuranceContractName,
                    ),
                  })
                }
              />
            </FormField>
            <FormField label="Ramo de reaseguro" span={2}>
              <Input
                maxLength={FIELD_LIMITS.coverage.reinsuranceBranchCode}
                value={draft.reinsuranceBranchCode ?? ''}
                onChange={(e) =>
                  patchDraft({
                    reinsuranceBranchCode: clampText(
                      e.target.value,
                      FIELD_LIMITS.coverage.reinsuranceBranchCode,
                    ),
                  })
                }
              />
            </FormField>
          </FormGrid>
        </div>

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
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Suma mín.</th>
                  <th className="px-4 py-3 font-semibold">Suma</th>
                  <th className="px-4 py-3 font-semibold">Prima</th>
                  <th className="px-4 py-3 font-semibold">Carencia</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {coverages.map((c, i) => (
                  <tr
                    key={c.id ?? `row-${i}`}
                    className="border-t border-border/40 hover:bg-muted/10"
                  >
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatMoney(c.insuredSumMin)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatMoney(c.insuredSumFixed ?? c.insuredSumMin)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(c.tariffPremium)}</td>
                    <td className="px-4 py-3 tabular-nums">{c.waitingPeriodDays ?? 0} d</td>
                    <td className="px-4 py-3">
                      {c.isBasicMandatory ? 'Básica' : 'Accesoria'}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
