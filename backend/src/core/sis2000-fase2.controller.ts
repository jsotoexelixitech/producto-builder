import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUserPayload } from '../auth/auth.service';
import { ConfiguradorFase2Service } from './configurador-fase2.service';
import { contextoCambio, separarMotivo } from './respaldo/contexto';
import type { TipoDescRec } from '../partner-bridge/configurador-fase2.mapper';

type Cuerpo = Record<string, unknown>;

const tipoDescRec = (v: string): TipoDescRec => {
  if (v === 'dispositivos' || v === 'sustancias') return v;
  throw new BadRequestException('Usa «dispositivos» o «sustancias».');
};

/**
 * Configurador fase 2 «editar todo» (.antigravity/CONTRATO-CONFIGURADOR-FASE2.md): proxies 1:1 de nest-api
 * v1/configurador. Lectura para cualquier usuario del builder; escritura PRODUCT_MANAGER o ADMIN, siempre con respaldo
 * previo en el historial. `motivoCambio` del cuerpo (o `?motivo=` en el DELETE) queda en el historial y no va a nest-api.
 * Se registra antes que Sis2000NestController (rutas más largas primero, sin choques con las de la fase 1).
 */
@Controller('core/sis2000')
export class Sis2000Fase2Controller {
  constructor(private readonly fase2: ConfiguradorFase2Service) {}

  // ── Descuentos y recargos (madisseg / masustac) y condominio, por ramo ──

  @Get('ramos/:cramo/condominio/:tabla')
  leerCondominio(@Param('cramo') cramo: string, @Param('tabla') tabla: string) {
    return this.fase2.leerCondominio(cramo, tabla);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('ramos/:cramo/condominio/:tabla')
  guardarCondominio(
    @Param('cramo') cramo: string,
    @Param('tabla') tabla: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.guardarCondominio(cramo, tabla, cuerpo, contextoCambio(user, motivo));
  }

  @Get('ramos/:cramo/:tipo')
  listarDescRec(@Param('cramo') cramo: string, @Param('tipo') tipo: string) {
    return this.fase2.listarDescRec(cramo, tipoDescRec(tipo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('ramos/:cramo/:tipo')
  agregarDescRec(@Param('cramo') cramo: string, @Param('tipo') tipo: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.agregarDescRec(cramo, tipoDescRec(tipo), cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Patch('ramos/:cramo/:tipo/:codigo')
  editarDescRec(
    @Param('cramo') cramo: string,
    @Param('tipo') tipo: string,
    @Param('codigo') codigo: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.editarDescRec(cramo, tipoDescRec(tipo), codigo, cuerpo, contextoCambio(user, motivo));
  }

  // ── Producto (maproductos) ──

  @Get('productos/:cproducto')
  leerProducto(@Param('cproducto') cproducto: string) {
    return this.fase2.leerProducto(cproducto);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Patch('productos/:cproducto')
  editarProducto(@Param('cproducto') cproducto: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.editarProducto(cproducto, cuerpo, contextoCambio(user, motivo));
  }

  // ── Plan: cabecera ──

  @Roles(UserRole.PRODUCT_MANAGER)
  @Patch('plans/:id')
  editarCabecera(@Param('id') id: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.editarCabecera(id, cuerpo, contextoCambio(user, motivo));
  }

  // ── Frecuencias (maplanes_frec, maplanes_frec_produc) ──

  @Get('plans/:id/frecuencias')
  listarFrecuencias(@Param('id') id: string) {
    return this.fase2.listarFrecuencias(id);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/frecuencias')
  agregarFrecuencia(@Param('id') id: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.agregarFrecuencia(id, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Patch('plans/:id/frecuencias/:ifrecuencia')
  editarFrecuencia(
    @Param('id') id: string,
    @Param('ifrecuencia') ifrecuencia: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.editarFrecuencia(id, ifrecuencia, cuerpo, contextoCambio(user, motivo));
  }

  @Get('plans/:id/frecuencias-productor')
  listarFrecuenciasProductor(@Param('id') id: string) {
    return this.fase2.listarFrecuenciasProductor(id);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/frecuencias-productor')
  agregarFrecuenciaProductor(@Param('id') id: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.agregarFrecuenciaProductor(id, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Delete('plans/:id/frecuencias-productor/:cproductor/:ifrecuencia')
  borrarFrecuenciaProductor(
    @Param('id') id: string,
    @Param('cproductor') cproductor: string,
    @Param('ifrecuencia') ifrecuencia: string,
    @CurrentUser() user: AuthUserPayload,
    @Query('motivo') motivo?: string,
    @Query('ndias') ndias?: string,
  ) {
    return this.fase2.borrarFrecuenciaProductor(id, cproductor, ifrecuencia, ndias, contextoCambio(user, motivo));
  }

  // ── Quién vende (mausuplan) ──

  @Get('plans/:id/quien-vende/resumen')
  resumenQuienVende(@Param('id') id: string) {
    return this.fase2.resumenQuienVende(id);
  }

  @Get('plans/:id/quien-vende')
  listarQuienVende(@Param('id') id: string, @Query() query: Cuerpo) {
    return this.fase2.listarQuienVende(id, query ?? {});
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/quien-vende/baja')
  bajaQuienVende(@Param('id') id: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.bajaQuienVende(id, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/quien-vende')
  agregarQuienVende(@Param('id') id: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.agregarQuienVende(id, cuerpo, contextoCambio(user, motivo));
  }

  // ── Coberturas del plan: cosas y auto (maplancob + maplantar) ──

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/coberturas')
  agregarCoberturaPlan(@Param('id') id: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.agregarCoberturaPlan(id, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Patch('plans/:id/coberturas/:ccobertura/tarifas/:ctarifa')
  editarTarifaCoberturaPlan(
    @Param('id') id: string,
    @Param('ccobertura') ccobertura: string,
    @Param('ctarifa') ctarifa: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.editarTarifaCoberturaPlan(id, ccobertura, ctarifa, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/coberturas/:ccobertura/baja')
  bajaCoberturaPlan(
    @Param('id') id: string,
    @Param('ccobertura') ccobertura: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.bajaCoberturaPlan(id, ccobertura, cuerpo, contextoCambio(user, motivo));
  }

  // ── Coberturas del plan: personas (maplcober_per + mapltarifas_per) ──

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/coberturas-personas')
  agregarCoberturaPersonas(@Param('id') id: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.agregarCoberturaPersonas(id, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Patch('plans/:id/coberturas-personas/:ccobertura/tarifas/:ctarifa')
  editarCoberturaPersonas(
    @Param('id') id: string,
    @Param('ccobertura') ccobertura: string,
    @Param('ctarifa') ctarifa: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.editarCoberturaPersonas(id, ccobertura, ctarifa, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('plans/:id/coberturas-personas/:ccobertura/baja')
  bajaCoberturaPersonas(
    @Param('id') id: string,
    @Param('ccobertura') ccobertura: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.bajaCoberturaPersonas(id, ccobertura, cuerpo, contextoCambio(user, motivo));
  }

  // ── Personas: edades por parentesco (mapledades_per) ──

  @Get('plans/:id/edades')
  listarEdades(@Param('id') id: string) {
    return this.fase2.listarEdades(id);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('plans/:id/edades/:cparen')
  guardarEdad(@Param('id') id: string, @Param('cparen') cparen: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.guardarEdad(id, cparen, cuerpo, contextoCambio(user, motivo));
  }

  // ── Auto: tarifa por días (maplantar_dias) y tasa de casco (versiones de Sis2000) ──

  @Get('plans/:id/tarifa-dias')
  listarTarifaDias(@Param('id') id: string) {
    return this.fase2.listarTarifaDias(id);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Put('plans/:id/tarifa-dias/:ccober/:ctarifa')
  guardarTarifaDias(
    @Param('id') id: string,
    @Param('ccober') ccober: string,
    @Param('ctarifa') ctarifa: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.guardarTarifaDias(id, ccober, ctarifa, cuerpo, contextoCambio(user, motivo));
  }

  @Get('auto/:cramo/tasa-casco')
  leerTasaCasco(@Param('cramo') cramo: string) {
    return this.fase2.leerTasaCasco(cramo);
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('auto/:cramo/tasa-casco/versiones')
  crearVersionCasco(@Param('cramo') cramo: string, @Body() body: Cuerpo, @CurrentUser() user: AuthUserPayload) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.crearVersionCasco(cramo, cuerpo, contextoCambio(user, motivo ?? cuerpo.motivo));
  }

  @Get('auto/:cramo/tasa-casco/versiones')
  listarVersionesCasco(@Param('cramo') cramo: string, @Query('limit') limit?: string) {
    return this.fase2.listarVersionesCasco(cramo, limit);
  }

  /** Vista previa de un ajuste (no escribe). */
  @Post('auto/:cramo/tasa-casco/vista-previa')
  vistaPreviaCasco(@Param('cramo') cramo: string, @Body() body: Cuerpo) {
    return this.fase2.vistaPreviaCasco(cramo, separarMotivo(body).cuerpo);
  }

  /** Publicar = aprobar: exige un usuario de Sis2000 distinto del que propuso (doble control). */
  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('auto/:cramo/tasa-casco/versiones/:version/publicar')
  publicarVersionCasco(
    @Param('cramo') cramo: string,
    @Param('version') version: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.publicarVersionCasco(cramo, version, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('auto/:cramo/tasa-casco/versiones/:version/rechazar')
  rechazarVersionCasco(
    @Param('cramo') cramo: string,
    @Param('version') version: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.rechazarVersionCasco(cramo, version, cuerpo, contextoCambio(user, motivo));
  }

  @Roles(UserRole.PRODUCT_MANAGER)
  @Post('auto/:cramo/tasa-casco/versiones/:version/cancelar')
  cancelarVersionCasco(
    @Param('cramo') cramo: string,
    @Param('version') version: string,
    @Body() body: Cuerpo,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const { cuerpo, motivo } = separarMotivo(body);
    return this.fase2.cancelarVersionCasco(cramo, version, cuerpo, contextoCambio(user, motivo));
  }
}
