import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductBranch } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductPlanDto } from './dto/product-plan.dto';



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

    const plans = product.productPlans.map((p) => {
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
        assignedChannel: p.assignedChannel,
        coverageIds: remappedIds,
        coverageLabels: remappedIds.length
          ? remappedIds
              .map((id) => product.coverages.find((c) => c.id === id)?.name)
              .filter((n): n is string => !!n)
          : labelsFromNames,
        sortOrder: p.sortOrder,
      };
    });

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

    const sanitizedPlans = plans.map((plan) => {
      const priceFactor = Number(plan.priceFactor ?? 1);
      if (!Number.isFinite(priceFactor) || priceFactor < 0) {
        throw new BadRequestException(
          `El plan "${plan.name}" tiene una prima/factor inválido (${plan.priceFactor}).`,
        );
      }
      if (priceFactor >= 1e14) {
        throw new BadRequestException(
          `El plan "${plan.name}" tiene una prima demasiado grande (${priceFactor}). Revisa las tarifas de coberturas.`,
        );
      }
      return {
        ...plan,
        priceFactor,
        coverageIds: (plan.coverageIds ?? []).filter((id) => coverageIds.has(id)),
      };
    });

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
            priceFactor: p.priceFactor,
            isRecommended: p.isRecommended ?? false,
            assignedChannel: p.assignedChannel ?? null,
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
