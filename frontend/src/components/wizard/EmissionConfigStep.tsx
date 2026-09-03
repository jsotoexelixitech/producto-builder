import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  FormInput,
  Layers,
  Plus,
  Route,
  Trash2,
} from 'lucide-react';
import type {
  Coverage,
  FlowStepConfig,
  FormField,
  ProductBranch,
  ProductPlan,
  RatingVariable,
  RequiredDocument,
} from '@/types/product';
import { SectionPanel } from '@/components/ui/section-panel';
import { FormField as FormFieldWrap, FormGrid } from '@/components/ui/form-field';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ToggleField } from '@/components/ui/toggle-field';
import { GuideBanner } from '@/components/flow/GuideBanner';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { clampText, FIELD_LIMITS } from '@/lib/field-limits';
import {
  canDisableFlowStep,
  fieldsForStep,
  isFormCapableStep,
  isFormEnabledForStep,
} from '@/lib/emission-form-steps';
import {
  DEFAULT_CLIENT_FIELD_LABELS,
  getBranchRiskPreview,
} from '@/lib/emission-flow';
import {
  branchLabel,
  FLOW_STEP_FEATURE_HINTS,
} from '@/lib/flow-step-features';
import { resolvePlanCoverageLabels } from '@/lib/product-plans';
import { labelAssignedChannel } from '@/lib/plan-channels';

const FIELD_TYPES = ['TEXT', 'NUMBER', 'SELECT', 'DATE', 'BOOLEAN'] as const;

interface EmissionConfigStepProps {
  flowSteps: FlowStepConfig[];
  formFields: FormField[];
  branch: ProductBranch;
  plans: ProductPlan[];
  requiredDocuments: RequiredDocument[];
  coverages: Coverage[];
  ratingVariables: RatingVariable[];
  onFlowStepsChange: (steps: FlowStepConfig[]) => void;
  onFormFieldsChange: (fields: FormField[]) => void;
}

function addFieldToStep(formFields: FormField[], stepKey: string): FormField[] {
  return [
    ...formFields,
    {
      label: 'Nuevo campo',
      fieldType: 'TEXT',
      required: true,
      stepKey,
      sortOrder: fieldsForStep(formFields, stepKey).length,
    },
  ];
}

function updateFieldAtStep(
  formFields: FormField[],
  stepKey: string,
  indexInStep: number,
  patch: Partial<FormField>,
): FormField[] {
  const indices = formFields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => (f.stepKey ?? 'RISK_DATA') === stepKey);
  const target = indices[indexInStep];
  if (!target) return formFields;
  return formFields.map((f, i) => (i === target.i ? { ...f, ...patch, stepKey } : f));
}

function removeFieldAtStep(
  formFields: FormField[],
  stepKey: string,
  indexInStep: number,
): FormField[] {
  const indices = formFields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => (f.stepKey ?? 'RISK_DATA') === stepKey);
  const target = indices[indexInStep];
  if (!target) return formFields;
  return formFields.filter((_, i) => i !== target.i);
}

function FeatureChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

function StepLinkedFeatures({
  stepKey,
  branch,
  formEnabled,
  formFieldCount,
  plans,
  requiredDocuments,
  coverages,
}: {
  stepKey: string;
  branch: ProductBranch;
  formEnabled: boolean;
  formFieldCount: number;
  plans: ProductPlan[];
  requiredDocuments: RequiredDocument[];
  coverages: Coverage[];
}) {
  const hint = FLOW_STEP_FEATURE_HINTS[stepKey];

  if (stepKey === 'CLIENT_DATA') {
    const labels =
      formEnabled && formFieldCount > 0
        ? null
        : [...DEFAULT_CLIENT_FIELD_LABELS];
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {formEnabled
            ? formFieldCount > 0
              ? `${formFieldCount} campo(s) personalizado(s) en el formulario de abajo.`
              : 'Activa el formulario personalizado abajo o se usarán los campos estándar.'
            : 'Sin formulario personalizado: el paso usará los campos estándar de cliente (tomador, RIF, representante, teléfono y correo).'}
        </p>
        {labels && (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <FeatureChip key={label}>{label}</FeatureChip>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (stepKey === 'RISK_DATA') {
    const riskPreview = getBranchRiskPreview(branch);
    const labels =
      formEnabled && formFieldCount > 0
        ? null
        : riskPreview.fields.map((f) => f.label);
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {formEnabled
            ? formFieldCount > 0
              ? `${formFieldCount} campo(s) personalizado(s) en el formulario de abajo.`
              : `Sin campos propios aún. Si no agregas ninguno, se usarán los del ramo ${branchLabel(branch)}.`
            : `Campos predefinidos del ramo ${branchLabel(branch)} (${riskPreview.title}).`}
        </p>
        {labels && (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <FeatureChip key={label}>{label}</FeatureChip>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (stepKey === 'PLANS_COVERAGES') {
    if (plans.length === 0) {
      return (
        <p className="text-sm italic text-muted-foreground">
          Aún no hay planes. Configúralos en el paso «Planes comerciales» del wizard.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {plans.map((plan) => {
          const coverageLabels = resolvePlanCoverageLabels(plan, coverages);
          return (
            <div
              key={plan.name}
              className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                {plan.isRecommended && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Recomendado
                  </span>
                )}
                {plan.badge && (
                  <span className="text-xs text-muted-foreground">{plan.badge}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {coverageLabels.length > 0
                  ? `${coverageLabels.length} cobertura(s): ${coverageLabels.join(', ')}`
                  : 'Sin coberturas vinculadas'}
                {' · '}
                {labelAssignedChannel(plan.assignedChannel)}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  if (stepKey === 'DOCUMENTS_OCR') {
    if (requiredDocuments.length === 0) {
      return (
        <p className="text-sm italic text-muted-foreground">
          Aún no hay documentos. Configúralos en el paso «Legal» del wizard.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {requiredDocuments.map((doc) => (
          <div
            key={doc.documentKey}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm text-foreground">{doc.label}</span>
            </div>
            <span
              className={cn(
                'shrink-0 text-[10px] font-semibold uppercase tracking-wide',
                doc.required !== false ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {doc.required !== false ? 'Obligatorio' : 'Opcional'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hint?.wizardStep && (
        <p className="text-xs font-medium text-primary">
          Configurado en: {hint.wizardStep}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{hint?.description}</p>
      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-xs text-muted-foreground">
          Este paso usa la experiencia estándar del flujo. Ajusta nombre, etiqueta corta y
          descripción para personalizar lo que ve el cliente.
        </p>
      </div>
    </div>
  );
}

function WizardBuildPanel({
  stepKey,
  stepLabel,
  formFields,
  coverages,
  ratingVariables,
  onFormFieldsChange,
}: {
  stepKey: string;
  stepLabel: string;
  formFields: FormField[];
  coverages: Coverage[];
  ratingVariables: RatingVariable[];
  onFormFieldsChange: (fields: FormField[]) => void;
}) {
  function appendField(partial: Partial<FormField>) {
    onFormFieldsChange([
      ...formFields,
      {
        label: partial.label ?? 'Campo',
        fieldType: partial.fieldType ?? 'TEXT',
        required: partial.required ?? true,
        stepKey,
        sortOrder: fieldsForStep(formFields, stepKey).length,
        options: partial.options,
      },
    ]);
  }

  const hasCatalog =
    coverages.length > 0 || ratingVariables.length > 0;

  if (!hasCatalog) return null;

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.04] p-4">
      <p className="text-sm font-semibold text-foreground">
        Armar paso con datos del wizard
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Agrega al formulario personalizado coberturas o variables de tarificación ya
        configuradas en pasos anteriores.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {coverages.map((c) => (
          <Button
            key={c.id ?? c.name}
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendField({
                label: c.name,
                fieldType: 'NUMBER',
              })
            }
          >
            + Cobertura: {c.name}
          </Button>
        ))}
        {ratingVariables.map((v) => (
          <Button
            key={v.name}
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendField({
                label: v.label,
                fieldType: v.variableType === 'SELECT' ? 'SELECT' : v.variableType === 'NUMBER' ? 'NUMBER' : 'TEXT',
                options: v.options,
              })
            }
          >
            + Variable: {v.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function StepFormEditor({
  stepKey,
  stepLabel,
  formFields,
  onFormFieldsChange,
}: {
  stepKey: string;
  stepLabel: string;
  formFields: FormField[];
  onFormFieldsChange: (fields: FormField[]) => void;
}) {
  const stepFields = fieldsForStep(formFields, stepKey);

  return (
    <div className="space-y-3">
      {stepFields.length === 0 && (
        <p className="text-sm italic text-muted-foreground">
          Sin campos todavía. Agrega el primero para este paso.
        </p>
      )}
      {stepFields.map((field, fieldIndex) => (
        <div
          key={`${stepKey}-${fieldIndex}`}
          className="grid gap-3 rounded-lg border border-border/60 bg-card p-3 sm:grid-cols-[1.4fr_1fr_auto]"
        >
          <FormFieldWrap label="Etiqueta del campo">
            <Input
              maxLength={FIELD_LIMITS.emission.formFieldLabel}
              value={field.label}
              onChange={(e) =>
                onFormFieldsChange(
                  updateFieldAtStep(formFields, stepKey, fieldIndex, {
                    label: clampText(e.target.value, FIELD_LIMITS.emission.formFieldLabel),
                  }),
                )
              }
            />
          </FormFieldWrap>
          <FormFieldWrap label="Tipo de dato">
            <Select
              value={field.fieldType}
              onValueChange={(v) =>
                onFormFieldsChange(
                  updateFieldAtStep(formFields, stepKey, fieldIndex, {
                    fieldType: v,
                  }),
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldWrap>
          <div className="flex items-end gap-2">
            <ToggleField
              id={`field-req-${stepKey}-${fieldIndex}`}
              label="Obligatorio"
              checked={field.required !== false}
              onChange={(v) =>
                onFormFieldsChange(
                  updateFieldAtStep(formFields, stepKey, fieldIndex, {
                    required: v,
                  }),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 shrink-0 p-0"
              onClick={() =>
                onFormFieldsChange(removeFieldAtStep(formFields, stepKey, fieldIndex))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-dashed"
        onClick={() => onFormFieldsChange(addFieldToStep(formFields, stepKey))}
      >
        <Plus className="h-4 w-4" />
        Agregar campo a «{stepLabel}»
      </Button>
    </div>
  );
}

export function EmissionConfigStep({
  flowSteps,
  formFields,
  branch,
  plans,
  requiredDocuments,
  coverages,
  ratingVariables,
  onFlowStepsChange,
  onFormFieldsChange,
}: EmissionConfigStepProps) {
  const [activeTab, setActiveTab] = useState(flowSteps[0]?.stepKey ?? '');
  const [expandedContent, setExpandedContent] = useState<Record<string, boolean>>({});
  const [expandedForms, setExpandedForms] = useState<Record<string, boolean>>({});

  function isContentExpanded(stepKey: string, active: boolean) {
    if (!active) return false;
    return expandedContent[stepKey] ?? true;
  }

  function isFormExpanded(stepKey: string, active: boolean, formEnabled: boolean) {
    if (!active || !formEnabled) return false;
    return expandedForms[stepKey] ?? true;
  }

  function toggleContentExpanded(stepKey: string) {
    setExpandedContent((prev) => ({
      ...prev,
      [stepKey]: !(prev[stepKey] ?? true),
    }));
  }

  function toggleFormExpanded(stepKey: string) {
    setExpandedForms((prev) => ({
      ...prev,
      [stepKey]: !(prev[stepKey] ?? true),
    }));
  }

  const activeCount = flowSteps.filter((s) => s.enabled !== false).length;
  const tabIndex = Math.max(
    0,
    flowSteps.findIndex((s) => s.stepKey === activeTab),
  );
  const step = flowSteps[tabIndex] ?? flowSteps[0];
  const i = tabIndex;

  if (!step) {
    return null;
  }

  const active = step.enabled !== false;
  const formCapable = isFormCapableStep(step.stepKey);
  const formEnabled = isFormEnabledForStep(step);
  const canDisable = canDisableFlowStep(step.stepKey);
  const contentExpanded = isContentExpanded(step.stepKey, active);
  const formExpanded = isFormExpanded(step.stepKey, active, formEnabled);
  const stepFields = fieldsForStep(formFields, step.stepKey);
  const featureHint = FLOW_STEP_FEATURE_HINTS[step.stepKey];

  return (
    <div className="space-y-6">
      <GuideBanner>
        Activa los pasos que necesite este producto. Cada paso activo se configura con nombre,
        descripción y el contenido ya definido en el wizard (planes, documentos, campos
        estándar). En cliente y riesgo puedes activar además un formulario personalizado.
      </GuideBanner>

      <Alert variant="warning">
        Los pasos del flujo son un catálogo predefinido (cliente, riesgo, planes, documentos,
        etc.). Puedes activarlos, renombrarlos y añadir campos, pero no crear pasos con un
        identificador nuevo desde aquí.
      </Alert>

      <SectionPanel
        icon={Route}
        title="Pasos del flujo"
        description={`${activeCount} de ${flowSteps.length} pasos activos. Elige una pestaña para configurar.`}
      >
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border/60 pb-1">
          {flowSteps.map((s, idx) => {
            const on = s.stepKey === step.stepKey;
            const enabled = s.enabled !== false;
            return (
              <button
                key={s.stepKey}
                type="button"
                onClick={() => setActiveTab(s.stepKey)}
                className={cn(
                  'shrink-0 rounded-t-lg px-3 py-2 text-left text-xs font-semibold transition-colors sm:text-sm',
                  on
                    ? 'border border-b-0 border-border/60 bg-card text-primary'
                    : 'text-muted-foreground hover:bg-muted/40',
                  !enabled && 'opacity-50',
                )}
              >
                <span className="block truncate max-w-[8rem] sm:max-w-[10rem]">
                  {idx + 1}. {s.shortLabel ?? s.label}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            'overflow-hidden rounded-xl border transition-colors',
            active
              ? 'border-border/60 bg-card shadow-sm'
              : 'border-dashed border-border/50 bg-muted/10',
          )}
        >
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{step.label}</p>
                <p className="text-xs text-muted-foreground">
                  <code className="font-mono">{step.stepKey}</code>
                  {formCapable && active && formEnabled && stepFields.length > 0 && (
                    <span> · {stepFields.length} campo(s) personalizado(s)</span>
                  )}
                </p>
              </div>

              <ToggleField
                id={`step-enabled-${step.stepKey}`}
                label={active ? 'Paso activo' : 'Paso desactivado'}
                description={
                  canDisable
                    ? 'No aparecerá en el flujo del cliente'
                    : 'Paso obligatorio del flujo'
                }
                checked={active}
                disabled={!canDisable}
                onChange={(v) => {
                  const next = [...flowSteps];
                  next[i] = { ...step, enabled: v };
                  onFlowStepsChange(next);
                  if (v) {
                    setExpandedContent((prev) => ({ ...prev, [step.stepKey]: true }));
                  }
                }}
                className="w-full sm:w-auto sm:min-w-[220px]"
              />
            </div>

            {active && (
              <FormGrid>
                <FormFieldWrap label="Nombre del paso">
                  <Input
                    maxLength={FIELD_LIMITS.emission.flowStepLabel}
                    value={step.label}
                    onChange={(e) => {
                      const next = [...flowSteps];
                      next[i] = {
                        ...step,
                        label: clampText(e.target.value, FIELD_LIMITS.emission.flowStepLabel),
                      };
                      onFlowStepsChange(next);
                    }}
                  />
                </FormFieldWrap>
                <FormFieldWrap label="Etiqueta corta">
                  <Input
                    maxLength={FIELD_LIMITS.emission.flowStepShortLabel}
                    value={step.shortLabel ?? ''}
                    onChange={(e) => {
                      const next = [...flowSteps];
                      next[i] = {
                        ...step,
                        shortLabel: clampText(
                          e.target.value,
                          FIELD_LIMITS.emission.flowStepShortLabel,
                        ),
                      };
                      onFlowStepsChange(next);
                    }}
                  />
                </FormFieldWrap>
              </FormGrid>
            )}

            {active && formCapable && (
              <ToggleField
                id={`step-form-${step.stepKey}`}
                label="Incluir formulario personalizado"
                description="Desmarca para usar campos estándar del catálogo o el contenido ya definido en pasos anteriores (planes, documentos, etc.)"
                checked={formEnabled}
                onChange={(v) => {
                  const next = [...flowSteps];
                  next[i] = { ...step, formEnabled: v };
                  onFlowStepsChange(next);
                  setExpandedContent((prev) => ({ ...prev, [step.stepKey]: true }));
                  if (v) {
                    setExpandedForms((prev) => ({ ...prev, [step.stepKey]: true }));
                  }
                }}
              />
            )}

            {!active && canDisable && (
              <p className="text-xs text-muted-foreground">
                Este paso está desactivado. Actívalo si lo necesitas para este producto.
              </p>
            )}
          </div>

          {active && (
            <div className="border-t border-border/60 bg-muted/[0.04]">
              <button
                type="button"
                onClick={() => toggleContentExpanded(step.stepKey)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-foreground/70" />
                  <span className="text-sm font-semibold text-foreground">Contenido del paso</span>
                  {featureHint?.title && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      · {featureHint.title}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    contentExpanded && 'rotate-180',
                  )}
                />
              </button>

              {contentExpanded && (
                <div className="space-y-4 border-t border-border/40 px-4 pb-4 pt-3">
                  <FormFieldWrap
                    label="Descripción visible para el cliente"
                    hint="Aparece bajo el título del paso en la vista previa del flujo"
                  >
                    <Textarea
                      rows={2}
                      maxLength={FIELD_LIMITS.emission.flowStepDescription}
                      value={step.description ?? ''}
                      placeholder={
                        featureHint?.description ??
                        'Instrucciones o contexto para el solicitante en este paso'
                      }
                      onChange={(e) => {
                        const next = [...flowSteps];
                        next[i] = {
                          ...step,
                          description: clampText(
                            e.target.value,
                            FIELD_LIMITS.emission.flowStepDescription,
                          ),
                        };
                        onFlowStepsChange(next);
                      }}
                    />
                  </FormFieldWrap>

                  <StepLinkedFeatures
                    stepKey={step.stepKey}
                    branch={branch}
                    formEnabled={formEnabled}
                    formFieldCount={stepFields.length}
                    plans={plans}
                    requiredDocuments={requiredDocuments}
                    coverages={coverages}
                  />
                </div>
              )}
            </div>
          )}

          {active && formCapable && formEnabled && (
            <div className="border-t border-primary/15 bg-primary/[0.03]">
              <button
                type="button"
                onClick={() => toggleFormExpanded(step.stepKey)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <FormInput className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    Formulario personalizado
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {stepFields.length} campo(s)
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    formExpanded && 'rotate-180',
                  )}
                />
              </button>

              {formExpanded && (
                <div className="space-y-4 border-t border-primary/10 px-4 pb-4 pt-3">
                  <WizardBuildPanel
                    stepKey={step.stepKey}
                    stepLabel={step.label}
                    formFields={formFields}
                    coverages={coverages}
                    ratingVariables={ratingVariables}
                    onFormFieldsChange={onFormFieldsChange}
                  />
                  <StepFormEditor
                    stepKey={step.stepKey}
                    stepLabel={step.label}
                    formFields={formFields}
                    onFormFieldsChange={onFormFieldsChange}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </SectionPanel>
    </div>
  );
}
