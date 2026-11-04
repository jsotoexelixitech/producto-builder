import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CoberturaSumaService } from './cobertura-suma.service';
import {
  CoberturaSumaParamDto,
  CoberturaSumaRamoParamDto,
  UpsertCoberturaSumaDto,
} from './dto/cobertura-suma.dto';

/** Suma asegurada por cobertura Sis2000 (FIJA o CALCULADA al emitir). Datos propios del configurador (Postgres). */
@Controller('core/sis2000/suma-config')
export class CoberturaSumaController {
  constructor(private readonly service: CoberturaSumaService) {}

  @Get(':cramo')
  listByRamo(@Param() params: CoberturaSumaRamoParamDto) {
    return this.service.listByRamo(params.cramo);
  }

  @Get(':cramo/:ccobertura')
  get(@Param() params: CoberturaSumaParamDto) {
    return this.service.get(params.cramo, params.ccobertura);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put(':cramo/:ccobertura')
  upsert(@Param() params: CoberturaSumaParamDto, @Body() dto: UpsertCoberturaSumaDto) {
    return this.service.upsert(params.cramo, params.ccobertura, dto);
  }
}
