import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { calculateCommercialPremium } from '@ipb/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertActuarialDto } from './dto/actuarial.dto';

@Injectable()
export class ActuarialService {
  constructor(private readonly prisma: PrismaService) {}

  async get(productId: string) {
    const data = await this.prisma.actuarialData.findUnique({
      where: { productId },
      include: { ratingVariables: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!data) throw new NotFoundException('Datos actuariales no configurados');
    return data;
  }

  async upsert(productId: string, dto: UpsertActuarialDto) {
    await this.ensureProduct(productId);

    const loadSum =
      dto.administrativeExpenses + dto.commissions + dto.profitMargin;
    if (loadSum >= 100) {
      throw new BadRequestException(
        'La suma de gastos + comisiones + utilidad debe ser < 100%',
      );
    }

    const commercialPremium = calculateCommercialPremium(
      dto.purePremium,
      dto.administrativeExpenses,
      dto.commissions,
      dto.profitMargin,
    );

    const { ratingVariables, ...actuarialFields } = dto;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const actuarial = await tx.actuarialData.upsert({
        where: { productId },
        create: {
          productId,
          ...actuarialFields,
          commercialPremium: new Prisma.Decimal(commercialPremium),
        },
        update: {
          ...actuarialFields,
          commercialPremium: new Prisma.Decimal(commercialPremium),
        },
      });

      if (ratingVariables) {
        await tx.ratingVariable.deleteMany({
          where: { actuarialDataId: actuarial.id },
        });
        if (ratingVariables.length > 0) {
          await tx.ratingVariable.createMany({
            data: ratingVariables.map((v, i) => ({
              actuarialDataId: actuarial.id,
              name: v.name,
              label: v.label,
              variableType: v.variableType,
              required: v.required ?? true,
              sortOrder: v.sortOrder ?? i,
              options: v.options ?? undefined,
            })),
          });
        }
      }

      return tx.actuarialData.findUnique({
        where: { id: actuarial.id },
        include: { ratingVariables: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  private async ensureProduct(productId: string) {
    const exists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Producto no encontrado');
  }
}
