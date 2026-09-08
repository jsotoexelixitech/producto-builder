import type {
  ActuarialData,
  ActuarialInput,
  CommercialChannel,
  Coverage,
  Exclusion,
  FormField,
  FlowStepConfig,
  GuardrailViolation,
  LegalDocument,
  Product,
  ProductPlan,
  RequiredDocument,
  SisipConfig,
} from '@/types/product';
import {
  authHeaders,
  clearAuthSession,
  setAuthSession,
  type AuthUser,
  type LoginResponse,
} from '@/lib/auth';
import { isExelixiCatalogPublicFlow } from '@/lib/exelixi-catalog-flow';
import { appRoute, moduleApiBase } from '@/lib/app-base';

const BASE = moduleApiBase();

function formatApiErrors(messages: string[]): string {
  const map: Record<string, string> = {
    'commercialName must be longer than or equal to 3 characters':
      'El nombre comercial debe tener al menos 3 caracteres.',
    'internalCode must be longer than or equal to 2 characters':
      'El código interno debe tener al menos 2 caracteres.',
    'internalCode must match /^[A-Z0-9_-]+$/ regular expression':
      'El código interno solo admite mayúsculas, números, guiones y guiones bajos.',
    'internalCode must match /^[A-Z0-9_-]+$/ regular expression.':
      'El código interno solo admite mayúsculas, números, guiones y guiones bajos.',
    'actuaryName must be longer than or equal to 3 characters':
      'El nombre del actuario debe tener al menos 3 caracteres.',
    'actuaryCedula must be longer than or equal to 5 characters':
      'La cédula del actuario debe tener al menos 5 caracteres.',
    'actuarySudeasegNumber must match /^[A-Z0-9-]+$/ regular expression':
      'El registro SUDEASEG solo admite mayúsculas, números y guiones (ej. ACT-2024-001).',
    'actuarySudeasegNumber must match /^[A-Z0-9-]+$/ regular expression.':
      'El registro SUDEASEG solo admite mayúsculas, números y guiones (ej. ACT-2024-001).',
    'ratingVariables must be an array':
      'Las variables de tarificación deben enviarse como arreglo (puede estar vacío).',
    'ratingVariables should not be null':
      'Las variables de tarificación no pueden ser null; usa [] si no hay variables.',
  };

  return messages
    .map((m) => {
      if (m.includes('ratingVariables') && m.includes('null')) {
        return 'Variables de tarificación: envía un arreglo (puede estar vacío), no null.';
      }
      return map[m] ?? m;
    })
    .join(' ');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...init?.headers,
    },
  });
  if (res.status === 401 && !path.startsWith('/auth/') && !isExelixiCatalogPublicFlow()) {
    clearAuthSession();
    window.location.assign(appRoute('/login'));
    throw new Error('Sesión expirada. Inicia sesión de nuevo.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const msg = err.message;
    if (Array.isArray(msg)) {
      throw new Error(formatApiErrors(msg));
    }
    if (typeof msg === 'string') {
      throw new Error(msg);
    }
    if (err.violations) {
      throw new Error(
        err.violations.map((v: { message: string }) => v.message).join('. '),
      );
    }
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}

export const api = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Credenciales inválidas' }));
      throw new Error(typeof err.message === 'string' ? err.message : 'Credenciales inválidas');
    }
    const data = (await res.json()) as LoginResponse;
    setAuthSession(data);
    return data;
  },
  logout: () => {
    clearAuthSession();
    window.location.assign(appRoute('/login'));
  },
  me: () => request<AuthUser>('/auth/me'),
  listProducts: () => request<Product[]>('/products'),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  createProduct: (body: Partial<Product>) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id: string, body: Partial<Product>) =>
    request<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  replaceCoverages: (id: string, coverages: Coverage[]) =>
    request<Coverage[]>(`/products/${id}/coverages`, {
      method: 'PUT',
      body: JSON.stringify({ coverages }),
    }),
  upsertActuarial: (id: string, data: ActuarialInput) =>
    request<ActuarialData>(`/products/${id}/actuarial`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  upsertLegal: (
    id: string,
    data: {
      exclusions: Exclusion[];
      documents: LegalDocument[];
      commercialChannels?: CommercialChannel[];
      requiredDocuments?: RequiredDocument[];
    },
  ) => request<Product>(`/products/${id}/legal`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  getEmissionConfig: (id: string) =>
    request<{
      productId: string;
      branch: string;
      flowSteps: FlowStepConfig[];
      formFields: FormField[];
    }>(`/products/${id}/emission-config`),
  upsertEmissionConfig: (
    id: string,
    data: {
      flowSteps: FlowStepConfig[];
      formFields: FormField[];
    },
  ) =>
    request(`/products/${id}/emission-config`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getProductPlans: (id: string) =>
    request<{
      productId: string;
      branch: string;
      coverages: { id: string; name: string }[];
      plans: ProductPlan[];
    }>(`/products/${id}/plans`),
  upsertProductPlans: (id: string, plans: ProductPlan[]) =>
    request(`/products/${id}/plans`, {
      method: 'PUT',
      body: JSON.stringify({ plans }),
    }),
  getSisipConfig: (id: string) =>
    request<SisipConfig>(`/products/${id}/sisip`),
  upsertSisipConfig: (id: string, data: SisipConfig) =>
    request<SisipConfig>(`/products/${id}/sisip`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  validateSubmission: (id: string) =>
    request<{ valid: boolean; violations: GuardrailViolation[] }>(
      `/products/${id}/workflow/validate-submission`,
    ),
  deleteProduct: (id: string) =>
    request<{ id?: string }>(`/products/${id}`, { method: 'DELETE' }),
  setCatalogVisibility: (id: string, visible: boolean) =>
    request<Product>(`/products/${id}/catalog-visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visible }),
    }),
  transition: (id: string, toStatus: string, comment?: string) =>
    request<Product>(`/products/${id}/workflow/transition`, {
      method: 'POST',
      body: JSON.stringify({ toStatus, comment }),
    }),
  approve: (
    id: string,
    numeroProvidenciaSudeaseg: string,
    fechaGacetaAprobacion: string,
  ) =>
    request<Product>(`/products/${id}/workflow/approve`, {
      method: 'POST',
      body: JSON.stringify({ numeroProvidenciaSudeaseg, fechaGacetaAprobacion }),
    }),
  listCoreSubBranches: (branch: string) =>
    request<import('@/lib/core-catalog').CoreSubBranch[]>(
      `/core/subramos?branch=${encodeURIComponent(branch)}`,
    ),
  listCoreCoverages: (branch: string, subBranchCode?: string) => {
    const qs = new URLSearchParams({ branch });
    if (subBranchCode) qs.set('subBranchCode', subBranchCode);
    return request<import('@/lib/core-catalog').CoreCoverageCatalogItem[]>(
      `/core/coverages?${qs}`,
    );
  },
  createCoreCoverage: (body: {
    branch: string;
    subBranchCode?: string;
    name: string;
    code?: string;
    accountingCode?: string;
  }) =>
    request<import('@/lib/core-catalog').CoreCoverageCatalogItem>('/core/coverages', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listCoreProducts: (branch?: string) =>
    request<import('@/lib/core-catalog').CoreProductSummary[]>(
      branch ? `/core/products?branch=${encodeURIComponent(branch)}` : '/core/products',
    ),
  importCoreProduct: (coreCode: string) =>
    request<{ imported: boolean; product: Product; coreCode: string }>(
      '/core/products/import',
      { method: 'POST', body: JSON.stringify({ coreCode }) },
    ),
  syncProductToCore: (productId: string) =>
    request<{
      ok: boolean;
      coreCode: string;
      product: Product;
      remote: boolean;
      partner?: boolean;
      partnerAction?: 'created' | 'updated';
    }>(`/core/products/${productId}/sync`, { method: 'POST', body: JSON.stringify({}) }),
};
