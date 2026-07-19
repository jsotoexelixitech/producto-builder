import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSisipConfigDto } from './dto/sisip.dto';

@Injectable()
export class SisipService {
  constructor(private readonly prisma: PrismaService) {}

  async get(productId: string) {
    await this.ensureProduct(productId);
    return (
      (await this.prisma.productSisipConfig.findUnique({
        where: { productId },
      })) ?? this.defaultConfig()
    );
  }

  async upsert(productId: string, dto: UpsertSisipConfigDto) {
    await this.ensureProduct(productId);
    return this.prisma.productSisipConfig.upsert({
      where: { productId },
      create: { ...dto, productId },
      update: dto,
    });
  }

  private defaultConfig() {
    return {
      ramoInternoCode: null,
      ramoInternoName: null,
      branchAlias1: null,
      branchAlias2: null,
      producerCode: null,
      producerName: null,
      assignToAllProducers: false,
      counterCotizacion: 'COTIZACION',
      counterPoliza: 'POLIZA',
      counterRecibo: 'RECIBO',
      counterSiniestro: 'SINIESTRO',
      maskPoliza: null,
      maskRecibo: null,
      maskSiniestro: null,
    };
  }

  private async ensureProduct(productId: string) {
    const exists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Producto no encontrado');
  }
}
