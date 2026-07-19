import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductBranch } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertLegalBundleDto } from './dto/legal.dto';

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  async getBundle(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        exclusions: { orderBy: { sortOrder: 'asc' } },
        legalDocuments: true,
        commercialChannels: true,
        requiredDocuments: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async upsertBundle(productId: string, dto: UpsertLegalBundleDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const generalDoc = dto.documents.find(
      (d) => d.documentType === 'CONDICIONES_GENERALES',
    );
    if (
      product.lockedGeneralConditions &&
      generalDoc &&
      !generalDoc.isLocked
    ) {
      throw new ForbiddenException(
        'RCV_OBLIGATORIO: las Condiciones Generales están bloqueadas. Personalice solo vía Anexos.',
      );
    }

    if (dto.exclusions.some((e) => !e.typographyHighlight)) {
      throw new BadRequestException(
        'Reglamento Art. 68: todas las exclusiones deben tener resalte tipográfico activo.',
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.exclusion.deleteMany({ where: { productId } });
      await tx.legalDocument.deleteMany({ where: { productId } });
      await tx.commercialChannel.deleteMany({ where: { productId } });
      await tx.requiredDocument.deleteMany({ where: { productId } });

      await tx.exclusion.createMany({
        data: dto.exclusions.map((e, i) => ({
          productId,
          text: e.text,
          sortOrder: e.sortOrder ?? i,
          typographyHighlight: e.typographyHighlight ?? true,
        })),
      });

      await tx.legalDocument.createMany({
        data: dto.documents.map((d) => ({
          productId,
          documentType: d.documentType,
          title: d.title,
          content: d.content,
          isLocked:
            d.isLocked ??
            (product.branch === ProductBranch.RCV_OBLIGATORIO &&
              d.documentType === 'CONDICIONES_GENERALES'),
          isSimplifiedTemplate: d.isSimplifiedTemplate ?? product.simplifiedContract,
        })),
      });

      if (dto.commercialChannels?.length) {
        await tx.commercialChannel.createMany({
          data: dto.commercialChannels.map((c) => ({
            productId,
            name: c.name,
            channelType: c.channelType,
          })),
        });
      }

      if (dto.requiredDocuments?.length) {
        await tx.requiredDocument.createMany({
          data: dto.requiredDocuments.map((d, i) => ({
            productId,
            documentKey: d.documentKey,
            label: d.label,
            required: d.required ?? true,
            sortOrder: d.sortOrder ?? i,
          })),
        });
      }

      return this.getBundle(productId);
    });
  }
}
