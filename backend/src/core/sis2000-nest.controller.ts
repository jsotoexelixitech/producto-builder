import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUserPayload } from '../auth/auth.service';
import { CoreService } from './core.service';
import {
  Sis2000CoberturaParamDto,
  Sis2000PlanCotizarDto,
  Sis2000PlanFrecuenciasDto,
  Sis2000RamoParamDto,
  Sis2000TarifaParamDto,
} from './dto/sis2000-nest.dto';
import { contextoCambio, separarMotivo } from './respaldo/contexto';

type Cuerpo = Record<string, unknown>;

/**
 * Proxy nest-api → sis2000_qa (coberturas, tarifas, catálogos, planes maestro). Escribir: PRODUCT_MANAGER o ADMIN.
 * Toda escritura guarda antes lo que había en Sis2000 (historial del configurador); `motivoCambio` en el cuerpo es
 * opcional y no se envía a nest-api.
 */
@Controller('core/sis2000')
export class Sis2000NestController {
  constructor(private readonly coreService: CoreService) {}

  // ── Catálogos auxiliares → combos en formularios ─────────────────────────

  @Get('funciones')
  funciones() {
    return this.coreService.getSis2000Funciones();
  }

  /** Ramos de Sis2000 (maramos) para el selector de ramo. */
  @Get('ramos')
  listRamos() {
    return this.coreService.listSis2000Ramos();
  }

  /** Alta de producto en un ramo (sp_CrearProducto); bandera SIS2000_PRODUCTO_ESCRITURA. */
  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('productos')
  crearProducto(@Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.crearSis2000Producto(cuerpo, contextoCambio(user, motivo));
  }

  @Get('catalogos/productores')
  listProductores(@Query('q') q?: string) {
    return this.coreService.listSis2000Productores(q ?? '');
  }

  @Get('catalogos/canales')
  listCanales(@Query('q') q?: string) {
    return this.coreService.listSis2000Canales(q ?? '');
  }

  @Get('catalogos/proveedores')
  listProveedores(@Query('q') q?: string) {
    return this.coreService.listSis2000Proveedores(q ?? '');
  }

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
  createCobertura(@Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.createSis2000Cobertura(cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('coberturas/:cramo/:ccobertura')
  updateCobertura(
    @Param() params: Sis2000CoberturaParamDto,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.updateSis2000Cobertura(
      String(params.cramo),
      params.ccobertura,
      cuerpo,
      contextoCambio(user, motivo),
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
  createTarifa(@Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.createSis2000Tarifa(cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('tarifas/detalles')
  createTarifaDetalle(@Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.createSis2000TarifaDetalle(cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('tarifas/:cramo/:ccobertura/:ctarifa')
  updateTarifa(
    @Param() params: Sis2000TarifaParamDto,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.updateSis2000Tarifa(
      String(params.cramo),
      params.ccobertura,
      params.ctarifa,
      cuerpo,
      contextoCambio(user, motivo),
    );
  }

  // ── Tablas de tasas por edad (mapltabedad): el código es el ctablatar de los planes de personas ──

  @Get('tablas-edad')
  buscarTablasEdad(@Query('q') q?: string) {
    return this.coreService.buscarSis2000TablasEdad(q ?? '');
  }

  @Get('catalogos/parentescos')
  listParentescos() {
    return this.coreService.listSis2000Parentescos();
  }

  @Get('tablas-edad/:codigo')
  leerTablaEdad(@Param('codigo') codigo: string) {
    return this.coreService.leerSis2000TablaEdad(codigo);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('tablas-edad')
  crearTablaEdad(@Body() body: Cuerpo) {
    return this.coreService.crearSis2000TablaEdad(separarMotivo(body).cuerpo);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('tablas-edad/:codigo/tramos')
  reemplazarTramosEdad(@Param('codigo') codigo: string, @Body() body: Cuerpo) {
    return this.coreService.reemplazarSis2000TramosEdad(codigo, separarMotivo(body).cuerpo);
  }

  // ── Planes maestro (partner/starter/plan → spMantPlanes) ────────────────

  @Get('plans/master')
  listMasterPlans() {
    return this.coreService.listSis2000MasterPlans();
  }

  /** Plan completo tal como está en Sis2000 (incluye productores y canales de mausuplan). */
  @Get('plans/:id/sis2000')
  leerPlan(@Param('id') id: string) {
    return this.coreService.leerSis2000Plan(id);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans')
  createMasterPlan(@Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.createSis2000MasterPlan(cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('plans/:id')
  updateMasterPlan(
    @Param('id') id: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.updateSis2000MasterPlan(id, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Delete('plans/:id')
  deleteMasterPlan(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Query('motivo') motivo?: string,
  ) {
    // Borrar planes en Sis2000 no está permitido (spMantPlanes borra datos).
    void id;
    void user;
    void motivo;
    throw new ForbiddenException('Borrar planes en Sis2000 no está permitido desde el configurador.');
  }

  /** Cotiza un plan de cosas recién creado (solo lectura: no emite). */
  @Post('plans/cotizar')
  cotizarPlan(@Body() dto: Sis2000PlanCotizarDto) {
    return this.coreService.cotizarSis2000Plan(dto.cramo, dto.cplan, dto.ifrecuencia);
  }

  /** Auxiliar: frecuencias valrep para armar CreatePlanDto.frecuencias. */
  @Post('plans/frecuencias')
  listPlanFrecuencias(@Body() dto: Sis2000PlanFrecuenciasDto) {
    return this.coreService.listSis2000PlanFrecuencias(dto.cplan, dto.cramo);
  }

  // ── Proveedores del plan (maplprov_per): por plan, aplica a todas sus coberturas ──

  @Get('plans/:id/proveedores')
  listPlanProveedores(@Param('id') id: string) {
    return this.coreService.listSis2000PlanProveedores(id);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/proveedores')
  agregarPlanProveedor(
    @Param('id') id: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.agregarSis2000ProveedorPlan(id, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Patch('plans/:id/proveedores')
  editarPlanProveedor(
    @Param('id') id: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.editarSis2000ProveedorPlan(id, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/proveedores/baja')
  bajaPlanProveedor(
    @Param('id') id: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.coreService.bajaSis2000ProveedorPlan(id, cuerpo, contextoCambio(user, motivo));
  }

  // ── Tipo de emisión «Cobro por días» (prima diaria × días); bandera SIS2000_PLAN_COBRO_DIAS ──

  @Get('plans/:id/cobro-dias')
  leerCobroDias(@Param('id') id: string) {
    return this.coreService.leerSis2000CobroDias(id);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('plans/:id/cobro-dias')
  guardarCobroDias(@Param('id') id: string, @Body() body: Cuerpo) {
    return this.coreService.guardarSis2000CobroDias(id, separarMotivo(body).cuerpo);
  }

  /** Simulación (solo lectura: no emite). */
  @Post('plans/:id/cobro-dias/cotizar')
  cotizarCobroDias(@Param('id') id: string, @Body() body: Cuerpo) {
    return this.coreService.cotizarSis2000CobroDias(id, body);
  }
}
