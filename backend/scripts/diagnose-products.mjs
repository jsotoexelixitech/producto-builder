import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const steps = [
  { name: 'Product (sin relaciones)', run: () => prisma.product.findMany({ take: 3 }) },
  {
    name: '+ coverages',
    run: () =>
      prisma.product.findMany({
        take: 3,
        include: { coverages: { orderBy: { sortOrder: 'asc' } } },
      }),
  },
  {
    name: '+ productPlans',
    run: () =>
      prisma.product.findMany({
        take: 3,
        include: {
          coverages: { orderBy: { sortOrder: 'asc' } },
          productPlans: { orderBy: { sortOrder: 'asc' } },
        },
      }),
  },
  {
    name: '+ requiredDocuments',
    run: () =>
      prisma.product.findMany({
        take: 3,
        include: {
          coverages: { orderBy: { sortOrder: 'asc' } },
          productPlans: { orderBy: { sortOrder: 'asc' } },
          requiredDocuments: { orderBy: { sortOrder: 'asc' } },
        },
      }),
  },
  {
    name: '+ actuarialData',
    run: () =>
      prisma.product.findMany({
        take: 3,
        include: {
          coverages: { orderBy: { sortOrder: 'asc' } },
          productPlans: { orderBy: { sortOrder: 'asc' } },
          requiredDocuments: { orderBy: { sortOrder: 'asc' } },
          actuarialData: true,
        },
      }),
  },
  {
    name: '+ sisipConfig',
    run: () =>
      prisma.product.findMany({
        take: 3,
        include: {
          coverages: { orderBy: { sortOrder: 'asc' } },
          productPlans: { orderBy: { sortOrder: 'asc' } },
          requiredDocuments: { orderBy: { sortOrder: 'asc' } },
          actuarialData: true,
          sisipConfig: true,
        },
      }),
  },
  {
    name: 'findAll completo (API)',
    run: () =>
      prisma.product.findMany({
        include: {
          coverages: { orderBy: { sortOrder: 'asc' } },
          productPlans: { orderBy: { sortOrder: 'asc' } },
          requiredDocuments: { orderBy: { sortOrder: 'asc' } },
          flowStepConfigs: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { exclusions: true, stateHistory: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
  },
];

let failed = false;

for (const step of steps) {
  try {
    const result = await step.run();
    const count = Array.isArray(result) ? result.length : 1;
    console.log(`OK  ${step.name} (${count} filas)`);
  } catch (err) {
    failed = true;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${step.name}`);
    console.error(message);
    break;
  }
}

await prisma.$disconnect();
process.exit(failed ? 1 : 0);
