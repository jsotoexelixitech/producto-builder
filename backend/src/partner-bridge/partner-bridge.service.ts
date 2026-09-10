import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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

  async listSis2000CoberturasByRamo(cramo: string): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        `/api/v1/coberturas/${encodeURIComponent(cramo)}`,
      ),
    );
  }

  async getSis2000Cobertura(
    cramo: string,
    ccobertura: string,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'GET',
      `/api/v1/coberturas/${encodeURIComponent(cramo)}/${encodeURIComponent(ccobertura)}`,
    );
    return body.data ?? {};
  }

  async createSis2000Cobertura(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/coberturas/create',
      payload,
    );
    return body.data ?? payload;
  }

  async updateSis2000Cobertura(
    cramo: string,
    ccobertura: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'PUT',
      `/api/v1/coberturas/${encodeURIComponent(cramo)}/${encodeURIComponent(ccobertura)}`,
      payload,
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

  async listSis2000TarifasByRamoCobertura(
    cramo: string,
    ccobertura: string,
  ): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        `/api/v1/tarifas/${encodeURIComponent(cramo)}/${encodeURIComponent(ccobertura)}`,
      ),
    );
  }

  async listSis2000TarifaDetalleHistorico(
    cramo: string,
    ccobertura: string,
    ctarifa: string,
  ): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'GET',
        `/api/v1/tarifas/${encodeURIComponent(cramo)}/${encodeURIComponent(ccobertura)}/${encodeURIComponent(ctarifa)}/detalles`,
      ),
    );
  }

  async createSis2000Tarifa(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/tarifas/create',
      payload,
    );
    return body.data ?? payload;
  }

  async createSis2000TarifaDetalle(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/tarifas/detalles/create',
      payload,
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
      'PUT',
      `/api/v1/tarifas/${encodeURIComponent(cramo)}/${encodeURIComponent(ccobertura)}/${encodeURIComponent(ctarifa)}`,
      payload,
    );
    return body.data ?? payload;
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

  async createSis2000MasterPlan(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'POST',
      '/api/v1/partner/starter/plan',
      payload,
      60_000,
    );
    return body.data ?? payload;
  }

  async updateSis2000MasterPlan(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = await this.request<NestEnvelope<Record<string, unknown>>>(
      'PUT',
      `/api/v1/partner/starter/plan/${encodeURIComponent(id)}`,
      payload,
      60_000,
    );
    return body.data ?? payload;
  }

  async deleteSis2000MasterPlan(id: string): Promise<void> {
    await this.request<NestEnvelope<unknown>>(
      'DELETE',
      `/api/v1/partner/starter/plan/${encodeURIComponent(id)}`,
      undefined,
      60_000,
    );
  }

  /** Frecuencias de pago — POST valrep/frecuencia (auxiliar formulario plan). */
  async listPlanFrecuencias(
    cplan: string,
    cramo?: number,
  ): Promise<Record<string, unknown>[]> {
    return this.unwrapDataArray(
      await this.request<NestEnvelope<unknown[]>>(
        'POST',
        '/api/v1/valrep/frecuencia',
        { cplan, cramo },
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
      throw new BadGatewayException(
        parsed.message ??
          `Error nest-api partner (${res.status}) en ${path}`,
      );
    }

    return parsed as T;
  }
}
