import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductBranch } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductPlanDto } from './dto/product-plan.dto';

function defaultPlansForBranch(branch: ProductBranch) {
  const plans = [
    { name: 'Plan Básico', badge: 'Esencial', priceFactor: 0.85, isRecommended: false, sortOrder: 0 },
    { name: 'Plan Estándar', badge: 'Recomendado', priceFactor: 1, isRecommended: true, sortOrder: 1 },
    { name: 'Plan Premium', badge: 'Completo', priceFactor: 1.15, isRecommended: false, sortOrder: 2 },
  ];
  if (branch === 'RCV_OBLIGATORIO') {
    return [plans[0]];
  }
  return plans;
}

@Injectable()
export class ProductPlansService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveCoverageLabels(
    coverageIds: string[] | undefined,
    coverages: { id: string; name: string }[],
  ): string[] {
    if (!coverageIds?.length) return [];
    const byId = new Map(coverages.map((c) => [c.id, c.name]));
    return coverageIds.map((id) => byId.get(id)).filter((n): n is string => !!n);
  }

  async getPlans(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        productPlans: { orderBy: { sortOrder: 'asc' } },
        coverages: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const hasPlans = product.productPlans.length > 0;
    const plans = hasPlans
      ? product.productPlans.map((p) => {
          const storedIds = (p.coverageIds as string[] | null) ?? [];
          const validIds = storedIds.filter((id) =>
            product.coverages.some((c) => c.id === id),
          );
          const labelsFromNames = (p.coverageLabels as string[] | null) ?? [];
          const remappedIds = validIds.length
            ? validIds
            : labelsFromNames
                .map((name) => product.coverages.find((c) => c.name === name)?.id)
                .filter((id): id is string => !!id);

          return {
            name: p.name,
            description: p.description,
            badge: p.badge,
            priceFactor: Number(p.priceFactor),
            isRecommended: p.isRecommended,
            coverageIds: remappedIds,
            coverageLabels: remappedIds.length
              ? remappedIds
                  .map((id) => product.coverages.find((c) => c.id === id)?.name)
                  .filter((n): n is string => !!n)
              : labelsFromNames,
            sortOrder: p.sortOrder,
          };
        })
      : defaultPlansForBranch(product.branch).map((p) => ({
          ...p,
          description: 'Plan comercial configurable',
          coverageIds: product.coverages.slice(0, 3).map((c) => c.id),
          coverageLabels: product.coverages.slice(0, 3).map((c) => c.name),
        }));

    return {
      productId,
      branch: product.branch,
      coverages: product.coverages.map((c) => ({ id: c.id, name: c.name })),
      plans,
    };
  }

  async upsertPlans(productId: string, plans: ProductPlanDto[]) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { coverages: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const coverageIds = new Set(product.coverages.map((c) => c.id));

    const sanitizedPlans = plans.map((plan) => ({
      ...plan,
      coverageIds: (plan.coverageIds ?? []).filter((id) => coverageIds.has(id)),
    }));

    for (const plan of sanitizedPlans) {
      for (const id of plan.coverageIds ?? []) {
        if (!coverageIds.has(id)) {
          throw new BadRequestException(
            `La cobertura ${id} no pertenece a este producto.`,
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.productPlan.deleteMany({ where: { productId } });

      if (sanitizedPlans.length) {
        await tx.productPlan.createMany({
          data: sanitizedPlans.map((p, i) => ({
            productId,
            name: p.name,
            description: p.description ?? null,
            badge: p.badge ?? null,
            priceFactor: p.priceFactor ?? 1,
            isRecommended: p.isRecommended ?? false,
            coverageIds: p.coverageIds ?? [],
            coverageLabels: this.resolveCoverageLabels(
              p.coverageIds,
              product.coverages,
            ),
            sortOrder: p.sortOrder ?? i,
          })),
        });
      }

      return this.getPlans(productId);
    });
  }
}
