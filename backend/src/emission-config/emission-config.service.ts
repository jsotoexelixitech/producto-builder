import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductBranch } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertEmissionConfigDto } from './dto/emission-config.dto';
const DEFAULT_FLOW_STEPS = [
  { stepKey: 'CLIENT_DATA', label: 'Datos cliente', shortLabel: 'Cliente', description: 'Información legal del tomador.', sortOrder: 0 },
  { stepKey: 'RISK_DATA', label: 'Datos del riesgo', shortLabel: 'Riesgo', description: 'Variables específicas del producto.', sortOrder: 1 },
  { stepKey: 'PLANS_COVERAGES', label: 'Planes y coberturas', shortLabel: 'Planes', description: 'Selección de plan comercial.', sortOrder: 2 },
  { stepKey: 'DOCUMENTS_OCR', label: 'Documentos OCR', shortLabel: 'Documentos', description: 'Recaudos con lectura automática.', sortOrder: 3 },
  { stepKey: 'DIGITAL_SIGNATURE', label: 'Firma digital', shortLabel: 'Firma', description: 'Consentimiento y firma.', sortOrder: 4 },
  { stepKey: 'AI_INSPECTION', label: 'Inspección IA', shortLabel: 'Inspección', description: 'Evidencia fotográfica.', sortOrder: 5 },
  { stepKey: 'TECHNICAL_APPROVAL', label: 'Aprobación técnica', shortLabel: 'Aprobación', description: 'Revisión interna.', sortOrder: 6 },
  { stepKey: 'PAYMENT', label: 'Pago habilitado', shortLabel: 'Pago', description: 'Forma de pago.', sortOrder: 7 },
  { stepKey: 'FINISHED', label: 'Finalizado', shortLabel: 'Listo', description: 'Póliza emitida.', sortOrder: 8 },
];

function defaultFormFields(branch: ProductBranch) {  const client = [
    { label: 'Razón social / Tomador', fieldType: 'TEXT' as const, required: true, stepKey: 'CLIENT_DATA', sortOrder: 0 },
    { label: 'RIF', fieldType: 'TEXT' as const, required: true, stepKey: 'CLIENT_DATA', sortOrder: 1 },
    { label: 'Representante legal', fieldType: 'TEXT' as const, required: true, stepKey: 'CLIENT_DATA', sortOrder: 2 },
    { label: 'Cédula representante', fieldType: 'TEXT' as const, required: true, stepKey: 'CLIENT_DATA', sortOrder: 3 },
    { label: 'Teléfono', fieldType: 'TEXT' as const, required: true, stepKey: 'CLIENT_DATA', sortOrder: 4 },
    { label: 'Correo', fieldType: 'TEXT' as const, required: true, stepKey: 'CLIENT_DATA', sortOrder: 5 },
  ];

  const riskByBranch: Record<ProductBranch, { label: string; fieldType: 'TEXT' | 'NUMBER' | 'SELECT'; required?: boolean; options?: string[] }[]> = {
    AUTOMOVIL: [
      { label: 'Placa', fieldType: 'TEXT', required: true },
      { label: 'Marca', fieldType: 'TEXT', required: true },
      { label: 'Modelo', fieldType: 'TEXT', required: true },
      { label: 'Año', fieldType: 'NUMBER', required: true },
      { label: 'Uso del vehículo', fieldType: 'SELECT', options: ['Particular', 'Comercial'] },
    ],
    RCV_OBLIGATORIO: [
      { label: 'Placa', fieldType: 'TEXT', required: true },
      { label: 'Marca', fieldType: 'TEXT', required: true },
      { label: 'Modelo', fieldType: 'TEXT', required: true },
      { label: 'Año', fieldType: 'NUMBER', required: true },
    ],
    PATRIMONIAL: [
      { label: 'Nombre del edificio', fieldType: 'TEXT', required: true },
      { label: 'Cantidad de apartamentos', fieldType: 'NUMBER', required: true },
      { label: 'Año de construcción', fieldType: 'NUMBER', required: true },
      { label: 'Cantidad de pisos', fieldType: 'NUMBER', required: true },
      { label: 'Uso del edificio', fieldType: 'SELECT', options: ['Residencial', 'Mixto', 'Comercial'] },
    ],
    SALUD: [
      { label: 'Edad', fieldType: 'NUMBER', required: true },
      { label: 'Sexo', fieldType: 'SELECT', options: ['Femenino', 'Masculino'] },
      { label: 'Tipo de plan', fieldType: 'SELECT', options: ['Individual', 'Familiar'] },
    ],
    VIDA: [
      { label: 'Edad', fieldType: 'NUMBER', required: true },
      { label: 'Suma asegurada deseada', fieldType: 'NUMBER', required: true },
      { label: 'Beneficiario principal', fieldType: 'TEXT', required: true },
    ],
    INCLUSIVO: [
      { label: 'Comunidad / red', fieldType: 'TEXT', required: true },
      { label: 'Miembros del núcleo', fieldType: 'NUMBER', required: true },
    ],
  };

  const risk = (riskByBranch[branch] ?? [{ label: 'Descripción del riesgo', fieldType: 'TEXT', required: true }]).map(
    (f, i) => ({ ...f, stepKey: 'RISK_DATA', sortOrder: i, required: f.required ?? true }),
  );

  return [...client, ...risk];
}

function branchStepDefaults(branch: ProductBranch) {
  const inspection = ['AUTOMOVIL', 'RCV_OBLIGATORIO', 'PATRIMONIAL'].includes(branch);
  const signature = branch !== 'RCV_OBLIGATORIO';
  const techApproval = inspection || branch === 'PATRIMONIAL';

  return DEFAULT_FLOW_STEPS.map((s) => ({
    ...s,
    enabled:
      s.stepKey === 'DIGITAL_SIGNATURE'
        ? signature
        : s.stepKey === 'AI_INSPECTION'
          ? inspection
          : s.stepKey === 'TECHNICAL_APPROVAL'
            ? techApproval
            : true,
  }));
}

@Injectable()
export class EmissionConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        flowStepConfigs: { orderBy: { sortOrder: 'asc' } },
        formFields: { orderBy: { sortOrder: 'asc' } },
        requiredDocuments: { orderBy: { sortOrder: 'asc' } },
        coverages: { orderBy: { sortOrder: 'asc' } },
        actuarialData: true,      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const hasFlowSteps = product.flowStepConfigs.length > 0;
    const hasFormFields = product.formFields.length > 0;

    return {
      productId,
      branch: product.branch,
      flowSteps: hasFlowSteps ? product.flowStepConfigs : branchStepDefaults(product.branch),
      formFields: hasFormFields ? product.formFields : defaultFormFields(product.branch),
    };
  }
  async upsertConfig(productId: string, dto: UpsertEmissionConfigDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.flowStepConfig.deleteMany({ where: { productId } });
      await tx.formField.deleteMany({ where: { productId } });

      await tx.flowStepConfig.createMany({        data: dto.flowSteps.map((s, i) => ({
          productId,
          stepKey: s.stepKey,
          label: s.label,
          shortLabel: s.shortLabel ?? s.label.split(' ').slice(-1)[0],
          description: s.description ?? '',
          enabled: s.enabled ?? true,
          formEnabled: s.formEnabled ?? true,
          sortOrder: s.sortOrder ?? i,
        })),
      });

      if (dto.formFields.length) {
        await tx.formField.createMany({
          data: dto.formFields.map((f, i) => ({
            productId,
            label: f.label,
            fieldType: f.fieldType,
            required: f.required ?? true,
            options: f.options ?? undefined,
            sortOrder: f.sortOrder ?? i,
            stepKey: f.stepKey ?? 'RISK_DATA',
          })),
        });
      }

      return this.getConfig(productId);
    });
  }
}