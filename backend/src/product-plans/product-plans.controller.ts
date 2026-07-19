import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ProductPlansService } from './product-plans.service';
import { UpsertProductPlansDto } from './dto/product-plan.dto';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Controller('products/:productId/plans')
export class ProductPlansController {
  constructor(private readonly productPlansService: ProductPlansService) {}

  @Get()
  get(@Param('productId') productId: string) {
    return this.productPlansService.getPlans(productId);
  }

  @Put()
  @UseGuards(ProductMutableGuard)
  upsert(
    @Param('productId') productId: string,
    @Body() dto: UpsertProductPlansDto,
  ) {
    return this.productPlansService.upsertPlans(productId, dto.plans);
  }
}
