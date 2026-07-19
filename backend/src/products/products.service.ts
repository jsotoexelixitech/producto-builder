import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProductBranch,
  ProductStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

const UNIFORM_BRANCHES: ProductBranch[] = [
  ProductBranch.RCV_OBLIGATORIO,
  ProductBranch.INCLUSIVO,
];

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({
      include: {
        coverages: { orderBy: { sortOrder: 'asc' } },
        actuarialData: true,
        sisipConfig: true,
        _count: { select: { exclusions: true, stateHistory: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        coverages: { orderBy: { sortOrder: 'asc' } },
        actuarialData: { include: { ratingVariables: { orderBy: { sortOrder: 'asc' } } } },
        exclusions: { orderBy: { sortOrder: 'asc' } },
        legalDocuments: true,
        commercialChannels: true,
        formFields: { orderBy: { sortOrder: 'asc' } },
        requiredDocuments: { orderBy: { sortOrder: 'asc' } },
        productPlans: { orderBy: { sortOrder: 'asc' } },
        flowStepConfigs: { orderBy: { sortOrder: 'asc' } },
        stateHistory: { orderBy: { changedAt: 'desc' } },
        sisipConfig: true,
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async create(dto: CreateProductDto) {
    const isUniform = UNIFORM_BRANCHES.includes(dto.branch);
    const { vigenciaInicio, vigenciaFin, ...rest } = dto;
    return this.prisma.product.create({
      data: {
        ...rest,
        vigenciaInicio: this.parseDate(vigenciaInicio),
        vigenciaFin: this.parseDate(vigenciaFin),
        simplifiedContract: isUniform,
        uniformConditions: isUniform,
        lockedGeneralConditions:
          dto.branch === ProductBranch.RCV_OBLIGATORIO,
        stateHistory: {
          create: {
            toStatus: ProductStatus.DRAFT,
            comment: 'Producto creado',
          },
        },
      },
      include: { coverages: true, actuarialData: true, sisipConfig: true },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    const data = this.mapPlanFields(dto);
    return this.prisma.product.update({
      where: { id },
      data,
      include: { coverages: true, actuarialData: true, sisipConfig: true },
    });
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    if (
      product.status === ProductStatus.SUBMITTED_TO_SUDEASEG ||
      product.status === ProductStatus.APPROVED_ACTIVE
    ) {
      throw new BadRequestException(
        'No se puede eliminar un producto enviado o aprobado por SUDEASEG.',
      );
    }
    return this.prisma.product.delete({ where: { id } });
  }

  private mapPlanFields(dto: UpdateProductDto): Prisma.ProductUpdateInput {
    const data: Prisma.ProductUpdateInput = {};
    if (dto.commercialName != null) data.commercialName = dto.commercialName;
    if (dto.currency != null) data.currency = dto.currency;
    if (dto.emissionType != null) data.emissionType = dto.emissionType;
    if (dto.subPlanCode !== undefined) data.subPlanCode = dto.subPlanCode || null;
    if (dto.allowsQuickEmission !== undefined) data.allowsQuickEmission = dto.allowsQuickEmission;
    if (dto.renewalFrequency !== undefined) data.renewalFrequency = dto.renewalFrequency;
    if (dto.renewalType !== undefined) data.renewalType = dto.renewalType;
    if (dto.premiumGuaranteeDays !== undefined) data.premiumGuaranteeDays = dto.premiumGuaranteeDays;
    if (dto.annualClosingMonth !== undefined) data.annualClosingMonth = dto.annualClosingMonth;
    if (dto.vigenciaInicio !== undefined) data.vigenciaInicio = this.parseDate(dto.vigenciaInicio);
    if (dto.vigenciaFin !== undefined) data.vigenciaFin = this.parseDate(dto.vigenciaFin);
    return data;
  }

  private parseDate(value?: string | null) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
