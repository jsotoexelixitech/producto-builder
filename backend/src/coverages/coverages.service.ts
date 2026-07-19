import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCoverageDto } from './dto/coverage.dto';

@Injectable()
export class CoveragesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(productId: string) {
    return this.prisma.coverage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(productId: string, dto: CreateCoverageDto) {
    await this.ensureProduct(productId);
    return this.prisma.coverage.create({
      data: this.mapCoverage(dto, productId),
    });
  }

  async replaceAll(productId: string, coverages: CreateCoverageDto[]) {
    await this.ensureProduct(productId);
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.coverage.deleteMany({ where: { productId } });
      if (coverages.length === 0) return [];
      await tx.coverage.createMany({
        data: coverages.map((c, i) => this.mapCoverage(c, productId, i)),
      });
      return tx.coverage.findMany({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
    });
  }

  async remove(productId: string, coverageId: string) {
    const coverage = await this.prisma.coverage.findFirst({
      where: { id: coverageId, productId },
    });
    if (!coverage) throw new NotFoundException('Cobertura no encontrada');
    return this.prisma.coverage.delete({ where: { id: coverageId } });
  }

  private mapCoverage(
    dto: CreateCoverageDto,
    productId: string,
    sortOrder?: number,
  ): Prisma.CoverageCreateManyInput {
    const { vigenciaDesde, vigenciaHasta, ...rest } = dto;
    return {
      ...rest,
      productId,
      sortOrder: dto.sortOrder ?? sortOrder ?? 0,
      vigenciaDesde: this.parseDate(vigenciaDesde),
      vigenciaHasta: this.parseDate(vigenciaHasta),
    };
  }

  private parseDate(value?: string | null) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private async ensureProduct(productId: string) {
    const exists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Producto no encontrado');
  }
}
