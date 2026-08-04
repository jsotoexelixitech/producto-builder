import type { Product, ProductBranch } from '@/types/product';
import { DEFAULT_DOCUMENTS_BY_BRANCH, DOCUMENT_CATALOG } from '@/lib/constants';

export type OcrDocType = 'cedula' | 'licencia' | 'certificado' | 'rif';

const KEY_TO_OCR: Record<string, OcrDocType | null> = {
  CEDULA: 'cedula',
  LICENCIA_CONDUCIR: 'licencia',
  CARNET_CIRCULACION: 'certificado',
  CERTIFICADO_ORIGEN: 'certificado',
  RIF: 'rif',
};

export interface EmissionDocSlot {
  key: string;
  label: string;
  ocrType: OcrDocType;
  required: boolean;
}

export function resolveEmissionDocuments(product: Product): EmissionDocSlot[] {
  let source: { documentKey: string; label: string; required: boolean }[];

  if (product.requiredDocuments?.length) {
    source = product.requiredDocuments.map((d) => ({
      documentKey: d.documentKey,
      label: d.label,
      required: d.required !== false,
    }));
  } else {
    const defaults = DEFAULT_DOCUMENTS_BY_BRANCH[product.branch] ?? { CEDULA: true };
    source = Object.entries(defaults).map(([documentKey, required]) => {
      const catalog = DOCUMENT_CATALOG.find((c) => c.key === documentKey);
      return {
        documentKey,
        label: catalog?.label ?? documentKey,
        required,
      };
    });
  }

  const seen = new Set<OcrDocType>();
  const slots: EmissionDocSlot[] = [];

  for (const doc of source) {
    const ocrType = KEY_TO_OCR[doc.documentKey];
    if (!ocrType || seen.has(ocrType)) continue;
    seen.add(ocrType);
    slots.push({
      key: doc.documentKey,
      label: doc.label,
      ocrType,
      required: doc.required !== false,
    });
  }

  if (!slots.length) {
    return [{ key: 'CEDULA', label: 'Cédula de identidad', ocrType: 'cedula', required: true }];
  }
  return slots;
}

export function branchHasVehicle(branch: ProductBranch): boolean {
  return branch === 'AUTOMOVIL' || branch === 'RCV_OBLIGATORIO';
}

export function resolvePolicyTemplate(
  branch: ProductBranch,
  productName: string,
): 'automovil' | 'salud' | 'funerario' | 'personas' {
  const blob = productName.toUpperCase();
  if (branch === 'SALUD') return 'salud';
  if (blob.includes('FUNER') || blob.includes('GASTOS FUNER')) return 'funerario';
  if (branch === 'VIDA' || blob.includes('ACCIDENT') || blob.includes('PERSONAS')) {
    return 'personas';
  }
  return 'automovil';
}

export interface OcrFields {
  nombre?: string;
  apellido?: string;
  identificacion?: string;
  tipoDoc?: string;
  placa?: string;
  marca?: string;
  modelo?: string;
  anio?: string;
  serial?: string;
  color?: string;
  rif?: string;
  razonSocial?: string;
}

export interface EmissionFormData {
  tomadorNombre: string;
  tomadorId: string;
  aseguradoNombre: string;
  aseguradoId: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: string;
  serial: string;
  color: string;
}

export function buildFormFromOcr(
  ocrByType: Partial<Record<OcrDocType, OcrFields>>,
): EmissionFormData {
  const cedula = ocrByType.cedula ?? {};
  const cert = ocrByType.certificado ?? {};
  const rif = ocrByType.rif ?? {};

  const nombre = [cedula.nombre, cedula.apellido].filter(Boolean).join(' ').trim();
  const tipoDoc = cedula.tipoDoc ?? 'V';
  const idNum = cedula.identificacion ?? rif.rif?.replace(/^J-/i, '') ?? '';
  const identificacion =
    idNum.includes('-') || /^[VEJG]/i.test(idNum)
      ? idNum.toUpperCase()
      : `${tipoDoc}-${idNum}`;

  return {
    tomadorNombre: nombre || rif.razonSocial || 'TOMADOR PENDIENTE',
    tomadorId: identificacion || 'V-00000000',
    aseguradoNombre: nombre || 'ASEGURADO PENDIENTE',
    aseguradoId: identificacion || 'V-00000000',
    placa: cert.placa ?? '',
    marca: cert.marca ?? '',
    modelo: cert.modelo ?? '',
    anio: cert.anio ?? '',
    serial: cert.serial ?? '',
    color: cert.color ?? '',
  };
}

export function buildRiskData(
  product: Product,
  form: EmissionFormData,
): Record<string, unknown> {
  const risk: Record<string, unknown> = {};
  const vehicle = branchHasVehicle(product.branch);

  if (vehicle) {
    risk.Placa = form.placa;
    risk.Marca = form.marca;
    risk.Modelo = form.modelo;
    risk.Año = form.anio;
    risk.Serial = form.serial;
    risk.Color = form.color;
    risk.placa = form.placa;
    risk.marca = form.marca;
    risk.modelo = form.modelo;
    risk.anio = form.anio;
    risk.serial = form.serial;
    risk.color = form.color;
  }

  for (const field of product.formFields ?? []) {
    if (field.stepKey && field.stepKey !== 'RISK_DATA') continue;
    const key = field.label;
    if (risk[key] != null) continue;
    if (vehicle && /placa|marca|modelo|serial|color|año/i.test(key)) {
      if (/placa/i.test(key)) risk[key] = form.placa;
      else if (/marca/i.test(key)) risk[key] = form.marca;
      else if (/modelo/i.test(key)) risk[key] = form.modelo;
      else if (/serial|vin/i.test(key)) risk[key] = form.serial;
      else if (/color/i.test(key)) risk[key] = form.color;
      else if (/año|anio/i.test(key)) risk[key] = form.anio;
    }
  }

  return risk;
}
