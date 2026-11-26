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

/** Error de la API con su código HTTP (p. ej. 409 cuando el registro ya existe en Sis2000). */
export class ApiError extends Error {
  readonly status: number;
  /** Ruta y método llamados (para «Ver detalle técnico»). status 0 = sin conexión. */
  readonly ruta?: string;
  readonly metodo?: string;
  /** Mensajes de validación sin traducir (class-validator), uno por campo. */
  readonly mensajes?: string[];
  /** Cuerpo de la respuesta de error (p. ej. `advertencias` que hay que confirmar). */
  readonly cuerpo?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    extra: { ruta?: string; metodo?: string; mensajes?: string[]; cuerpo?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.ruta = extra.ruta;
    this.metodo = extra.metodo;
    this.mensajes = extra.mensajes;
    this.cuerpo = extra.cuerpo;
  }
}

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
  const donde = { ruta: path, metodo: init?.method ?? 'GET' };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...init?.headers,
      },
    });
  } catch (e) {
    // Sin conexión con el servidor del configurador (status 0): lo traduce lib/errores.
    throw new ApiError(e instanceof Error ? e.message : 'Failed to fetch', 0, donde);
  }
  if (res.status === 401 && !path.startsWith('/auth/') && !isExelixiCatalogPublicFlow()) {
    clearAuthSession();
    window.location.assign(appRoute('/login'));
    throw new Error('Sesión expirada. Inicia sesión de nuevo.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const msg = err.message;
    const cuerpo = err && typeof err === 'object' ? (err as Record<string, unknown>) : undefined;
    if (Array.isArray(msg)) {
      throw new ApiError(formatApiErrors(msg), res.status, { ...donde, mensajes: msg.map(String), cuerpo });
    }
    if (typeof msg === 'string') {
      throw new ApiError(msg, res.status, { ...donde, cuerpo });
    }
    if (err.violations) {
      throw new ApiError(
        err.violations.map((v: { message: string }) => v.message).join('. '),
        res.status,
        donde,
      );
    }
    throw new ApiError(JSON.stringify(err), res.status, donde);
  }
  return res.json();
}

// ── Configurador fase 2: rutas y escritura genérica ──
type CuerpoF2 = Record<string, unknown>;
/** Respuesta de una escritura: datos de nest-api + `advertencias` (informativas) y `grabado: false` si pide confirmar. */
export type RespuestaEscrituraF2 = Record<string, unknown> & { advertencias?: string[]; grabado?: boolean };
const rutaPlanF2 = (planId: string) => `/core/sis2000/plans/${encodeURIComponent(planId)}`;
const rutaRamoF2 = (cramo: number) => `/core/sis2000/ramos/${encodeURIComponent(String(cramo))}`;
/** El tercer parámetro (tiempo máximo) es informativo: el builder ya espera a nest-api con su propio límite. */
function enviar(metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE', ruta: string, body?: CuerpoF2, _ms?: number) {
  return request<RespuestaEscrituraF2>(ruta, { method: metodo, body: body === undefined ? undefined : JSON.stringify(body) });
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
  listSis2000Products: () =>
    request<import('@/lib/sis2000-catalog').Sis2000Product[]>('/core/sis2000/products'),
  getSis2000Product: (cproducto: string) =>
    request<import('@/lib/sis2000-catalog').Sis2000Product>(
      `/core/sis2000/products/${encodeURIComponent(cproducto)}`,
    ),
  createSis2000Product: (body: import('@/lib/sis2000-catalog').Sis2000ProductInput) =>
    request<{ ok: boolean; action: 'created'; product: import('@/lib/sis2000-catalog').Sis2000Product }>(
      '/core/sis2000/products',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  updateSis2000Product: (
    cproducto: string,
    body: import('@/lib/sis2000-catalog').Sis2000ProductInput,
  ) =>
    request<{ ok: boolean; action: 'updated'; product: import('@/lib/sis2000-catalog').Sis2000Product }>(
      `/core/sis2000/products/${encodeURIComponent(cproducto)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),
  listSis2000ProductPlans: (
    cproducto: string,
    opts?: { centidad?: string; citem?: string },
  ) => {
    const qs = new URLSearchParams();
    if (opts?.centidad?.trim()) qs.set('centidad', opts.centidad.trim());
    if (opts?.citem?.trim()) qs.set('citem', opts.citem.trim());
    const q = qs.toString();
    return request<import('@/lib/sis2000-plans').Sis2000ProductPlansResponse>(
      `/core/sis2000/products/${encodeURIComponent(cproducto)}/plans${q ? `?${q}` : ''}`,
    );
  },
  getSis2000PlanDetail: (cramo: number, cplan: string) =>
    request<{ plan: import('@/lib/sis2000-plans').Sis2000Plan }>(
      `/core/sis2000/plans/detail?cramo=${encodeURIComponent(String(cramo))}&cplan=${encodeURIComponent(cplan)}`,
    ),

  // Catálogos auxiliares (combos formulario plan)
  listSis2000Productores: (q = '') =>
    request<{ cproductor: number; xproductor: string }[]>(
      `/core/sis2000/catalogos/productores?q=${encodeURIComponent(q)}`,
    ),
  listSis2000Canales: (q = '') =>
    request<{ ccanalalt: number; xcanalalt: string; ctipocanal?: string | null }[]>(
      `/core/sis2000/catalogos/canales?q=${encodeURIComponent(q)}`,
    ),
  /** Banderas del servidor (p. ej. canales en planes). */
  getSis2000Funciones: () =>
    request<{ canalesEnPlan: boolean; cobroDias?: boolean; crearProducto?: boolean }>('/core/sis2000/funciones'),
  /**
   * Ramos de Sis2000 (maramos). Fase 2: cada fila trae además ctiporamo, colectivo, emisionNexus, estado, planes,
   * productos, soloLectura, avisos, condominio, tarifaDias y secciones (se normaliza con normalizarRamoCatalogo).
   */
  listSis2000Ramos: () =>
    request<Array<{ cramo: number; xdescripcion: string; familia?: string } & Record<string, unknown>>>('/core/sis2000/ramos'),
  /** Alta de producto en un ramo (sp_CrearProducto); requiere SIS2000_PRODUCTO_ESCRITURA en el builder. */
  crearSis2000Producto: (body: {
    cproducto: string;
    cramo: number;
    xdescripcion_l: string;
    xdescripcion_c?: string;
    xabreviatura?: string;
    iproductor?: boolean;
    icanal?: boolean;
  }) =>
    request<{ ok: boolean; cproducto: string; cramo: number; message: string }>(
      '/core/sis2000/productos',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  // Tipo de emisión «Cobro por días» (prima diaria × días); bandera SIS2000_PLAN_COBRO_DIAS del builder
  leerSis2000CobroDias: (planId: string) =>
    request<{ data: import('@/lib/sis2000-cobro-dias').CobroDiasConfig | null }>(
      `/core/sis2000/plans/${encodeURIComponent(planId)}/cobro-dias`,
    ),
  guardarSis2000CobroDias: (planId: string, body: Record<string, unknown>) =>
    request<{ data: import('@/lib/sis2000-cobro-dias').CobroDiasConfig | null }>(
      `/core/sis2000/plans/${encodeURIComponent(planId)}/cobro-dias`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),
  cotizarSis2000CobroDias: (planId: string, body: { fdesde: string; fhasta: string } | { dias: number }) =>
    request<import('@/lib/sis2000-cobro-dias').CobroDiasCotizacion>(
      `/core/sis2000/plans/${encodeURIComponent(planId)}/cobro-dias/cotizar`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  // Tablas de tasas por edad (mapltabedad + mapltabedad_d): el código es el ctablatar de los planes de personas
  /** Buscar tablas existentes por código o descripción (TOP 50). */
  buscarSis2000TablasEdad: (q = '') =>
    request<import('@/components/sis2000/TablaEdadDialog').TablaEdadResumen[]>(
      `/core/sis2000/tablas-edad?q=${encodeURIComponent(q)}`,
    ),
  /** Parentescos de Sis2000 (maparent). */
  listSis2000Parentescos: () =>
    request<{ cparen: number; xparentesco: string }[]>('/core/sis2000/catalogos/parentescos'),
  leerSis2000TablaEdad: (codigo: string) =>
    request<import('@/components/sis2000/TablaEdadDialog').TablaEdad>(
      `/core/sis2000/tablas-edad/${encodeURIComponent(codigo.trim())}`,
    ),
  crearSis2000TablaEdad: (body: {
    ctablaedad: string;
    xtablaedad: string;
    tramos: import('@/components/sis2000/TablaEdadDialog').TramoEdad[];
  }) =>
    request<{ ctablaedad: string; tramos: number }>('/core/sis2000/tablas-edad', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reemplazarSis2000TramosEdad: (codigo: string, tramos: import('@/components/sis2000/TablaEdadDialog').TramoEdad[]) =>
    request<Record<string, unknown>>(`/core/sis2000/tablas-edad/${encodeURIComponent(codigo.trim())}/tramos`, {
      method: 'PUT',
      body: JSON.stringify({ tramos }),
    }),

  // Historial y restauración (copia original + versiones en la Postgres del configurador)
  getSis2000Historial: (entidad: import('@/lib/sis2000-historial').EntidadHistorial, clave: string) =>
    request<import('@/lib/sis2000-historial').HistorialRespuesta>(
      `/core/sis2000/historial/${entidad}/${encodeURIComponent(clave)}`,
    ),
  vistaPreviaRestauracion: (
    entidad: import('@/lib/sis2000-historial').EntidadHistorial,
    clave: string,
    destino: string,
    momento: import('@/lib/sis2000-historial').MomentoVersion = 'despues',
  ) =>
    request<import('@/lib/sis2000-historial').VistaPreviaRestauracion>(
      `/core/sis2000/historial/${entidad}/${encodeURIComponent(clave)}/vista-previa?destino=${encodeURIComponent(destino)}&momento=${momento}`,
    ),
  restaurarSis2000: (
    entidad: import('@/lib/sis2000-historial').EntidadHistorial,
    clave: string,
    body: { destino: string; momento?: import('@/lib/sis2000-historial').MomentoVersion; motivo: string },
  ) =>
    request<import('@/lib/sis2000-historial').RestauracionRespuesta>(
      `/core/sis2000/historial/${entidad}/${encodeURIComponent(clave)}/restaurar`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  // Proveedores del plan (maplprov_per): se asignan al plan y aplican a todas sus coberturas
  listSis2000Proveedores: (q = '') =>
    request<import('@/lib/sis2000-proveedores').ProveedorCatalogo[]>(
      `/core/sis2000/catalogos/proveedores?q=${encodeURIComponent(q)}`,
    ),
  /** Empresas de maclient por RIF (V-/J-/G-/E- + número o cci_rif). */
  buscarSis2000Clientes: (rif: string) =>
    request<import('@/lib/sis2000-proveedores').ClienteBusqueda[]>(
      `/core/sis2000/catalogos/clientes?rif=${encodeURIComponent(rif)}`,
    ),
  /** Crea la empresa como cliente de Sis2000 (J, G o C). 409 si el RIF ya existe. */
  crearSis2000Cliente: (body: Record<string, unknown>) =>
    request<import('@/lib/sis2000-proveedores').ClienteBusqueda>('/core/sis2000/catalogos/clientes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listSis2000Estados: () => request<Array<{ cestado: number; xdescripcion: string }>>('/core/sis2000/catalogos/clientes/estados'),
  listSis2000Ciudades: (cestado: number) =>
    request<Array<{ cciudad: number; xdescripcion: string }>>(`/core/sis2000/catalogos/clientes/ciudades?cestado=${cestado}`),
  listSis2000TiposServicio: () =>
    request<import('@/lib/sis2000-proveedores').TipoServicioCatalogo[]>('/core/sis2000/catalogos/proveedores/tipos-servicio'),
  /** Alta en el catálogo de proveedores de Sis2000 (maclient_prov). */
  crearSis2000ProveedorCatalogo: (body: Record<string, unknown>) =>
    request<import('@/lib/sis2000-proveedores').ProveedorCatalogoCreado>('/core/sis2000/catalogos/proveedores', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listSis2000PlanProveedores: (planId: string) =>
    request<import('@/lib/sis2000-proveedores').ProveedoresPlanRespuesta>(
      `/core/sis2000/plans/${encodeURIComponent(planId)}/proveedores`,
    ),
  agregarSis2000PlanProveedor: (planId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/core/sis2000/plans/${encodeURIComponent(planId)}/proveedores`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  editarSis2000PlanProveedor: (planId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/core/sis2000/plans/${encodeURIComponent(planId)}/proveedores`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  bajaSis2000PlanProveedor: (planId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/core/sis2000/plans/${encodeURIComponent(planId)}/proveedores/baja`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Plan completo tal como está en Sis2000 (incluye productores y canales de mausuplan). */
  leerSis2000Plan: (planId: string) =>
    request<{ type: string; plan: Record<string, unknown>; advertencias: string[] }>(
      `/core/sis2000/plans/${encodeURIComponent(planId)}/sis2000`,
    ),
  listSis2000CatalogMonedas: () =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>('/core/sis2000/catalogos/monedas'),
  listSis2000CatalogRamosInternos: () =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>(
      '/core/sis2000/catalogos/ramos-internos',
    ),
  listSis2000CatalogCoberturasInternas: () =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>(
      '/core/sis2000/catalogos/coberturas-internas',
    ),
  listSis2000CatalogTarifasInternas: () =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>(
      '/core/sis2000/catalogos/tarifas-internas',
    ),
  listSis2000CatalogContratosReaseguro: () =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>(
      '/core/sis2000/catalogos/contratos-reaseguro',
    ),
  listSis2000CatalogRamosReaseguro: () =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>(
      '/core/sis2000/catalogos/ramos-reaseguro',
    ),

  // Coberturas maestro
  getSis2000CoberturasDefinicion: () =>
    request<unknown>('/core/sis2000/coberturas/definicion'),
  listSis2000CoberturasByRamo: (cramo: number) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>(
      `/core/sis2000/coberturas/${encodeURIComponent(String(cramo))}`,
    ),
  getSis2000Cobertura: (cramo: number, ccobertura: string) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow>(
      `/core/sis2000/coberturas/${encodeURIComponent(String(cramo))}/${encodeURIComponent(ccobertura)}`,
    ),
  createSis2000Cobertura: (body: Record<string, unknown>) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow>('/core/sis2000/coberturas', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSis2000Cobertura: (
    cramo: number,
    ccobertura: string,
    body: Record<string, unknown>,
  ) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow>(
      `/core/sis2000/coberturas/${encodeURIComponent(String(cramo))}/${encodeURIComponent(ccobertura)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),

  // Suma asegurada por cobertura (FIJA / CALCULADA al emitir) — Postgres del configurador
  listSis2000CoberturaSumaConfig: (cramo: number) =>
    request<import('@/lib/sis2000-nest-api').CoberturaSumaConfig[]>(
      `/core/sis2000/suma-config/${encodeURIComponent(String(cramo))}`,
    ),
  upsertSis2000CoberturaSumaConfig: (
    cramo: number,
    ccobertura: string,
    body: {
      tipoSuma: import('@/lib/sis2000-nest-api').TipoSumaAsegurada;
      unidadCalculo?: string;
      etiquetaCuadro?: string;
    },
  ) =>
    request<import('@/lib/sis2000-nest-api').CoberturaSumaConfig>(
      `/core/sis2000/suma-config/${encodeURIComponent(String(cramo))}/${encodeURIComponent(ccobertura)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),

  // Tarifas
  getSis2000TarifasDefinicion: () =>
    request<unknown>('/core/sis2000/tarifas/definicion'),
  getSis2000TarifasDetalleDefinicion: () =>
    request<unknown>('/core/sis2000/tarifas/detalles/definicion'),
  listSis2000Tarifas: (cramo: number, ccobertura: string) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>(
      `/core/sis2000/tarifas/${encodeURIComponent(String(cramo))}/${encodeURIComponent(ccobertura)}`,
    ),
  listSis2000TarifaDetalleHistorico: (
    cramo: number,
    ccobertura: string,
    ctarifa: string,
  ) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>(
      `/core/sis2000/tarifas/${encodeURIComponent(String(cramo))}/${encodeURIComponent(ccobertura)}/${encodeURIComponent(ctarifa)}/detalles`,
    ),
  createSis2000Tarifa: (body: Record<string, unknown>) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow>('/core/sis2000/tarifas', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSis2000Tarifa: (
    cramo: number,
    ccobertura: string,
    ctarifa: string,
    body: Record<string, unknown>,
  ) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow>(
      `/core/sis2000/tarifas/${encodeURIComponent(String(cramo))}/${encodeURIComponent(ccobertura)}/${encodeURIComponent(ctarifa)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),
  createSis2000TarifaDetalle: (body: Record<string, unknown>) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow>('/core/sis2000/tarifas/detalles', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ── Configurador fase 1 (contrato CONTRATO-CONFIGURADOR-AUTO): ramo, deducibles, comisiones, auto, revisión ──
  /** { cramo, xdescripcion_l, familia, secciones }: las secciones de la ficha del plan. */
  leerSis2000Ramo: (cramo: number) =>
    request<Record<string, unknown>>(`/core/sis2000/ramos/${encodeURIComponent(String(cramo))}`),
  /** PATCH de una tasa con vigencia: montos, deducible, cerrar vigencia (fhasta) o inactivar (iestado 'I'). */
  editarSis2000DetalleTarifa: (cramo: number, ccober: string, ctarifa: string, fdesde: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(
      `/core/sis2000/tarifas/${encodeURIComponent(String(cramo))}/${encodeURIComponent(ccober.trim())}/${encodeURIComponent(ctarifa.trim())}/detalles/${encodeURIComponent(fdesde.slice(0, 10))}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  /** Deducible de una cobertura del plan (copia en el plan). */
  editarSis2000DeducibleCoberturaPlan: (planId: string, ccobertura: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(
      `/core/sis2000/plans/${encodeURIComponent(planId)}/coberturas/${encodeURIComponent(ccobertura.trim())}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  listarSis2000Comisiones: (planId: string) =>
    request<Record<string, unknown>[]>(`/core/sis2000/plans/${encodeURIComponent(planId)}/comisiones`),
  agregarSis2000Comision: (planId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/core/sis2000/plans/${encodeURIComponent(planId)}/comisiones`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  bajaSis2000Comision: (planId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/core/sis2000/plans/${encodeURIComponent(planId)}/comisiones/baja`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listarSis2000AutoTipos: (cramo: number) =>
    request<Record<string, unknown>[]>(`/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tipos`),
  listarSis2000AutoUsos: (cramo: number) =>
    request<Record<string, unknown>[]>(`/core/sis2000/auto/${encodeURIComponent(String(cramo))}/usos`),
  leerSis2000TiposUso: (cramo: number) =>
    request<{ filas: Record<string, unknown>[]; planesAfectados: string[] }>(
      `/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tipos-uso`,
    ),
  /** Sin `confirmar`, si el par existe en otro ramo responde grabado false con advertencias. Solo escribe lo enviado. */
  guardarSis2000TipoUso: (cramo: number, ctipo: string, ccategotr: string, body: Record<string, unknown>) =>
    request<Record<string, unknown> & { advertencias?: string[]; grabado?: boolean; accion?: string | null; planesAfectados?: string[] }>(
      `/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tipos-uso/${encodeURIComponent(ctipo)}/${encodeURIComponent(ccategotr)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),
  listarSis2000TasasAntiguedad: (planId: string) =>
    request<Record<string, unknown>[]>(`/core/sis2000/plans/${encodeURIComponent(planId)}/tasas-antiguedad`),
  /** tramos [] inactiva todos; si la cobertura no es de casco responde grabado false y pide confirmar. */
  guardarSis2000TasasAntiguedad: (planId: string, ccober: string, ctarifa: string, body: Record<string, unknown>) =>
    request<Record<string, unknown> & { advertencias?: string[]; grabado?: boolean }>(
      `/core/sis2000/plans/${encodeURIComponent(planId)}/tasas-antiguedad/${encodeURIComponent(ccober.trim())}/${encodeURIComponent(ctarifa.trim())}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),
  /** Revisión «¿se puede emitir?» (solo lectura). */
  revisarSis2000Plan: (planId: string) =>
    request<Record<string, unknown>>(`/core/sis2000/plans/${encodeURIComponent(planId)}/revision`),

  // ── Configurador fase 2 «editar todo» (CONTRATO-CONFIGURADOR-FASE2): proxies 1:1; escrituras con respaldo previo ──
  // `motivoCambio` en el cuerpo es opcional (queda en el historial). Las respuestas se normalizan en lib/configurador-fase2.
  listarSis2000Frecuencias: (planId: string) => request<unknown>(`${rutaPlanF2(planId)}/frecuencias`),
  agregarSis2000Frecuencia: (planId: string, body: CuerpoF2) => enviar('POST', `${rutaPlanF2(planId)}/frecuencias`, body),
  editarSis2000Frecuencia: (planId: string, ifrecuencia: string, body: CuerpoF2) =>
    enviar('PATCH', `${rutaPlanF2(planId)}/frecuencias/${encodeURIComponent(ifrecuencia.trim())}`, body),
  listarSis2000FrecuenciasProductor: (planId: string) => request<unknown>(`${rutaPlanF2(planId)}/frecuencias-productor`),
  agregarSis2000FrecuenciaProductor: (planId: string, body: CuerpoF2) =>
    enviar('POST', `${rutaPlanF2(planId)}/frecuencias-productor`, body),
  /** Borra de verdad (la tabla no tiene estado); `ndias` elige la fila si el productor tiene la letra con varios días. */
  borrarSis2000FrecuenciaProductor: (planId: string, cproductor: string, ifrecuencia: string, motivoCambio?: string, ndias?: number | null) => {
    const qs = new URLSearchParams();
    if (motivoCambio) qs.set('motivo', motivoCambio);
    if (ndias != null) qs.set('ndias', String(ndias));
    const q = qs.toString();
    return enviar(
      'DELETE',
      `${rutaPlanF2(planId)}/frecuencias-productor/${encodeURIComponent(cproductor.trim())}/${encodeURIComponent(ifrecuencia.trim())}${q ? `?${q}` : ''}`,
    );
  },
  /** Lista paginada (query ya armada con consultaQuienVende). */
  listarSis2000QuienVende: (planId: string, query = '') => request<unknown>(`${rutaPlanF2(planId)}/quien-vende${query}`),
  resumenSis2000QuienVende: (planId: string) => request<unknown>(`${rutaPlanF2(planId)}/quien-vende/resumen`),
  agregarSis2000QuienVende: (planId: string, body: CuerpoF2) => enviar('POST', `${rutaPlanF2(planId)}/quien-vende`, body, 120_000),
  bajaSis2000QuienVende: (planId: string, body: CuerpoF2) => enviar('POST', `${rutaPlanF2(planId)}/quien-vende/baja`, body, 120_000),
  /** maproductos tal cual (nest-api propio): objeto o lista si el código se repite en varios ramos. */
  leerSis2000ProductoConfigurador: (cproducto: string) =>
    request<unknown>(`/core/sis2000/productos/${encodeURIComponent(cproducto.trim())}`),
  /** PATCH de maproductos (no cambia cproducto ni cramo; el cramo del cuerpo elige la fila). */
  editarSis2000Producto: (cproducto: string, body: CuerpoF2) =>
    enviar('PATCH', `/core/sis2000/productos/${encodeURIComponent(cproducto.trim())}`, body),
  /** Alta de producto con todos los campos de ProductoForm (sp_CrearProducto + igestor/xform). */
  crearSis2000ProductoCompleto: (body: CuerpoF2) => enviar('POST', '/core/sis2000/productos', body, 60_000),
  /** Cabecera del plan (versión vigente): xplan, cmoneda, cproducto, iestado. */
  editarSis2000CabeceraPlan: (planId: string, body: CuerpoF2) => enviar('PATCH', rutaPlanF2(planId), body),
  agregarSis2000CoberturaPlan: (planId: string, body: CuerpoF2) => enviar('POST', `${rutaPlanF2(planId)}/coberturas`, body),
  editarSis2000TarifaCoberturaPlan: (planId: string, ccobertura: string, ctarifa: string, body: CuerpoF2) =>
    enviar('PATCH', `${rutaPlanF2(planId)}/coberturas/${encodeURIComponent(ccobertura.trim())}/tarifas/${encodeURIComponent(ctarifa.trim())}`, body),
  bajaSis2000CoberturaPlan: (planId: string, ccobertura: string, body: CuerpoF2) =>
    enviar('POST', `${rutaPlanF2(planId)}/coberturas/${encodeURIComponent(ccobertura.trim())}/baja`, body),
  agregarSis2000CoberturaPersonas: (planId: string, body: CuerpoF2) => enviar('POST', `${rutaPlanF2(planId)}/coberturas-personas`, body),
  editarSis2000CoberturaPersonas: (planId: string, ccobertura: string, ctarifa: string, body: CuerpoF2) =>
    enviar(
      'PATCH',
      `${rutaPlanF2(planId)}/coberturas-personas/${encodeURIComponent(ccobertura.trim())}/tarifas/${encodeURIComponent(ctarifa.trim())}`,
      body,
    ),
  bajaSis2000CoberturaPersonas: (planId: string, ccobertura: string, body: CuerpoF2) =>
    enviar('POST', `${rutaPlanF2(planId)}/coberturas-personas/${encodeURIComponent(ccobertura.trim())}/baja`, body),
  listarSis2000Edades: (planId: string) => request<unknown>(`${rutaPlanF2(planId)}/edades`),
  guardarSis2000Edad: (planId: string, cparen: string | number, body: CuerpoF2) =>
    enviar('PUT', `${rutaPlanF2(planId)}/edades/${encodeURIComponent(String(cparen))}`, body),
  /** tipo: 'dispositivos' (madisseg, % de descuento) o 'sustancias' (masustac, % de recargo). */
  listarSis2000DescRec: (cramo: number, tipo: 'dispositivos' | 'sustancias') => request<unknown>(`${rutaRamoF2(cramo)}/${tipo}`),
  agregarSis2000DescRec: (cramo: number, tipo: 'dispositivos' | 'sustancias', body: CuerpoF2) =>
    enviar('POST', `${rutaRamoF2(cramo)}/${tipo}`, body),
  editarSis2000DescRec: (cramo: number, tipo: 'dispositivos' | 'sustancias', codigo: string, body: CuerpoF2) =>
    enviar('PATCH', `${rutaRamoF2(cramo)}/${tipo}/${encodeURIComponent(codigo.trim())}`, body),
  /** tabla: 'antiguedad' | 'reparto' | 'rango' (MATARIFA_*_NEXUS). */
  leerSis2000Condominio: (cramo: number, tabla: string) => request<unknown>(`${rutaRamoF2(cramo)}/condominio/${encodeURIComponent(tabla)}`),
  guardarSis2000Condominio: (cramo: number, tabla: string, body: CuerpoF2) =>
    enviar('PUT', `${rutaRamoF2(cramo)}/condominio/${encodeURIComponent(tabla)}`, body),
  listarSis2000TarifaDias: (planId: string) => request<unknown>(`${rutaPlanF2(planId)}/tarifa-dias`),
  guardarSis2000TarifaDias: (planId: string, ccober: string, ctarifa: string, body: CuerpoF2) =>
    enviar('PUT', `${rutaPlanF2(planId)}/tarifa-dias/${encodeURIComponent(ccober.trim())}/${encodeURIComponent(ctarifa.trim())}`, body),
  /** Auto configurable (macatvalores): tipo «tasa-diaria» (PLAN_TASA_DIARIA) o «deducibles» (PLAN_DEDUCIBLE). */
  leerSis2000AutoParametro: (planId: string, tipo: 'tasa-diaria' | 'deducibles') => request<unknown>(`${rutaPlanF2(planId)}/auto/${tipo}`),
  /** Upsert del plan; 409 si el DBA no creó el dominio o el cplan tiene fila de otro ramo. */
  guardarSis2000AutoParametro: (planId: string, tipo: 'tasa-diaria' | 'deducibles', body: CuerpoF2) =>
    enviar('PUT', `${rutaPlanF2(planId)}/auto/${tipo}`, body),
  /** bactivo 0 (no borra): el plan vuelve al cálculo de siempre. */
  desactivarSis2000AutoParametro: (planId: string, tipo: 'tasa-diaria' | 'deducibles', motivoCambio?: string) =>
    enviar('DELETE', `${rutaPlanF2(planId)}/auto/${tipo}${motivoCambio ? `?motivo=${encodeURIComponent(motivoCambio)}` : ''}`),
  /** Productores mancomunados del plan (PLAN_MANCOMUNADO, cualquier ramo). PUT: 409 si el DBA no creó el dominio. */
  leerSis2000Mancomunado: (planId: string) => request<unknown>(`${rutaPlanF2(planId)}/mancomunado`),
  guardarSis2000Mancomunado: (planId: string, body: CuerpoF2) => enviar('PUT', `${rutaPlanF2(planId)}/mancomunado`, body),
  desactivarSis2000Mancomunado: (planId: string, motivoCambio?: string) =>
    enviar('DELETE', `${rutaPlanF2(planId)}/mancomunado${motivoCambio ? `?motivo=${encodeURIComponent(motivoCambio)}` : ''}`),
  leerSis2000TasaCasco: (cramo: number) => request<unknown>(`/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tasa-casco`),
  /** Historial de versiones de la tasa de casco (global). */
  listarSis2000VersionesCasco: (cramo: number, limit = 50) => request<unknown>(`/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tasa-casco/versiones?limit=${limit}`),
  /** Vista previa de un ajuste porcentual (no escribe). */
  vistaPreviaSis2000Casco: (cramo: number, body: CuerpoF2) => enviar('POST', `/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tasa-casco/vista-previa`, body),
  /** Propuesta: AJUSTE (movimiento, porcentaje, alcance, filtros) o RESTAURACION (version_id); siempre con cusuario y motivo. */
  crearSis2000VersionCasco: (cramo: number, body: CuerpoF2) => enviar('POST', `/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tasa-casco/versiones`, body),
  /** Publicar = aprobar: { cusuario (distinto del que propuso), comentario? }. */
  publicarSis2000VersionCasco: (cramo: number, versionId: string, body: CuerpoF2) =>
    enviar('POST', `/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tasa-casco/versiones/${encodeURIComponent(versionId)}/publicar`, body),
  rechazarSis2000VersionCasco: (cramo: number, versionId: string, body: CuerpoF2) =>
    enviar('POST', `/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tasa-casco/versiones/${encodeURIComponent(versionId)}/rechazar`, body),
  cancelarSis2000VersionCasco: (cramo: number, versionId: string, body: CuerpoF2) =>
    enviar('POST', `/core/sis2000/auto/${encodeURIComponent(String(cramo))}/tasa-casco/versiones/${encodeURIComponent(versionId)}/cancelar`, body),

  // Planes maestro (spMantPlanes)
  listSis2000MasterPlans: () =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>('/core/sis2000/plans/master'),
  createSis2000MasterPlan: (body: Record<string, unknown>) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow>('/core/sis2000/plans', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSis2000MasterPlan: (id: string, body: Record<string, unknown>) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow>(
      `/core/sis2000/plans/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),
  deleteSis2000MasterPlan: (id: string) =>
    request<{ ok: boolean }>(`/core/sis2000/plans/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  /** Cotización de prueba (no emite). Personas: parentesco y edad (spCalculoPer). La tasa sale de mamonedas. */
  cotizarSis2000Plan: (
    cramo: number,
    cplan: string,
    ifrecuencia = 'A',
    personas?: { cparen: number; nedad: number; msumaaseg?: number },
  ) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>('/core/sis2000/plans/cotizar', {
      method: 'POST',
      body: JSON.stringify({ cramo, cplan, ifrecuencia, ...(personas ?? {}) }),
    }),
  listSis2000PlanFrecuencias: (cplan: string, cramo?: number) =>
    request<import('@/lib/sis2000-nest-api').Sis2000NestRow[]>('/core/sis2000/plans/frecuencias', {
      method: 'POST',
      body: JSON.stringify({ cplan, cramo }),
    }),
};
