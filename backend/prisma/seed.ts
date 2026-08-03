import * as bcrypt from 'bcrypt';
import {
  PrismaClient,
  ProductBranch,
  ProductStatus,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@local.test' },
    update: {},
    create: {
      email: 'admin@local.test',
      passwordHash: adminPassword,
      fullName: 'Administrador',
      role: UserRole.ADMIN,
    },
  });

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

  console.log('Seed OK:', {
    admin: 'admin@local.test / admin123',
    productId: product.id,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
