import type { Product, ProductBranch, RequiredDocument, FormField, ProductPlan } from '@/types/product';
import { currencySymbol } from '@/lib/core-catalog';
import { BRANCH_META, DEFAULT_DOCUMENTS_BY_BRANCH, DOCUMENT_CATALOG } from '@/lib/constants';
import { groupFieldsByStep, isFormEnabledForStep } from '@/lib/emission-form-steps';

export type FlowStepId =
  | 'CLIENT_DATA'
  | 'RISK_DATA'
  | 'PLANS_COVERAGES'
  | 'DOCUMENTS_OCR'
  | 'DIGITAL_SIGNATURE'
  | 'AI_INSPECTION'
  | 'TECHNICAL_APPROVAL'
  | 'PAYMENT'
  | 'FINISHED';

export interface FlowStepDefinition {
  id: FlowStepId;
  number: number;
  label: string;
  shortLabel: string;
  description: string;
  enabled: boolean;
}

export interface RiskFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  hint?: string;
  span?: 'full' | 'half';
}

export interface SummaryLine {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface FlowPreviewContext {
  product: Product;
  steps: FlowStepDefinition[];
  riskStepTitle: string;
  riskStepSubtitle: string;
  riskFields: RiskFieldDefinition[];
  documents: RequiredDocument[];
  clientFields: FormField[];
  fieldsByStep: Record<string, FormField[]>;
  plans: ProductPlan[];
  summaryLines: SummaryLine[];
  totalEstimate: string;
  paymentBlockedReason: string | null;
  inspectionRequired: boolean;
}

const BASE_STEPS: Omit<FlowStepDefinition, 'number' | 'enabled'>[] = [
  {
    id: 'CLIENT_DATA',
    label: 'Datos cliente',
    shortLabel: 'Cliente',
    description: 'Información legal del tomador y representante.',
  },
  {
    id: 'RISK_DATA',
    label: 'Datos del riesgo',
    shortLabel: 'Riesgo',
    description: 'Captura de variables específicas del producto.',
  },
  {
    id: 'PLANS_COVERAGES',
    label: 'Planes y coberturas',
    shortLabel: 'Planes',
    description: 'Comparación de planes y selección de coberturas.',
  },
  {
    id: 'DOCUMENTS_OCR',
    label: 'Documentos OCR',
    shortLabel: 'Documentos',
    description: 'Recaudos obligatorios y opcionales con lectura automática.',
  },
  {
    id: 'DIGITAL_SIGNATURE',
    label: 'Firma digital',
    shortLabel: 'Firma',
    description: 'Consentimiento y firma del solicitante.',
  },
  {
    id: 'AI_INSPECTION',
    label: 'Inspección IA',
    shortLabel: 'Inspección',
    description: 'Evidencia fotográfica y checklist técnico.',
  },
  {
    id: 'TECHNICAL_APPROVAL',
    label: 'Aprobación técnica',
    shortLabel: 'Aprobación',
    description: 'Revisión interna antes de habilitar el pago.',
  },
  {
    id: 'PAYMENT',
    label: 'Pago habilitado',
    shortLabel: 'Pago',
    description: 'Selección de forma de pago tras aprobación.',
  },
  {
    id: 'FINISHED',
    label: 'Finalizado',
    shortLabel: 'Listo',
    description: 'Póliza emitida y documentos disponibles.',
  },
];

function branchNeedsInspection(branch: ProductBranch): boolean {
  return ['AUTOMOVIL', 'RCV_OBLIGATORIO', 'PATRIMONIAL'].includes(branch);
}

function branchNeedsSignature(branch: ProductBranch): boolean {
  return branch !== 'RCV_OBLIGATORIO';
}

function getRiskMeta(branch: ProductBranch): {
  title: string;
  subtitle: string;
  fields: RiskFieldDefinition[];
} {
  switch (branch) {
    case 'RCV_OBLIGATORIO':
    case 'AUTOMOVIL':
      return {
        title: 'Datos del vehículo',
        subtitle: 'Información del riesgo automotor a asegurar.',
        fields: [
          { key: 'placa', label: 'Placa', placeholder: 'ABC12D', type: 'text' },
          { key: 'marca', label: 'Marca', placeholder: 'Toyota', type: 'text' },
          { key: 'modelo', label: 'Modelo', placeholder: 'Corolla', type: 'text' },
          { key: 'anio', label: 'Año', placeholder: '2020', type: 'number' },
          {
            key: 'uso',
            label: 'Uso del vehículo',
            placeholder: 'Particular',
            type: 'select',
            options: ['Particular', 'Comercial', 'Transporte público'],
          },
          { key: 'serial', label: 'Serial de carrocería', placeholder: '1HGBH41JXMN109186', type: 'text', span: 'full' },
        ],
      };
    case 'PATRIMONIAL':
      return {
        title: 'Datos del edificio',
        subtitle: 'Información del riesgo patrimonial / condominio.',
        fields: [
          { key: 'nombreEdificio', label: 'Nombre del edificio', placeholder: 'Residencias Parque Ávila', type: 'text' },
          { key: 'apartamentos', label: 'Cantidad de apartamentos', placeholder: '84', type: 'number' },
          { key: 'anioConstruccion', label: 'Año de construcción', placeholder: '1998', type: 'number' },
          { key: 'pisos', label: 'Cantidad de pisos', placeholder: '12', type: 'number' },
          {
            key: 'uso',
            label: 'Uso del edificio',
            placeholder: 'Residencial',
            type: 'select',
            options: ['Residencial', 'Mixto', 'Comercial'],
          },
          {
            key: 'ascensores',
            label: 'Ascensores',
            placeholder: 'Sí',
            type: 'select',
            options: ['Sí', 'No'],
          },
          { key: 'direccion', label: 'Dirección del riesgo', placeholder: 'Av. Principal, Caracas', type: 'text', span: 'full' },
        ],
      };
    case 'SALUD':
      return {
        title: 'Datos del asegurado',
        subtitle: 'Información médica y demográfica para tarificación.',
        fields: [
          { key: 'edad', label: 'Edad', placeholder: '35', type: 'number' },
          {
            key: 'sexo',
            label: 'Sexo',
            placeholder: 'Femenino',
            type: 'select',
            options: ['Femenino', 'Masculino'],
          },
          {
            key: 'planSalud',
            label: 'Tipo de plan',
            placeholder: 'Individual',
            type: 'select',
            options: ['Individual', 'Familiar', 'Colectivo'],
          },
          { key: 'preexistencias', label: 'Preexistencias declaradas', placeholder: 'Ninguna', type: 'text', span: 'full' },
        ],
      };
    case 'VIDA':
      return {
        title: 'Datos del asegurado',
        subtitle: 'Variables actuariales para el producto de vida.',
        fields: [
          { key: 'edad', label: 'Edad', placeholder: '42', type: 'number' },
          { key: 'sumaAsegurada', label: 'Suma asegurada deseada', placeholder: '50000', type: 'number' },
          {
            key: 'ocupacion',
            label: 'Ocupación',
            placeholder: 'Profesional',
            type: 'select',
            options: ['Profesional', 'Empleado', 'Independiente', 'Jubilado'],
          },
          { key: 'beneficiario', label: 'Beneficiario principal', placeholder: 'María Fernanda Rivas', type: 'text', span: 'full' },
        ],
      };
    case 'INCLUSIVO':
      return {
        title: 'Datos del beneficiario',
        subtitle: 'Información del titular del producto inclusivo.',
        fields: [
          { key: 'comunidad', label: 'Comunidad / red', placeholder: 'Red Comunitaria Norte', type: 'text' },
          { key: 'miembros', label: 'Miembros del núcleo', placeholder: '4', type: 'number' },
          { key: 'referencia', label: 'Referencia interna', placeholder: 'INC-2026-001', type: 'text', span: 'full' },
        ],
      };
    default:
      return {
        title: 'Datos del riesgo',
        subtitle: 'Variables configurables del producto.',
        fields: [
          { key: 'descripcion', label: 'Descripción del riesgo', placeholder: 'Detalle del bien a asegurar', type: 'text', span: 'full' },
        ],
      };
  }
}

function resolveDocuments(product: Product): RequiredDocument[] {
  if (product.requiredDocuments?.length) return product.requiredDocuments;

  const defaults = DEFAULT_DOCUMENTS_BY_BRANCH[product.branch] ?? {};
  return DOCUMENT_CATALOG.filter((d) => d.key in defaults).map((d, i) => ({
    documentKey: d.key,
    label: d.label,
    required: defaults[d.key],
    sortOrder: i,
  }));
}

function buildSummaryLines(product: Product): SummaryLine[] {
  const branchLabel = BRANCH_META[product.branch].label;
  const coverageCount = product.coverages?.length ?? 0;
  const premium = product.actuarialData?.commercialPremium;

  const lines: SummaryLine[] = [
    { label: 'Producto', value: product.commercialName },
    { label: 'Ramo', value: branchLabel },
    { label: 'Código interno', value: product.internalCode },
    { label: 'Coberturas', value: String(coverageCount) },
  ];

  if (premium != null) {
    lines.push({
      label: 'Prima comercial',
      value: `${currencySymbol(product.currency)} ${Number(premium).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      highlight: true,
    });
  }

  return lines;
}

function estimateTotal(product: Product): string {
  const premium = product.actuarialData?.commercialPremium;
  if (premium == null) return 'Por calcular';
  const symbol = currencySymbol(product.currency);
  return `${symbol} ${Number(premium).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
}

export function buildFlowPreviewContext(product: Product): FlowPreviewContext {
  const riskMeta = getRiskMeta(product.branch);
  const inspectionRequired =
    product.flowStepConfigs?.some((s) => s.stepKey === 'AI_INSPECTION' && s.enabled !== false) ??
    branchNeedsInspection(product.branch);

  const steps: FlowStepDefinition[] = product.flowStepConfigs?.length
    ? product.flowStepConfigs
        .filter((s) => s.enabled !== false)
        .map((s, i) => ({
          id: s.stepKey as FlowStepId,
          number: i + 1,
          label: s.label,
          shortLabel: s.shortLabel ?? s.label.split(' ').pop() ?? s.label,
          description: s.description ?? '',
          enabled: true,
        }))
    : (() => {
        const signatureRequired = branchNeedsSignature(product.branch);
        const enabledById: Partial<Record<FlowStepId, boolean>> = {
          CLIENT_DATA: true,
          RISK_DATA: true,
          PLANS_COVERAGES: true,
          DOCUMENTS_OCR: true,
          DIGITAL_SIGNATURE: signatureRequired,
          AI_INSPECTION: inspectionRequired,
          TECHNICAL_APPROVAL: inspectionRequired || product.branch === 'PATRIMONIAL',
          PAYMENT: true,
          FINISHED: true,
        };
        return BASE_STEPS.filter((s) => enabledById[s.id] !== false).map((s, i) => ({
          ...s,
          number: i + 1,
          enabled: true,
          label: s.id === 'RISK_DATA' ? riskMeta.title : s.label,
        }));
      })();

  const clientStepConfig = product.flowStepConfigs?.find((s) => s.stepKey === 'CLIENT_DATA');
  const riskStepConfig = product.flowStepConfigs?.find((s) => s.stepKey === 'RISK_DATA');
  const clientFormEnabled = clientStepConfig ? isFormEnabledForStep(clientStepConfig) : true;
  const riskFormEnabled = riskStepConfig ? isFormEnabledForStep(riskStepConfig) : true;

  const riskCustomFields =
    riskFormEnabled && product.formFields?.length
      ? product.formFields.filter((f) => f.stepKey === 'RISK_DATA' || !f.stepKey)
      : [];

  const riskFields: RiskFieldDefinition[] = riskCustomFields.length
    ? riskCustomFields.map((f) => ({
        key: f.label.toLowerCase().replace(/\s+/g, '_'),
        label: f.label,
        placeholder: f.label,
        type: (f.fieldType === 'NUMBER'
          ? 'number'
          : f.fieldType === 'SELECT'
            ? 'select'
            : 'text') as 'text' | 'number' | 'select',
        options: f.options,
      }))
    : riskMeta.fields;

  const riskStepTitle = riskStepConfig?.label ?? riskMeta.title;
  const riskStepSubtitle = riskStepConfig?.description ?? riskMeta.subtitle;

  const paymentBlockedReason =
    inspectionRequired || product.branch === 'PATRIMONIAL'
      ? 'El pago se habilita solo después de la inspección y aprobación técnica.'
      : null;

  return {
    product,
    steps,
    riskStepTitle,
    riskStepSubtitle,
    riskFields,
    documents: resolveDocuments(product),
    clientFields:
      clientFormEnabled && product.formFields?.length
        ? product.formFields.filter((f) => f.stepKey === 'CLIENT_DATA')
        : [],
    fieldsByStep: (() => {
      if (!product.formFields?.length) {
        return {
          CLIENT_DATA: [],
          RISK_DATA: riskFields.map((f) => ({
            label: f.label,
            fieldType: f.type === 'number' ? 'NUMBER' : f.type === 'select' ? 'SELECT' : 'TEXT',
            required: true,
            stepKey: 'RISK_DATA',
            options: f.options,
          })),
        };
      }
      const grouped = groupFieldsByStep(product.formFields);
      if (!clientFormEnabled) grouped.CLIENT_DATA = [];
      if (!riskFormEnabled) grouped.RISK_DATA = [];
      return grouped;
    })(),
    plans: product.productPlans ?? [],
    summaryLines: buildSummaryLines(product),
    totalEstimate: estimateTotal(product),
    paymentBlockedReason,
    inspectionRequired,
  };
}

export function getRiskStepLabel(branch: ProductBranch): string {
  return getRiskMeta(branch).title;
}

/** Campos de riesgo predefinidos por ramo (cuando no hay formulario personalizado). */
export function getBranchRiskPreview(branch: ProductBranch): {
  title: string;
  subtitle: string;
  fields: RiskFieldDefinition[];
} {
  return getRiskMeta(branch);
}

export const DEFAULT_CLIENT_FIELD_LABELS = [
  'Razón social / Tomador',
  'RIF',
  'Representante legal',
  'Cédula representante',
  'Teléfono',
  'Correo',
] as const;
