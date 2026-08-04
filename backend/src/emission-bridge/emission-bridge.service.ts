import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EmitPolicyBridgeDto } from './dto/emit-policy.dto';

@Injectable()
export class EmissionBridgeService {
  private readonly logger = new Logger(EmissionBridgeService.name);
  private readonly nestBase: string;
  private readonly nestApiKey: string;
  private readonly ocrBase: string;
  private readonly publicDocBase: string;

  constructor() {
    this.nestBase = (
      process.env.NEST_API_URL ?? 'http://127.0.0.1:3002'
    ).replace(/\/$/, '');
    this.nestApiKey = process.env.NEST_API_KEY ?? process.env.NEST_ADMIN_TOKEN ?? '';
    this.ocrBase = (process.env.OCR_API_URL ?? 'http://127.0.0.1:4001').replace(
      /\/$/,
      '',
    );
    const pbPublic =
      process.env.PRODUCT_BUILDER_PUBLIC_URL ??
      process.env.FRONTEND_URL ??
      'http://localhost:5173';
    this.publicDocBase = `${pbPublic.replace(/\/$/, '')}/api/emission/documents`;
  }

  private nestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.nestApiKey) {
      headers.apikey = this.nestApiKey;
    }
    return headers;
  }

  private async nestFetch<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.nestApiKey) {
      throw new ServiceUnavailableException(
        'NEST_API_KEY o NEST_ADMIN_TOKEN no configurado en product-builder.',
      );
    }
    const url = `${this.nestBase}/api/v1/product-emission${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { ...this.nestHeaders(), ...(init?.headers as Record<string, string>) },
      });
    } catch (err) {
      this.logger.error(`nest-api unreachable: ${url}`, err);
      throw new BadGatewayException(
        'No se pudo conectar con nest-api (product-emission).',
      );
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadRequestException(
        body.message ?? `Error nest-api (${res.status})`,
      );
    }
    return body as T;
  }

  quote(body: { productId: string; planName?: string }) {
    return this.nestFetch('/quote', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  validate(body: { productId: string; planName?: string }) {
    return this.nestFetch('/validate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async emit(dto: EmitPolicyBridgeDto) {
    const estatus =
      dto.estatus ??
      (dto.simulatePayment !== false ? 'PAGADO' : 'PENDIENTE');

    const result = await this.nestFetch<{
      numeroPoliza: string;
      documentUrl: string;
      primaTotal?: number;
      planName?: string;
      productName?: string;
      moneda?: string;
      persisted?: boolean;
    }>('/emit', {
      method: 'POST',
      body: JSON.stringify({ ...dto, estatus }),
    });

    const filename = this.extractFilename(result.documentUrl);
    if (filename) {
      result.documentUrl = `${this.publicDocBase}/${encodeURIComponent(filename)}`;
    }
    return result;
  }

  private extractFilename(documentUrl: string): string | null {
    if (!documentUrl) return null;
    try {
      const path = new URL(documentUrl).pathname;
      const parts = path.split('/');
      return parts[parts.length - 1] || null;
    } catch {
      const parts = documentUrl.split('/');
      return parts[parts.length - 1] || null;
    }
  }

  async proxyDocument(filename: string, download: boolean): Promise<Response> {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safe) {
      throw new BadRequestException('Nombre de archivo inválido.');
    }
    const url = `${this.nestBase}/api/v1/product-emission/documents/${safe}${download ? '?download=true' : ''}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      this.logger.error(`document proxy failed: ${url}`, err);
      throw new BadGatewayException('No se pudo obtener el documento.');
    }
    if (!res.ok) {
      throw new BadRequestException('El documento no existe o expiró.');
    }
    return res;
  }

  async proxyOcrUpload(
    file: Express.Multer.File,
    docType: string,
  ): Promise<Record<string, unknown>> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    const allowed = ['cedula', 'licencia', 'certificado', 'rif'];
    if (!allowed.includes(docType)) {
      throw new BadRequestException(`docType inválido: ${docType}`);
    }

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );
    form.append('docType', docType);

    const url = `${this.ocrBase}/api/documents/upload`;
    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', body: form });
    } catch (err) {
      this.logger.error(`OCR unreachable: ${url}`, err);
      throw new BadGatewayException(
        'No se pudo conectar con el módulo OCR. Verifica OCR_API_URL.',
      );
    }

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new BadRequestException(
        (body.message as string) ?? `Error OCR (${res.status})`,
      );
    }
    return body;
  }
}
