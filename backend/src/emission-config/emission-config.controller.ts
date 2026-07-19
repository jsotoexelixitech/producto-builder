import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { EmissionConfigService } from './emission-config.service';
import { UpsertEmissionConfigDto } from './dto/emission-config.dto';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Controller('products/:productId/emission-config')
export class EmissionConfigController {
  constructor(private readonly emissionConfigService: EmissionConfigService) {}

  @Get()
  get(@Param('productId') productId: string) {
    return this.emissionConfigService.getConfig(productId);
  }

  @Put()
  @UseGuards(ProductMutableGuard)
  upsert(
    @Param('productId') productId: string,
    @Body() dto: UpsertEmissionConfigDto,
  ) {
    return this.emissionConfigService.upsertConfig(productId, dto);
  }
}
