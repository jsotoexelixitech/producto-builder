import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SisipService } from './sisip.service';
import { UpsertSisipConfigDto } from './dto/sisip.dto';

@Controller('products/:productId/sisip')
export class SisipController {
  constructor(private readonly sisipService: SisipService) {}

  @Get()
  get(@Param('productId') productId: string) {
    return this.sisipService.get(productId);
  }

  @Put()
  upsert(
    @Param('productId') productId: string,
    @Body() dto: UpsertSisipConfigDto,
  ) {
    return this.sisipService.upsert(productId, dto);
  }
}
