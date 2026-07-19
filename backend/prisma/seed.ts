import { PrismaClient, ProductBranch, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.upsert({
    where: { internalCode: 'RCV-DEMO-001' },
    update: {},
    create: {
      commercialName: 'RCV Obligatorio Demo',
      internalCode: 'RCV-DEMO-001',
      branch: ProductBranch.RCV_OBLIGATORIO,
      currency: 'VES',
      emissionType: 'EMISION_GARANTIZADA',
      status: ProductStatus.DRAFT,
      simplifiedContract: true,
      uniformConditions: true,
      lockedGeneralConditions: true,
      stateHistory: {
        create: { toStatus: ProductStatus.DRAFT, comment: 'Seed inicial' },
      },
      coverages: {
        create: [
          {
            name: 'Daños a Terceros',
            isBasicMandatory: true,
            insuredSumFixed: 50000,
            deductibleType: 'MONTO_FIJO',
            deductibleValue: 0,
            sortOrder: 0,
          },
        ],
      },
      actuarialData: {
        create: {
          purePremium: 120,
          administrativeExpenses: 12,
          commissions: 8,
          profitMargin: 5,
          commercialPremium: 163.64,
          actuaryName: 'Act. María González',
          actuaryCedula: 'V-12345678',
          actuarySudeasegNumber: 'SUD-ACT-2024-001',
        },
      },
      exclusions: {
        create: [
          {
            text: 'SE EXCLUYE TODO SINIESTRO CAUSADO EN ESTADO DE EBRIEDAD O BAJO EFECTOS DE SUSTANCIAS PSICOACTIVAS.',
            typographyHighlight: true,
            sortOrder: 0,
          },
        ],
      },
      legalDocuments: {
        create: [
          {
            documentType: 'CONDICIONES_GENERALES',
            title: 'Condiciones Generales RCV',
            content: 'Texto uniforme bloqueado por SUDEASEG...',
            isLocked: true,
            isSimplifiedTemplate: true,
          },
        ],
      },
    },
  });

  console.log('Seed OK:', product.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
