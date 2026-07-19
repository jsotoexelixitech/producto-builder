import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { LegalService } from './legal.service';
import { UpsertLegalBundleDto } from './dto/legal.dto';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Controller('products/:productId/legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get()
  get(@Param('productId') productId: string) {
    return this.legalService.getBundle(productId);
  }

  @Put()
  @UseGuards(ProductMutableGuard)
  upsert(
    @Param('productId') productId: string,
    @Body() dto: UpsertLegalBundleDto,
  ) {
    return this.legalService.upsertBundle(productId, dto);
  }
}
