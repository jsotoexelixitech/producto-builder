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
