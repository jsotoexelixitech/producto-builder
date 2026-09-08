import { BadRequestException } from '@nestjs/common';
import {
  ContractCurrency,
  Prisma,
  ProductBranch,
  RenewalFrequency,
} from '@prisma/client';
import { BRANCH_CORE_RAMO } from '../core/core.constants';
import {
  normalizeSis2000Row,
  sis2000RowToPayload,
} from '../core/sis2000-fields';

/** Payload esperado por nest-api `/api/v1/partner/products/*` (Gestacio / maproductos). */
export interface PartnerProductPayload {
  cproducto: string;
  xdescripcion_l: string;
  xabreviatura: string;
  xform: string;
  iproductor: boolean;
  icanal: boolean;
  cramo: number;
  ctiporamo: number;
  u_version?: string | null;
  xdescripcion_c?: string | null;
  xdescripcion_prod?: string | null;
  mmonto_inicial?: string | null;
  xfraccionamiento?: string | null;
  xurl_presentacion?: string | null;
  norden?: number | null;
  cusuario?: number | null;
  ccategoria?: number | null;
  cusuarioauto?: number | null;
  ccategoriaauto?: number | null;
  cusuariomod?: number | null;
  ccategoriamod?: number | null;
  bok?: boolean | null;
  cerror?: string | null;
  cprog?: string | null;
  ifuente?: string | null;
  fingreso?: string | null;
  fultmod?: string | null;
}

type ProductForPartner = Prisma.ProductGetPayload<{
  include: {
    coverages: true;
    productPlans: true;
    actuarialData: true;
    commercialChannels: true;
  };
}>;

const BRANCH_XFORM: Record<ProductBranch, string> = {
  AUTOMOVIL: 'automobile',
  RCV_OBLIGATORIO: 'automobile',
  SALUD: 'persons',
  VIDA: 'persons',
  PATRIMONIAL: 'general-risk',
  INCLUSIVO: 'persons',
};

const BRANCH_TIPO_RAMO: Record<ProductBranch, number> = {
  AUTOMOVIL: 7,
  RCV_OBLIGATORIO: 7,
  SALUD: 4,
  VIDA: 2,
  PATRIMONIAL: 6,
  INCLUSIVO: 2,
};

const RENEWAL_FRAC_LABEL: Partial<Record<RenewalFrequency, string>> = {
  ANUAL: 'Pago único anual',
  SEMESTRAL: 'Fraccionamiento Semestral / Anual',
  TRIMESTRAL: 'Fraccionamiento Mensual / Trimestral / Semestral / Anual',
  MENSUAL: 'Fraccionamiento Mensual / Trimestral / Semestral / Anual',
};

export function sanitizeCproducto(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  if (cleaned.length < 2) {
    throw new BadRequestException(
      `Código Sis2000 (cproducto) inválido: "${raw}". Use al menos 2 caracteres alfanuméricos (máx. 6).`,
    );
  }
  return cleaned;
}

export function resolveCproducto(
  coreProductCode: string | null | undefined,
  internalCode: string,
): string {
  if (coreProductCode?.trim()) {
    try {
      return sanitizeCproducto(coreProductCode);
    } catch {
      /* fallback a internalCode */
    }
  }
  return sanitizeCproducto(internalCode);
}

function toAbreviatura(internalCode: string): string {
  const cleaned = internalCode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);
  return cleaned.length >= 2 ? cleaned : 'PROD';
}

function formatMontoInicial(
  currency: ContractCurrency,
  amount?: number | null,
): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  const symbol =
    currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'VES' ? 'Bs' : '$';
  return `${amount.toFixed(2).replace('.', ',')}${symbol}`;
}

function buildDescripcionProd(product: ProductForPartner): string | null {
  const planNames = product.productPlans
    .map((p) => p.name?.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (planNames.length) return planNames.join(' · ');
  const coverageNames = product.coverages
    .map((c) => c.name?.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (coverageNames.length) return coverageNames.join(', ');
  return product.commercialName;
}

export function mapProductToPartnerPayload(
  product: ProductForPartner,
  cproducto: string,
): PartnerProductPayload {
  const ramoCode = Number.parseInt(BRANCH_CORE_RAMO[product.branch].code, 10);
  const premium = product.actuarialData
    ? Number(product.actuarialData.commercialPremium)
    : product.productPlans[0]?.priceFactor != null
      ? Number(product.productPlans[0].priceFactor)
      : null;

  const hasCanal = product.commercialChannels.length > 0;

  return {
    cproducto,
    xdescripcion_l: product.commercialName.trim().slice(0, 120),
    xabreviatura: toAbreviatura(product.internalCode),
    xform: BRANCH_XFORM[product.branch],
    iproductor: product.catalogVisible,
    icanal: hasCanal || product.catalogVisible,
    cramo: ramoCode,
    ctiporamo: BRANCH_TIPO_RAMO[product.branch],
    xdescripcion_prod: buildDescripcionProd(product),
    mmonto_inicial: formatMontoInicial(product.currency, premium),
    xfraccionamiento: product.renewalFrequency
      ? (RENEWAL_FRAC_LABEL[product.renewalFrequency] ?? null)
      : null,
    xurl_presentacion: null,
    norden: product.productPlans.length ? 1 : null,
    xdescripcion_c: null,
  };
}

export const SIS2000_XFORM_OPTIONS = [
  'persons',
  'persons-ind',
  'automobile',
  'rcv-external',
  'traveler',
  'alt-traveler',
  'general-risk',
  'embarcaciones',
] as const;

export function dtoToPartnerPayload(
  dto: Record<string, unknown>,
): PartnerProductPayload {
  const normalized = normalizeSis2000Row(dto);
  normalized.cproducto = sanitizeCproducto(String(dto.cproducto ?? ''));
  normalized.xabreviatura = String(dto.xabreviatura ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 5);
  normalized.xdescripcion_l = String(dto.xdescripcion_l ?? '').trim();
  normalized.xform = String(dto.xform ?? 'persons').trim();
  return sis2000RowToPayload(normalized) as unknown as PartnerProductPayload;
}

export function rowToPartnerForm(row: Record<string, unknown>) {
  return normalizeSis2000Row(row);
}

export function inferBranchFromPartnerRow(row: Record<string, unknown>): ProductBranch | null {
  const xform = String(row.xform ?? '').toLowerCase();
  if (xform.includes('auto') || xform.includes('rcv')) return 'RCV_OBLIGATORIO';
  if (xform.includes('general') || xform.includes('risk')) return 'PATRIMONIAL';
  if (xform.includes('person')) return 'SALUD';
  const cram = Number(row.cramo);
  if (cram === 18) return 'AUTOMOVIL';
  if (cram === 10) return 'PATRIMONIAL';
  if (cram === 9 || cram === 7) return 'SALUD';
  return null;
}
