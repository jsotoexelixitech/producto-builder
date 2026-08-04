import { authHeaders } from '@/lib/auth';
import type { EmissionFormData } from '@/lib/emission-live';
import { buildRiskData, resolvePolicyTemplate } from '@/lib/emission-live';
import type { Product } from '@/types/product';

const BASE = '/api/emission';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(typeof err.message === 'string' ? err.message : 'Error en emisión');
  }
  return res.json();
}

export interface QuoteResult {
  productId: string;
  productName: string;
  planName: string;
  primaTotal: number;
  moneda: string;
  coberturas: { name: string; sumaAsegurada: number | null; prima: number | null }[];
}

export interface EmitResult {
  numeroPoliza: string;
  documentUrl: string;
  primaTotal?: number;
  planName?: string;
  productName?: string;
  moneda?: string;
  persisted?: boolean;
}

export function quote(productId: string, planName?: string) {
  return request<QuoteResult>('/quote', {
    method: 'POST',
    body: JSON.stringify({ productId, planName }),
  });
}

export function validate(productId: string, planName?: string) {
  return request<{ valid: boolean; violations: { code: string; message: string }[] }>(
    '/validate',
    { method: 'POST', body: JSON.stringify({ productId, planName }) },
  );
}

export function emitPolicy(
  product: Product,
  planName: string,
  form: EmissionFormData,
  simulatePayment = true,
) {
  return request<EmitResult>('/emit', {
    method: 'POST',
    body: JSON.stringify({
      productId: product.id,
      planName,
      policyTemplate: resolvePolicyTemplate(product.branch, product.commercialName),
      simulatePayment,
      tomador: {
        nombre: form.tomadorNombre,
        identificacion: form.tomadorId,
      },
      asegurado: {
        nombre: form.aseguradoNombre,
        identificacion: form.aseguradoId,
      },
      riskData: buildRiskData(product, form),
    }),
  });
}

export function uploadOcrDocument(
  file: File,
  docType: string,
  onProgress?: (pct: number) => void,
): Promise<{ success: boolean; ocr?: Record<string, unknown>; ocrFailed?: boolean; message?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    form.append('docType', docType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error('Respuesta OCR inválida'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as { success: boolean; ocr?: Record<string, unknown>; ocrFailed?: boolean; message?: string });
      } else {
        reject(new Error((data.message as string) ?? `Error OCR (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('No se pudo conectar con el servicio OCR'));
    xhr.open('POST', `${BASE}/ocr/upload`);
    const headers = authHeaders();
    if (headers.Authorization) {
      xhr.setRequestHeader('Authorization', headers.Authorization);
    }
    xhr.send(form);
  });
}
