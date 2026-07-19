import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductMutableGuard],
  exports: [ProductsService],
})
export class ProductsModule {}
