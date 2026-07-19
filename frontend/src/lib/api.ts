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

const BASE = '/api';

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
  };

  return messages.map((m) => map[m] ?? m).join(' ');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
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
};
