import { Module } from '@nestjs/common';
import { ProductPlansController } from './product-plans.controller';
import { ProductPlansService } from './product-plans.service';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Module({
  controllers: [ProductPlansController],
  providers: [ProductPlansService, ProductMutableGuard],
})
export class ProductPlansModule {}
