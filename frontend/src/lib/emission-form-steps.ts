import type { FlowStepConfig, FormField } from '@/types/product';

/** Pasos que no se pueden desactivar en el flujo */
export const REQUIRED_FLOW_STEP_KEYS = ['FINISHED'] as const;

export function canDisableFlowStep(stepKey: string): boolean {
  return !(REQUIRED_FLOW_STEP_KEYS as readonly string[]).includes(stepKey);
}

/** Pasos del flujo que admiten campos de formulario configurables */
export const FORM_CAPABLE_STEP_KEYS = ['CLIENT_DATA', 'RISK_DATA'] as const;

export type FormCapableStepKey = (typeof FORM_CAPABLE_STEP_KEYS)[number];

export function isFormCapableStep(stepKey: string): stepKey is FormCapableStepKey {
  return (FORM_CAPABLE_STEP_KEYS as readonly string[]).includes(stepKey);
}

export function isFormEnabledForStep(step: FlowStepConfig): boolean {
  return isFormCapableStep(step.stepKey) && step.formEnabled !== false;
}

export function getFormCapableSteps(flowSteps: FlowStepConfig[]): FlowStepConfig[] {
  return flowSteps.filter((s) => s.enabled !== false && isFormEnabledForStep(s));
}

export function fieldsForStep(formFields: FormField[], stepKey: string): FormField[] {
  return formFields.filter((f) => (f.stepKey ?? 'RISK_DATA') === stepKey);
}

export function groupFieldsByStep(formFields: FormField[]): Record<string, FormField[]> {
  const grouped: Record<string, FormField[]> = {};
  for (const key of FORM_CAPABLE_STEP_KEYS) {
    grouped[key] = fieldsForStep(formFields, key);
  }
  for (const f of formFields) {
    const key = f.stepKey ?? 'RISK_DATA';
    if (!grouped[key]) grouped[key] = [];
    if (!grouped[key].includes(f)) grouped[key].push(f);
  }
  return grouped;
}
