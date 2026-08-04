const CATALOG_FLOW_KEY = 'exelixi_catalog_flow';

export function isExelixiCatalogPublicFlow(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('flow') === 'exelixi-catalog') {
      sessionStorage.setItem(CATALOG_FLOW_KEY, '1');
      return true;
    }
    return sessionStorage.getItem(CATALOG_FLOW_KEY) === '1';
  } catch {
    return false;
  }
}

export const EXELIXI_OCR_HANDOFF_KEY = 'exelixi_ocr_handoff';

export type OcrDocType = 'cedula' | 'licencia' | 'certificado' | 'rif';

export interface OcrFields {
  nombre?: string;
  apellido?: string;
  identificacion?: string;
  tipoDoc?: string;
  placa?: string;
  marca?: string;
  modelo?: string;
  anio?: string;
  año?: string;
  serial?: string;
  color?: string;
  rif?: string;
  razonSocial?: string;
}

export interface ExelixiOcrHandoff {
  productId: string;
  product?: Record<string, unknown>;
  ocrData: Partial<Record<OcrDocType, OcrFields>>;
  savedAt: number;
}

export function readOcrHandoff(productId: string): ExelixiOcrHandoff | null {
  try {
    const raw = sessionStorage.getItem(EXELIXI_OCR_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExelixiOcrHandoff;
    if (parsed.productId !== productId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOcrHandoff(): void {
  try {
    sessionStorage.removeItem(EXELIXI_OCR_HANDOFF_KEY);
  } catch {
    /* ignore */
  }
}
