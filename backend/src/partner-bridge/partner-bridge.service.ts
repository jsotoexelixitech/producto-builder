import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  aBajaProveedorPlan,
  aCobroDias,
  aCotizarCobroDias,
  aCrearCobertura,
  aCrearDetalleTarifa,
  aCrearProducto,
  aCrearTarifa,
  aEditarCobertura,
  aEditarProveedorPlan,
  aEditarTarifa,
  aPlan,
  aProveedorPlan,
  partirPlanId,
} from './configurador.mapper';

/**
 * Canales alternos en planes (mausuplan centidad C). Apagado por defecto. Encendido, los canales elegidos se agregan
 * con v1/configurador/planes/:cramo/:cplan/canales (solo alta: nunca borra); spMantPlanes nunca recibe canales.
 */
export const canalesEnPlanHabilitado = () =>
  ['1', 'true', 'si', 'sí'].includes(String(process.env.SIS2000_PLAN_CANALES ?? '').trim().toLowerCase());

/**
 * Tipo de emisión «Cobro por días» (prima diaria × días). Apagado por defecto: sin la bandera el builder no lee ni
 * escribe v1/configurador/planes/:cramo/:cplan/cobro-dias y el front oculta la opción.
 */
export const cobroDiasHabilitado = () =>
  ['1', 'true', 'si', 'sí'].includes(String(process.env.SIS2000_PLAN_COBRO_DIAS ?? '').trim().toLowerCase());

/**
 * Alta de productos en Sis2000 desde «Combo de coberturas» (nest-api v1/configurador/productos → sp_CrearProducto).
 * Apagada por defecto; se enciende con SIS2000_PRODUCTO_ESCRITURA=1 (y CONFIGURADOR_PRODUCTOS_ESCRITURA=1 en nest-api).
 */
export const productoEscrituraHabilitada = () =>
  ['1', 'true', 'si', 'sí'].includes(String(process.env.SIS2000_PRODUCTO_ESCRITURA ?? '').trim().toLowerCase());

/** Plan con sus canales (lo que se respalda en el historial): aPlan + bandera de canales. */
export function cuerpoPlan(payload: Record<string, unknown>) {
  const body = aPlan(payload);
  return canalesEnPlanHabilitado() ? body : { ...body, all_canal: false, canales: [] as number[] };
}

/** Lo que recibe spMantPlanes: siempre sin canales (los canales van aparte y solo se agregan). */
export function cuerpoSpMantPlanes(payload: Record<string, unknown>) {
  return { ...aPlan(payload), all_canal: false, canales: [] as number[] };
}

/** Canales a agregar al plan (null si la bandera está apagada o no hay canales elegidos). */
export function canalesAAgregar(payload: Record<string, unknown>): { all_canal?: true; canales?: number[] } | null {
  if (!canalesEnPlanHabilitado()) return null;
  const { all_canal, canales } = aPlan(payload) as { all_canal?: boolean; canales?: number[] };
  if (all_canal === true) return { all_canal: true };
  return canales?.length ? { canales } : null;
}
import {
  inferBranchFromPartnerRow,
  PartnerProductPayload,
} from './partner-product.mapper';

interface NestEnvelope<T = unknown> {
  status?: boolean;
  message?: string;
  data?: T;
}

@Injectable()
export class PartnerBridgeService {
  private readonly logger = new Logger(PartnerBridgeService.name);
  private readonly nestBase: string;
  private readonly nestApiKey: string;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor() {
    this.nestBase = (
      process.env.NEST_API_URL ?? 'http://127.0.0.1:3002'
    ).replace(/\/$/, '');
    this.nestApiKey =
      process.env.NEST_API_KEY ?? process.env.NEST_ADMIN_TOKEN ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.nestApiKey);
  }

  async listProducts(): Promise<Array<Record<string, unknown>>> {
    const body = await this.request<NestEnvelope<Array<Record<string, unknown>>>>(
      'GET',
      '/api/v1/partner/products/list',
    );
    return Array.isArray(body.data) ? body.data : [];
  }

  async listCoreProductSummaries(branch?: string) {
    const rows = await this.listProducts();
    const mapped = rows.map((row) => ({
      coreCode: String(row.cproducto ?? ''),
      commercialName: String(row.xdescripcion_l ?? row.cproducto ?? ''),
      internalCode: String(row.xabreviatura ?? row.cproducto ?? ''),
      branch: inferBranchFromPartnerRow(row) ?? branch ?? 'PATRIMONIAL',
      subBranchCode: null as string | null,
      syncedAt: row.fingreso ? String(row.fingreso) : undefined,
      source: 'SIS2000',
      productId: null as string | null,
    }));
    if (branch) {
      return mapped.filter((row) => row.branch === branch);
    }
    return mapped;
  }

  async productExists(cproducto: string): Promise<boolean> {
    const url = `${this.nestBase}/api/v1/partner/products/detail/${encodeURIComponent(cproducto)}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: await this.authHeaders() });
    } catch (err) {
      this.logger.error(`nest-api partner detail unreachable: ${cproducto}`, err);
      throw new BadGatewayException(
        'No se pudo consultar el producto en nest-api partner.',
      );
    }
    if (res.status === 404) return false;
    if (!res.ok) {
      const parsed = (await res.json().catch(() => ({}))) as NestEnvelope;
      throw new BadGatewayException(
        parsed.message ?? `Error nest-api partner detail (${res.status})`,
      );
    }
    return true;
  }

  async getProductDetail(cproducto: string): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'GET',
      `/api/v1/partner/products/detail/${encodeURIComponent(cproducto)}`,
    );
    if (!body.data) {
      throw new BadGatewayException(`Producto Sis2000 ${cproducto} sin detalle.`);
    }
    return body.data;
  }

  async createProduct(payload: PartnerProductPayload): Promise<void> {
    await this.request('POST', '/api/v1/partner/products/create', payload);
  }

  async updateProduct(
    cproducto: string,
    payload: PartnerProductPayload,
  ): Promise<void> {
    const { cproducto: _ignored, ...body } = payload;
    await this.request(
      'PUT',
      `/api/v1/partner/products/update/${encodeURIComponent(cproducto)}`,
      body,
    );
  }

  /** Planes asociados a un cproducto — POST valrep/planes/producto (puede tardar ~70s en RCV). */
  async listProductPlans(
    cproducto: string,
    centidad: string,
    citem: string,
  ): Promise<{ plans: Record<string, unknown>[]; mensaje: string }> {
    try {
      const body = await this.request<
        NestEnvelope<{ plan?: Record<string, unknown>[]; mensaje?: string }>
      >(
        'POST',
        '/api/v1/valrep/planes/producto',
        { cproducto, centidad, citem },
        120_000,
      );
      const plans = Array.isArray(body.data?.plan) ? body.data!.plan! : [];
      return { plans, mensaje: String(body.data?.mensaje ?? '') };
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === 400) {
        const msg = this.httpExceptionMessage(err);
        if (this.isValrepEmptyPlansMessage(msg)) {
          return { plans: [], mensaje: msg };
        }
      }
      throw err;
    }
  }

  /** Detalle tarifario de un plan — POST valrep/planes/detalle. */
  async getPlanDetail(
    cramo: number,
    cplan: string,
  ): Promise<Record<string, unknown>[]> {
    const body = await this.request<
      NestEnvelope<{ plan?: Record<string, unknown>[] }>
    >('POST', '/api/v1/valrep/planes/detalle', { cramo, cplan }, 30_000);
    return Array.isArray(body.data?.plan) ? body.data!.plan! : [];
  }

  async syncProduct(payload: PartnerProductPayload): Promise<'created' | 'updated'> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'NEST_API_KEY no configurado (scope partner:products requerido).',
      );
    }
    const exists = await this.productExists(payload.cproducto);
    if (exists) {
      await this.updateProduct(payload.cproducto, payload);
      return 'updated';
    }
    await this.createProduct(payload);
    return 'created';
  }

  // ── nest-api catalog:sis2000 — catálogos auxiliares ───────────────────────

  async listCatalogMonedas(): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        '/api/v1/catalogos/monedas',
      ),
    );
  }

  async listCatalogRamosInternos(): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        '/api/v1/catalogos/ramos-internos',
      ),
    );
  }

  async listCatalogCoberturasInternas(): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        '/api/v1/catalogos/coberturas-internas',
      ),
    );
  }

  async listCatalogTarifasInternas(): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        '/api/v1/catalogos/tarifas-internas',
      ),
    );
  }

  async listCatalogContratosReaseguro(): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        '/api/v1/catalogos/contratos-reaseguro',
      ),
    );
  }

  async listCatalogRamosReaseguro(): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        '/api/v1/catalogos/ramos-reaseguro',
      ),
    );
  }

  // ── nest-api catalog:sis2000 — macoberturas ─────────────────────────────

  async getSis2000CoberturasDefinicion(): Promise<unknown> {
    const body = await this.request<NestEnvelope<unknown>>(
      'GET',
      '/api/v1/coberturas/definicion',
    );
    return body.data ?? [];
  }

  // Lectura y escritura por el módulo propio de nest-api (v1/configurador, scope configurador:write).

  /** Ramos de Sis2000 (maramos): cramo y xdescripcion. */
  async listSis2000Ramos(): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>('GET', '/api/v1/configurador/ramos'),
    );
  }

  /** Alta de producto con sp_CrearProducto (nest-api valida el ramo; status 0 del SP llega como 400 con su mensaje). */
  async crearSis2000Producto(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/configurador/productos',
      aCrearProducto(payload),
      60_000,
    );
    return body.data ?? {};
  }

  /** Productores (maproduc) para asignar a un plan; filtro por nombre o código. */
  async listSis2000Productores(q = ''): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        `/api/v1/configurador/productores?q=${encodeURIComponent(q)}`,
      ),
    );
  }

  /** Canales alternos activos (macanalalt) para asignar a un plan; filtro por nombre o código. */
  async listSis2000Canales(q = ''): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        `/api/v1/configurador/canales?q=${encodeURIComponent(q)}`,
      ),
    );
  }

  async listSis2000CoberturasByRamo(cramo: string): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        `/api/v1/configurador/coberturas?cramo=${encodeURIComponent(cramo)}`,
      ),
    );
  }

  async getSis2000Cobertura(
    cramo: string,
    ccobertura: string,
  ): Promise<Record<string, unknown>> {
    const fila = (await this.listSis2000CoberturasByRamo(cramo)).find(
      (c) => String(c.ccobertura ?? '').trim() === ccobertura.trim(),
    );
    if (!fila) throw new NotFoundException(`Cobertura ${ccobertura} no encontrada en el ramo ${cramo}.`);
    return fila;
  }

  async createSis2000Cobertura(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/configurador/coberturas',
      aCrearCobertura(payload),
    );
    return body.data ?? payload;
  }

  async updateSis2000Cobertura(
    cramo: string,
    ccobertura: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'PATCH',
      `/api/v1/configurador/coberturas/${encodeURIComponent(cramo)}/${encodeURIComponent(ccobertura)}`,
      aEditarCobertura(payload),
    );
    return body.data ?? payload;
  }

  // ── nest-api catalog:sis2000 — matarifa / matarifa_d ────────────────────

  async getSis2000TarifasDefinicion(): Promise<unknown> {
    const body = await this.request<NestEnvelope<unknown>>(
      'GET',
      '/api/v1/tarifas/definicion',
    );
    return body.data ?? [];
  }

  async getSis2000TarifasDetalleDefinicion(): Promise<unknown> {
    const body = await this.request<NestEnvelope<unknown>>(
      'GET',
      '/api/v1/tarifas/detalles/definicion',
    );
    return body.data ?? [];
  }

  /** Tarifas de la cobertura, cada una con sus tasas por vigencia en `detalles`. */
  async listSis2000TarifasByRamoCobertura(
    cramo: string,
    ccobertura: string,
  ): Promise<Record<string, unknown>[]> {
    const tarifas = this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        `/api/v1/configurador/tarifas?cramo=${encodeURIComponent(cramo)}&ccober=${encodeURIComponent(ccobertura)}`,
      ),
    );
    return tarifas.map((t) => ({ cramo: Number(cramo), ccober: ccobertura.trim(), ...t }));
  }

  async listSis2000TarifaDetalleHistorico(
    cramo: string,
    ccobertura: string,
    ctarifa: string,
  ): Promise<Record<string, unknown>[]> {
    const tarifa = (await this.listSis2000TarifasByRamoCobertura(cramo, ccobertura)).find(
      (t) => String(t.ctarifa ?? '').trim() === ctarifa.trim(),
    );
    const detalles = Array.isArray(tarifa?.detalles) ? (tarifa.detalles as Record<string, unknown>[]) : [];
    return detalles.map((d) => ({ cramo: Number(cramo), ccober: ccobertura.trim(), ...d }));
  }

  async createSis2000Tarifa(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/configurador/tarifas',
      aCrearTarifa(payload),
    );
    return body.data ?? payload;
  }

  async createSis2000TarifaDetalle(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/configurador/tarifas/detalles',
      aCrearDetalleTarifa(payload),
    );
    return body.data ?? payload;
  }

  async updateSis2000Tarifa(
    cramo: string,
    ccobertura: string,
    ctarifa: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'PATCH',
      `/api/v1/configurador/tarifas/${encodeURIComponent(cramo)}/${encodeURIComponent(ccobertura)}/${encodeURIComponent(ctarifa)}`,
      aEditarTarifa(payload),
    );
    return body.data ?? payload;
  }

  // ── Tablas de tasas por edad (mapltabedad + mapltabedad_d): el código es el ctablatar de los planes de personas ──

  /** Tramo tal como lo pide nest-api (TramoEdadDto): edades enteras, tasa en % y prima fija. */
  private aTramosEdad(tramos: unknown): Record<string, number>[] {
    const num = (v: unknown) => (v == null || String(v).trim() === '' ? 0 : Number(v));
    return (Array.isArray(tramos) ? (tramos as Record<string, unknown>[]) : []).map((t) => ({
      nedad_min: num(t.nedad_min),
      nedad_max: num(t.nedad_max),
      pprima: num(t.pprima),
      mprima: num(t.mprima),
      msuma: num(t.msuma),
      msumamax: num(t.msumamax),
    }));
  }

  /** Tabla con sus tramos y los planes que la usan. 404 si no existe. */
  async leerSis2000TablaEdad(ctablaedad: string): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'GET',
      `/api/v1/configurador/tablas-edad/${encodeURIComponent(ctablaedad.trim())}`,
    );
    return body.data ?? {};
  }

  /** Crea cabecera y tramos en una sola llamada (nest-api rechaza si el código ya existe). */
  async crearSis2000TablaEdad(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/configurador/tablas-edad',
      {
        ctablaedad: String(payload.ctablaedad ?? '').trim().toUpperCase(),
        xtablaedad: String(payload.xtablaedad ?? '').trim(),
        tramos: this.aTramosEdad(payload.tramos),
      },
    );
    return body.data ?? {};
  }

  /** Reemplaza todos los tramos de una tabla existente: cambia la tarifa de los planes que la usan. */
  async reemplazarSis2000TramosEdad(ctablaedad: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'PUT',
      `/api/v1/configurador/tablas-edad/${encodeURIComponent(ctablaedad.trim())}/tramos`,
      { tramos: this.aTramosEdad(payload.tramos) },
    );
    return body.data ?? {};
  }

  // ── nest-api partner:starter — maplanes (spMantPlanes) ──────────────────

  async listSis2000MasterPlans(): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        '/api/v1/partner/starter/plan',
      ),
    );
  }

  /** Crear, editar y borrar planes: v1/configurador/planes (valida en nest-api y llama a spMantPlanes). */
  async createSis2000MasterPlan(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const cuerpo = cuerpoSpMantPlanes(payload);
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/configurador/planes',
      cuerpo,
      60_000,
    );
    await this.agregarCanalesPlan(Number(cuerpo.cramo), String(cuerpo.cplan ?? ''), payload);
    return body.data ?? payload;
  }

  /**
   * Agrega al plan los canales elegidos (solo alta en mausuplan; nunca borra). Si falla, el plan ya quedó guardado:
   * el error lo dice para que el usuario vuelva a guardar o revise los canales.
   */
  private async agregarCanalesPlan(cramo: number, cplan: string, payload: Record<string, unknown>) {
    const canales = canalesAAgregar(payload);
    if (!canales || !(cramo > 0) || !cplan.trim()) return;
    try {
      await this.request<NestEnvelope<unknown>>(
        'POST',
        `/api/v1/configurador/planes/${cramo}/${encodeURIComponent(cplan.trim())}/canales`,
        canales,
        60_000,
      );
    } catch (e) {
      const msg = e instanceof HttpException ? e.message : String(e);
      throw new BadGatewayException(`El plan ${cplan.trim()} se guardó, pero no se pudieron agregar los canales: ${msg}`);
    }
  }

  async updateSis2000MasterPlan(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { cramo, cplan } = partirPlanId(id);
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'PUT',
      `/api/v1/configurador/planes/${cramo}/${encodeURIComponent(cplan)}`,
      cuerpoSpMantPlanes(payload),
      60_000,
    );
    await this.agregarCanalesPlan(cramo, cplan, payload);
    return body.data ?? payload;
  }

  async deleteSis2000MasterPlan(id: string): Promise<void> {
    const { cramo, cplan } = partirPlanId(id);
    await this.request<NestEnvelope<unknown>>(
      'DELETE',
      `/api/v1/configurador/planes/${cramo}/${encodeURIComponent(cplan)}`,
      undefined,
      60_000,
    );
  }

  /**
   * Plan completo tal como está en Sis2000 (filas + forma de PlanDto). null si no existe.
   * Un 404 de la ruta (nest-api sin este endpoint) es error: así no se confunde con «no existe».
   */
  async leerSis2000Plan(cramo: number, cplan: string): Promise<Record<string, unknown> | null> {
    const body = await this.request<NestEnvelope<Record<string, unknown> | null>>(
      'GET',
      `/api/v1/configurador/planes/${cramo}/${encodeURIComponent(cplan.trim())}`,
      undefined,
      60_000,
    );
    if (!('data' in body)) throw new BadGatewayException('nest-api no devolvió el plan (falta data).');
    return body.data ?? null;
  }

  // ── Proveedores del plan (maplprov_per): la relación es por plan, aplica a todas sus coberturas ──

  async listSis2000Proveedores(q = ''): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        `/api/v1/configurador/proveedores?q=${encodeURIComponent(q)}`,
      ),
    );
  }

  async listSis2000PlanProveedores(
    cramo: number,
    cplan: string,
  ): Promise<{ escritura_habilitada: boolean; columna_cobertura: string | null; proveedores: Record<string, unknown>[] }> {
    const body = await this.request<
      NestEnvelope<{ escritura_habilitada?: boolean; columna_cobertura?: string | null; proveedores?: Record<string, unknown>[] }>
    >('GET', `/api/v1/configurador/planes/${cramo}/${encodeURIComponent(cplan.trim())}/proveedores`);
    if (!body.data || !Array.isArray(body.data.proveedores)) {
      throw new BadGatewayException('nest-api no devolvió los proveedores del plan.');
    }
    return {
      escritura_habilitada: body.data.escritura_habilitada === true,
      columna_cobertura: body.data.columna_cobertura ?? null,
      proveedores: body.data.proveedores,
    };
  }

  async agregarSis2000ProveedorPlan(cramo: number, cplan: string, payload: Record<string, unknown>) {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      `/api/v1/configurador/planes/${cramo}/${encodeURIComponent(cplan.trim())}/proveedores`,
      aProveedorPlan(payload),
    );
    return body.data ?? payload;
  }

  async editarSis2000ProveedorPlan(cramo: number, cplan: string, payload: Record<string, unknown>) {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'PATCH',
      `/api/v1/configurador/planes/${cramo}/${encodeURIComponent(cplan.trim())}/proveedores`,
      aEditarProveedorPlan(payload),
    );
    return body.data ?? payload;
  }

  async bajaSis2000ProveedorPlan(cramo: number, cplan: string, payload: Record<string, unknown>) {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      `/api/v1/configurador/planes/${cramo}/${encodeURIComponent(cplan.trim())}/proveedores/baja`,
      aBajaProveedorPlan(payload),
    );
    return body.data ?? payload;
  }

  // ── Cobro por días (prima diaria × días) ──

  private rutaCobroDias(cramo: number, cplan: string) {
    return `/api/v1/configurador/planes/${cramo}/${encodeURIComponent(cplan.trim())}/cobro-dias`;
  }

  /** Configuración de cobro por días del plan; null si el plan no la tiene. */
  async leerSis2000CobroDias(cramo: number, cplan: string): Promise<Record<string, unknown> | null> {
    const body = await this.request<NestEnvelope<Record<string, unknown> | null>>('GET', this.rutaCobroDias(cramo, cplan));
    return body.data ?? null;
  }

  async guardarSis2000CobroDias(cramo: number, cplan: string, payload: Record<string, unknown>) {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'PUT',
      this.rutaCobroDias(cramo, cplan),
      aCobroDias(payload),
      60_000,
    );
    return body.data ?? null;
  }

  /** Solo lectura: días × prima diaria por cobertura (nest-api cuenta los días inclusivos). */
  async cotizarSis2000CobroDias(cramo: number, cplan: string, payload: Record<string, unknown>) {
    const body = await this.request<NestEnvelope<Record<string, unknown>> & Record<string, unknown>>(
      'POST',
      `${this.rutaCobroDias(cramo, cplan)}/cotizar`,
      aCotizarCobroDias(payload),
    );
    return body.data ?? body;
  }

  /**
   * Frecuencias de pago — POST valrep/frecuencia (auxiliar formulario plan).
   * nest-api responde { data: { frecuencias: [{cvalor, xdescripcion}] }, plan: [{ifrecuencia, xfrecuencia, ndias}] };
   * se devuelve con la forma de CreatePlanDto.frecuencias.
   */
  async listPlanFrecuencias(
    cplan: string,
    cramo?: number,
  ): Promise<Record<string, unknown>[]> {
    const body = await this.request<
      NestEnvelope<{ frecuencias?: Record<string, unknown>[] } | unknown[]> & {
        plan?: Record<string, unknown>[];
      }
    >('POST', '/api/v1/valrep/frecuencia', { cplan, cramo });
    if (Array.isArray(body.plan) && body.plan.length) {
      return body.plan.map((f) => ({
        ifrecuencia: String(f.ifrecuencia ?? '').trim(),
        xfrecuencia: String(f.xfrecuencia ?? '').trim(),
        ndias: f.ndias ?? null,
      }));
    }
    const data = body.data;
    const filas = Array.isArray(data) ? data : (data?.frecuencias ?? []);
    return (filas as Record<string, unknown>[]).map((f) => ({
      ifrecuencia: String(f.ifrecuencia ?? f.cvalor ?? '').trim(),
      xfrecuencia: String(f.xfrecuencia ?? f.xdescripcion ?? '').trim(),
      ndias: f.ndias ?? null,
    }));
  }

  /** Cotización de un plan de cosas — spCalculoRiesgoGeneral (suma y prima salen de maplantar). */
  async quoteGeneralRiskPlan(
    cramo: number,
    cplan: string,
    ifrecuencia = 'A',
  ): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'POST',
        '/api/v1/partner/starter/patrimonial/quote',
        { cramo, cplan, cuotas: 1, ifrecuencia, pdescuento: 0, precargo: 0 },
      ),
    );
  }

  static planMasterId(cramo: number | string, cplan: string): string {
    return `${cramo}-${String(cplan).trim()}`;
  }

  private unwrapDataArray(body: NestEnvelope<unknown[]>): Record<string, unknown>[] {
    return Array.isArray(body.data)
      ? (body.data as Record<string, unknown>[])
      : [];
  }

  private async ensureAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 30_000) {
      return this.cachedToken.token;
    }

    let res: Response;
    try {
      res = await fetch(`${this.nestBase}/api/v1/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'api_key',
          apikey: this.nestApiKey,
        }),
      });
    } catch (err) {
      this.logger.error('nest-api auth unreachable', err);
      throw new BadGatewayException('No se pudo conectar con nest-api para autenticación.');
    }

    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      message?: string;
    };

    if (!res.ok || !body.access_token) {
      throw new BadGatewayException(
        body.message ?? `Error nest-api auth (${res.status})`,
      );
    }

    const ttlMs = (body.expires_in ?? 900) * 1000;
    this.cachedToken = {
      token: body.access_token,
      expiresAt: now + ttlMs,
    };
    return body.access_token;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureAccessToken();
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 30_000,
  ): Promise<T> {
    const url = `${this.nestBase}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: await this.authHeaders(),
        body: body != null ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      this.logger.error(`nest-api partner unreachable: ${method} ${path}`, err);
      throw new BadGatewayException(
        `No se pudo conectar con nest-api partner (${method} ${path}).`,
      );
    }

    const parsed = (await res.json().catch(() => ({}))) as NestEnvelope & {
      statusCode?: number;
    };

    if (!res.ok || parsed.status === false) {
      const message =
        parsed.message ??
        `Error nest-api partner (${res.status}) en ${path}`;
      this.throwNestHttpError(res.status, message);
    }

    return parsed as T;
  }

  /** Sin planes para P/citem no es fallo de infra — catálogo devuelve lista vacía. */
  private isValrepEmptyPlansMessage(message: string): boolean {
    const m = message.trim().toLowerCase();
    if (!m) return false;
    return /no se encuentr[aá]n?\s+planes/.test(m) || m.includes('planes asociados');
  }

  private httpExceptionMessage(err: HttpException): string {
    const body = err.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && 'message' in body) {
      const msg = (body as { message?: string | string[] }).message;
      if (Array.isArray(msg)) return msg.join(' ');
      if (typeof msg === 'string') return msg;
    }
    return err.message;
  }

  private throwNestHttpError(status: number, message: string): never {
    if (status === 502 || status === 503 || status === 504) {
      throw new BadGatewayException(message);
    }
    throw new HttpException(
      {
        message,
        statusCode: status,
        error: HttpException.createBody('', message, status).error,
      },
      status,
    );
  }
}
