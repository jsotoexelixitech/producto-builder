import { Car, Heart, Home, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import type { ProductBranch } from '@/types/product';

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTUARIAL_REVIEW: 'Revisión actuarial',
  SUBMITTED_TO_SUDEASEG: 'Enviado a SUDEASEG',
  APPROVED_ACTIVE: 'Aprobado / activo',
  REJECTED: 'Rechazado',
};

export const BRANCH_META: Record<
  ProductBranch,
  { label: string; short: string; icon: LucideIcon; color: string; ring: string }
> = {
  AUTOMOVIL: {
    label: 'Automóvil',
    short: 'Auto',
    icon: Car,
    color: 'bg-primary/10 text-primary',
    ring: 'ring-primary/20',
  },
  SALUD: {
    label: 'Salud',
    short: 'Salud',
    icon: Heart,
    color: 'bg-rose-500/10 text-rose-700',
    ring: 'ring-rose-500/20',
  },
  VIDA: {
    label: 'Vida',
    short: 'Vida',
    icon: ShieldCheck,
    color: 'bg-violet-500/10 text-violet-700',
    ring: 'ring-violet-500/20',
  },
  PATRIMONIAL: {
    label: 'Patrimonial',
    short: 'Patrim.',
    icon: Home,
    color: 'bg-amber-500/10 text-amber-800',
    ring: 'ring-amber-500/20',
  },
  INCLUSIVO: {
    label: 'Inclusivo',
    short: 'Inclusivo',
    icon: Users,
    color: 'bg-accent/10 text-accent',
    ring: 'ring-accent/20',
  },
  RCV_OBLIGATORIO: {
    label: 'RCV obligatorio',
    short: 'RCV',
    icon: Car,
    color: 'bg-sky-500/10 text-sky-800',
    ring: 'ring-sky-500/20',
  },
};

export const BRANCH_OPTIONS = Object.entries(BRANCH_META).map(([value, meta]) => ({
  value: value as ProductBranch,
  label: meta.label,
}));

export interface DocumentCatalogItem {
  key: string;
  label: string;
  hint: string;
}

export const DOCUMENT_CATALOG: DocumentCatalogItem[] = [
  { key: 'CEDULA', label: 'Cédula de identidad', hint: 'Documento de identidad del tomador o asegurado' },
  { key: 'RIF', label: 'RIF', hint: 'Registro de Información Fiscal' },
  { key: 'LICENCIA_CONDUCIR', label: 'Licencia de conducir', hint: 'Vigente y acorde al tipo de vehículo' },
  { key: 'CARNET_CIRCULACION', label: 'Carnet de circulación', hint: 'Título de propiedad / certificado del vehículo' },
  { key: 'CERTIFICADO_ORIGEN', label: 'Certificado de origen', hint: 'Vehículos nuevos o importados' },
  { key: 'FOTOS_VEHICULO', label: 'Fotografías del vehículo', hint: 'Registro fotográfico para inspección' },
  { key: 'PARTIDA_NACIMIENTO', label: 'Partida de nacimiento', hint: 'Beneficiarios o menores de edad' },
  { key: 'ACTA_MATRIMONIO', label: 'Acta de matrimonio', hint: 'Cónyuge como beneficiario' },
  { key: 'INFORME_MEDICO', label: 'Informe médico', hint: 'Declaración o examen de salud' },
  { key: 'CONSTANCIA_TRABAJO', label: 'Constancia de trabajo', hint: 'Verificación de ingresos u ocupación' },
  { key: 'COMPROBANTE_DOMICILIO', label: 'Comprobante de domicilio', hint: 'Servicio público reciente' },
  { key: 'CONTRATO_SERVICIO_FUNERARIO', label: 'Contrato de servicio funerario', hint: 'Planes funerarios / previsión' },
];

/**
 * Documentos preseleccionados por ramo. `true` = obligatorio, `false` = opcional.
 * El usuario puede modificar libremente estas selecciones en el wizard.
 */
export const DEFAULT_DOCUMENTS_BY_BRANCH: Record<ProductBranch, Record<string, boolean>> = {
  RCV_OBLIGATORIO: {
    CEDULA: true,
    CARNET_CIRCULACION: true,
    LICENCIA_CONDUCIR: true,
    RIF: false,
  },
  AUTOMOVIL: {
    CEDULA: true,
    CARNET_CIRCULACION: true,
    LICENCIA_CONDUCIR: true,
    FOTOS_VEHICULO: true,
    RIF: false,
    CERTIFICADO_ORIGEN: false,
  },
  SALUD: {
    CEDULA: true,
    INFORME_MEDICO: true,
    RIF: false,
  },
  VIDA: {
    CEDULA: true,
    RIF: true,
    INFORME_MEDICO: false,
    PARTIDA_NACIMIENTO: false,
  },
  PATRIMONIAL: {
    CEDULA: true,
    RIF: true,
    COMPROBANTE_DOMICILIO: true,
  },
  INCLUSIVO: {
    CEDULA: true,
    RIF: false,
  },
};
