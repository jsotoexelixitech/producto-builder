import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ALLOWED_TRANSITIONS,
  validateSubmissionGuardrails,
} from '@ipb/shared';
import { ProductStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveProductDto, TransitionStatusDto } from '../products/dto/product.dto';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(productId: string, dto: TransitionStatusDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        coverages: true,
        exclusions: true,
        actuarialData: true,
        commercialChannels: true,
        legalDocuments: true,
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const allowed = ALLOWED_TRANSITIONS[product.status as ProductStatus] ?? [];
    if (!allowed.includes(dto.toStatus)) {
      throw new BadRequestException(
        `Transición inválida: ${product.status} → ${dto.toStatus}`,
      );
    }

    if (dto.toStatus === ProductStatus.SUBMITTED_TO_SUDEASEG) {
      this.assertSubmissionGuardrails(product);
    }

    const isImmutable =
      dto.toStatus === ProductStatus.SUBMITTED_TO_SUDEASEG ||
      dto.toStatus === ProductStatus.APPROVED_ACTIVE;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          status: dto.toStatus,
          isImmutable,
        },
      });

      await tx.productStateHistory.create({
        data: {
          productId,
          fromStatus: product.status,
          toStatus: dto.toStatus,
          comment: dto.comment,
        },
      });

      return updated;
    });
  }

  async approve(productId: string, dto: ApproveProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    if (product.status !== ProductStatus.SUBMITTED_TO_SUDEASEG) {
      throw new BadRequestException(
        'Solo productos en SUBMITTED_TO_SUDEASEG pueden activarse con providencia.',
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.APPROVED_ACTIVE,
          isImmutable: true,
          numeroProvidenciaSudeaseg: dto.numeroProvidenciaSudeaseg,
          fechaGacetaAprobacion: new Date(dto.fechaGacetaAprobacion),
        },
      });

      await tx.productStateHistory.create({
        data: {
          productId,
          fromStatus: ProductStatus.SUBMITTED_TO_SUDEASEG,
          toStatus: ProductStatus.APPROVED_ACTIVE,
          comment: `Providencia SUDEASEG: ${dto.numeroProvidenciaSudeaseg}`,
        },
      });

      return updated;
    });
  }

  async validateSubmission(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        coverages: true,
        exclusions: true,
        actuarialData: true,
        commercialChannels: true,
        legalDocuments: true,
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const violations = validateSubmissionGuardrails({
      branch: product.branch,
      actuarySudeasegNumber: product.actuarialData?.actuarySudeasegNumber,
      exclusions: product.exclusions,
      coverages: product.coverages,
      administrativeExpenses: Number(
        product.actuarialData?.administrativeExpenses ?? 0,
      ),
      commissions: Number(product.actuarialData?.commissions ?? 0),
      profitMargin: Number(product.actuarialData?.profitMargin ?? 0),
      commercialChannels: product.commercialChannels,
      hasSimplifiedTemplate: product.legalDocuments.some(
        (d) => d.isSimplifiedTemplate,
      ),
    });

    return { valid: violations.length === 0, violations };
  }

  private assertSubmissionGuardrails(product: {
    branch: import('@prisma/client').ProductBranch;
    actuarialData: {
      actuarySudeasegNumber: string;
      administrativeExpenses: import('@prisma/client').Prisma.Decimal;
      commissions: import('@prisma/client').Prisma.Decimal;
      profitMargin: import('@prisma/client').Prisma.Decimal;
    } | null;
    exclusions: Array<{ text: string; typographyHighlight: boolean }>;
    coverages: Array<{ isBasicMandatory: boolean }>;
    commercialChannels: Array<{ name: string }>;
    legalDocuments: Array<{ isSimplifiedTemplate: boolean }>;
  }) {
    const result = validateSubmissionGuardrails({
      branch: product.branch,
      actuarySudeasegNumber: product.actuarialData?.actuarySudeasegNumber,
      exclusions: product.exclusions,
      coverages: product.coverages,
      administrativeExpenses: Number(
        product.actuarialData?.administrativeExpenses ?? 0,
      ),
      commissions: Number(product.actuarialData?.commissions ?? 0),
      profitMargin: Number(product.actuarialData?.profitMargin ?? 0),
      commercialChannels: product.commercialChannels,
      hasSimplifiedTemplate: product.legalDocuments.some(
        (d) => d.isSimplifiedTemplate,
      ),
    });

    if (result.length > 0) {
      throw new BadRequestException({
        message: 'Guardrails SUDEASEG: no se puede enviar a revisión',
        violations: result,
      });
    }
  }
}
