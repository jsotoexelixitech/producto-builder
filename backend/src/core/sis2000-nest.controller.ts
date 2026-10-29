import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CoreService } from './core.service';
import {
  Sis2000CoberturaParamDto,
  Sis2000PlanFrecuenciasDto,
  Sis2000RamoParamDto,
  Sis2000TarifaParamDto,
} from './dto/sis2000-nest.dto';

/** Proxy nest-api → sis2000_qa (coberturas, tarifas, catálogos, planes maestro). Escribir: PRODUCT_MANAGER o ADMIN. */
@Controller('core/sis2000')
export class Sis2000NestController {
  constructor(private readonly coreService: CoreService) {}

  // ── Catálogos auxiliares → combos en formularios ─────────────────────────

  @Get('catalogos/monedas')
  listMonedas() {
    return this.coreService.listSis2000CatalogMonedas();
  }

  @Get('catalogos/ramos-internos')
  listRamosInternos() {
    return this.coreService.listSis2000CatalogRamosInternos();
  }

  @Get('catalogos/coberturas-internas')
  listCoberturasInternas() {
    return this.coreService.listSis2000CatalogCoberturasInternas();
  }

  @Get('catalogos/tarifas-internas')
  listTarifasInternas() {
    return this.coreService.listSis2000CatalogTarifasInternas();
  }

  @Get('catalogos/contratos-reaseguro')
  listContratosReaseguro() {
    return this.coreService.listSis2000CatalogContratosReaseguro();
  }

  @Get('catalogos/ramos-reaseguro')
  listRamosReaseguro() {
    return this.coreService.listSis2000CatalogRamosReaseguro();
  }

  // ── Coberturas maestro (macoberturas) ────────────────────────────────────

  @Get('coberturas/definicion')
  coberturasDefinicion() {
    return this.coreService.getSis2000CoberturasDefinicion();
  }

  @Get('coberturas/:cramo')
  listCoberturas(@Param() params: Sis2000RamoParamDto) {
    return this.coreService.listSis2000CoberturasByRamo(String(params.cramo));
  }

  @Get('coberturas/:cramo/:ccobertura')
  getCobertura(@Param() params: Sis2000CoberturaParamDto) {
    return this.coreService.getSis2000Cobertura(
      String(params.cramo),
      params.ccobertura,
    );
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('coberturas')
  createCobertura(@Body() body: Record<string, unknown>) {
    return this.coreService.createSis2000Cobertura(body);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('coberturas/:cramo/:ccobertura')
  updateCobertura(
    @Param() params: Sis2000CoberturaParamDto,
    @Body() body: Record<string, unknown>,
  ) {
    return this.coreService.updateSis2000Cobertura(
      String(params.cramo),
      params.ccobertura,
      body,
    );
  }

  // ── Tarifas (matarifa / matarifa_d) ──────────────────────────────────────

  @Get('tarifas/definicion')
  tarifasDefinicion() {
    return this.coreService.getSis2000TarifasDefinicion();
  }

  @Get('tarifas/detalles/definicion')
  tarifasDetalleDefinicion() {
    return this.coreService.getSis2000TarifasDetalleDefinicion();
  }

  @Get('tarifas/:cramo/:ccobertura')
  listTarifas(@Param() params: Sis2000CoberturaParamDto) {
    return this.coreService.listSis2000TarifasByRamoCobertura(
      String(params.cramo),
      params.ccobertura,
    );
  }

  @Get('tarifas/:cramo/:ccobertura/:ctarifa/detalles')
  tarifaDetalleHistorico(@Param() params: Sis2000TarifaParamDto) {
    return this.coreService.listSis2000TarifaDetalleHistorico(
      String(params.cramo),
      params.ccobertura,
      params.ctarifa,
    );
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('tarifas')
  createTarifa(@Body() body: Record<string, unknown>) {
    return this.coreService.createSis2000Tarifa(body);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('tarifas/detalles')
  createTarifaDetalle(@Body() body: Record<string, unknown>) {
    return this.coreService.createSis2000TarifaDetalle(body);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('tarifas/:cramo/:ccobertura/:ctarifa')
  updateTarifa(
    @Param() params: Sis2000TarifaParamDto,
    @Body() body: Record<string, unknown>,
  ) {
    return this.coreService.updateSis2000Tarifa(
      String(params.cramo),
      params.ccobertura,
      params.ctarifa,
      body,
    );
  }

  // ── Planes maestro (partner/starter/plan → spMantPlanes) ────────────────

  @Get('plans/master')
  listMasterPlans() {
    return this.coreService.listSis2000MasterPlans();
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans')
  createMasterPlan(@Body() body: Record<string, unknown>) {
    return this.coreService.createSis2000MasterPlan(body);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('plans/:id')
  updateMasterPlan(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.coreService.updateSis2000MasterPlan(id, body);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Delete('plans/:id')
  deleteMasterPlan(@Param('id') id: string) {
    return this.coreService.deleteSis2000MasterPlan(id);
  }

  /** Auxiliar: frecuencias valrep para armar CreatePlanDto.frecuencias. */
  @Post('plans/frecuencias')
  listPlanFrecuencias(@Body() dto: Sis2000PlanFrecuenciasDto) {
    return this.coreService.listSis2000PlanFrecuencias(dto.cplan, dto.cramo);
  }
}
