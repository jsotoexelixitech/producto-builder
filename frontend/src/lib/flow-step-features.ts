import type { ProductBranch } from '@/types/product';

export interface FlowStepFeatureHint {
  title: string;
  wizardStep?: string;
  description: string;
}

export const FLOW_STEP_FEATURE_HINTS: Record<string, FlowStepFeatureHint> = {
  CLIENT_DATA: {
    title: 'Datos del tomador',
    description:
      'Captura la información legal del cliente. Sin formulario personalizado se usan los campos estándar del producto.',
  },
  RISK_DATA: {
    title: 'Variables del riesgo',
    description:
      'Datos específicos del bien a asegurar. Sin formulario personalizado se usan los campos predefinidos del ramo.',
  },
  PLANS_COVERAGES: {
    title: 'Planes comerciales',
    wizardStep: 'Planes comerciales (paso 3)',
    description: 'El cliente compara y elige entre los planes definidos para este producto.',
  },
  DOCUMENTS_OCR: {
    title: 'Recaudos documentales',
    wizardStep: 'Legal (paso 4)',
    description: 'Documentos obligatorios u opcionales con lectura automática (OCR).',
  },
  DIGITAL_SIGNATURE: {
    title: 'Firma y consentimiento',
    description: 'El solicitante firma digitalmente la solicitud y acepta condiciones.',
  },
  AI_INSPECTION: {
    title: 'Inspección con IA',
    description: 'Evidencia fotográfica y checklist técnico antes de habilitar el pago.',
  },
  TECHNICAL_APPROVAL: {
    title: 'Aprobación interna',
    description: 'Revisión técnica del suscriptor antes de liberar el cobro.',
  },
  PAYMENT: {
    title: 'Cobro de prima',
    description: 'Selección de forma de pago una vez aprobada la solicitud.',
  },
  FINISHED: {
    title: 'Emisión completada',
    description: 'Confirmación de póliza emitida y documentos disponibles para el cliente.',
  },
};

export function branchLabel(branch: ProductBranch): string {
  const labels: Record<ProductBranch, string> = {
    AUTOMOVIL: 'Automóvil',
    SALUD: 'Salud',
    VIDA: 'Vida',
    PATRIMONIAL: 'Patrimonial',
    INCLUSIVO: 'Inclusivo',
    RCV_OBLIGATORIO: 'RCV obligatorio',
  };
  return labels[branch] ?? branch;
}
