import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductStatus } from '@prisma/client';

@Injectable()
export class ProductMutableGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const productId = request.params.productId ?? request.params.id;
    if (!productId) return true;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { isImmutable: true, status: true },
    });

    if (!product) return true;

    const immutable =
      product.isImmutable ||
      product.status === ProductStatus.SUBMITTED_TO_SUDEASEG ||
      product.status === ProductStatus.APPROVED_ACTIVE;

    if (immutable) {
      throw new ForbiddenException(
        'El producto está inmutable: no se pueden modificar tasas, coberturas ni textos en este estado.',
      );
    }
    return true;
  }
}
