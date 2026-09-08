import { BadRequestException } from '@nestjs/common';
import {
  ContractCurrency,
  Prisma,
  ProductBranch,
  RenewalFrequency,
} from '@prisma/client';
import { BRANCH_CORE_RAMO } from '../core/core.constants';

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
  xdescripcion_prod?: string | null;
  mmonto_inicial?: string | null;
  xfraccionamiento?: string | null;
  xurl_presentacion?: string | null;
  norden?: number | null;
  xdescripcion_c?: string | null;
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

export function dtoToPartnerPayload(dto: {
  cproducto: string;
  xdescripcion_l: string;
  xabreviatura: string;
  xform: string;
  iproductor: boolean;
  icanal: boolean;
  cramo: number;
  ctiporamo: number;
  xdescripcion_prod?: string | null;
  mmonto_inicial?: string | null;
  xfraccionamiento?: string | null;
  xurl_presentacion?: string | null;
  norden?: number | null;
  xdescripcion_c?: string | null;
}): PartnerProductPayload {
  return {
    cproducto: sanitizeCproducto(dto.cproducto),
    xdescripcion_l: dto.xdescripcion_l.trim(),
    xabreviatura: dto.xabreviatura.trim().toUpperCase().slice(0, 5),
    xform: dto.xform.trim(),
    iproductor: dto.iproductor,
    icanal: dto.icanal,
    cramo: dto.cramo,
    ctiporamo: dto.ctiporamo,
    xdescripcion_prod: dto.xdescripcion_prod?.trim() || null,
    mmonto_inicial: dto.mmonto_inicial?.trim() || null,
    xfraccionamiento: dto.xfraccionamiento?.trim() || null,
    xurl_presentacion: dto.xurl_presentacion?.trim() || null,
    norden: dto.norden ?? null,
    xdescripcion_c: dto.xdescripcion_c?.trim() || null,
  };
}

export function rowToPartnerForm(row: Record<string, unknown>) {
  return {
    cproducto: String(row.cproducto ?? '').trim(),
    xdescripcion_l: String(row.xdescripcion_l ?? '').trim(),
    xabreviatura: String(row.xabreviatura ?? '').trim(),
    xform: String(row.xform ?? 'persons').trim(),
    iproductor: row.iproductor === true || row.iproductor === 1,
    icanal: row.icanal === true || row.icanal === 1,
    cramo: Number(row.cramo ?? 0),
    ctiporamo: Number(row.ctiporamo ?? 0),
    xdescripcion_prod: row.xdescripcion_prod != null ? String(row.xdescripcion_prod) : '',
    mmonto_inicial: row.mmonto_inicial != null ? String(row.mmonto_inicial) : '',
    xfraccionamiento: row.xfraccionamiento != null ? String(row.xfraccionamiento) : '',
    xurl_presentacion: row.xurl_presentacion != null ? String(row.xurl_presentacion) : '',
    norden: row.norden != null ? Number(row.norden) : undefined,
    xdescripcion_c: row.xdescripcion_c != null ? String(row.xdescripcion_c) : '',
    ifuente: row.ifuente != null ? String(row.ifuente) : undefined,
    cprog: row.cprog != null ? String(row.cprog) : undefined,
    fingreso: row.fingreso != null ? String(row.fingreso) : undefined,
  };
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
