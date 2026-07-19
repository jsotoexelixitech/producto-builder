import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ActuarialService } from './actuarial.service';
import { UpsertActuarialDto } from './dto/actuarial.dto';
import { ProductMutableGuard } from '../common/guards/product-mutable.guard';

@Controller('products/:productId/actuarial')
export class ActuarialController {
  constructor(private readonly actuarialService: ActuarialService) {}

  @Get()
  get(@Param('productId') productId: string) {
    return this.actuarialService.get(productId);
  }

  @Put()
  @UseGuards(ProductMutableGuard)
  upsert(
    @Param('productId') productId: string,
    @Body() dto: UpsertActuarialDto,
  ) {
    return this.actuarialService.upsert(productId, dto);
  }
}
