import { ProductBranch } from '@prisma/client';

/** Mapeo ramo SUDEASEG → código CORE (Sis2000). */
export const BRANCH_CORE_RAMO: Record<
  ProductBranch,
  { code: string; name: string }
> = {
  AUTOMOVIL: { code: '18', name: 'Automóvil' },
  RCV_OBLIGATORIO: { code: '18', name: 'RCV Obligatorio' },
  SALUD: { code: '9', name: 'Salud' },
  VIDA: { code: '7', name: 'Vida' },
  PATRIMONIAL: { code: '10', name: 'Patrimonial' },
  INCLUSIVO: { code: '22', name: 'Inclusivo' },
};

export const DEFAULT_SUB_BRANCHES: Array<{
  branch: ProductBranch;
  code: string;
  name: string;
}> = [
  { branch: 'AUTOMOVIL', code: 'PARTICULAR', name: 'Particular' },
  { branch: 'AUTOMOVIL', code: 'CARGA', name: 'Carga' },
  { branch: 'AUTOMOVIL', code: 'MOTOCICLETA', name: 'Motocicleta' },
  { branch: 'RCV_OBLIGATORIO', code: 'RCV', name: 'RCV obligatorio' },
  { branch: 'SALUD', code: 'INDIVIDUAL', name: 'Salud individual' },
  { branch: 'SALUD', code: 'COLECTIVO', name: 'Salud colectivo' },
  { branch: 'VIDA', code: 'INDIVIDUAL', name: 'Vida individual' },
  { branch: 'VIDA', code: 'COLECTIVO', name: 'Vida colectivo' },
  { branch: 'PATRIMONIAL', code: 'INCENDIO', name: 'Incendio' },
  { branch: 'PATRIMONIAL', code: 'ROBO', name: 'Robo' },
  { branch: 'PATRIMONIAL', code: 'MULTIRIESGO', name: 'Multirriesgo' },
  { branch: 'PATRIMONIAL', code: 'PASTORA', name: 'La Pastora' },
  { branch: 'INCLUSIVO', code: 'GENERAL', name: 'General inclusivo' },
];

export const DEFAULT_CORE_COVERAGES: Array<{
  branch: ProductBranch;
  subBranchCode?: string;
  code: string;
  name: string;
  accountingCode?: string;
}> = [
  { branch: 'RCV_OBLIGATORIO', subBranchCode: 'RCV', code: 'RCV-DT', name: 'Daños a terceros', accountingCode: '18-01' },
  { branch: 'RCV_OBLIGATORIO', subBranchCode: 'RCV', code: 'RCV-AP', name: 'Accidentes personales', accountingCode: '18-02' },
  { branch: 'AUTOMOVIL', subBranchCode: 'PARTICULAR', code: 'AUTO-CASCO', name: 'Casco', accountingCode: '18-10' },
  { branch: 'AUTOMOVIL', subBranchCode: 'PARTICULAR', code: 'AUTO-RCV', name: 'RCV ampliada', accountingCode: '18-11' },
  { branch: 'AUTOMOVIL', subBranchCode: 'MOTOCICLETA', code: 'MOTO-RCV', name: 'RCV motocicleta', accountingCode: '18-20' },
  { branch: 'SALUD', subBranchCode: 'INDIVIDUAL', code: 'SAL-HOSP', name: 'Hospitalización', accountingCode: '09-01' },
  { branch: 'SALUD', subBranchCode: 'INDIVIDUAL', code: 'SAL-AMB', name: 'Ambulatorio', accountingCode: '09-02' },
  { branch: 'PATRIMONIAL', subBranchCode: 'INCENDIO', code: 'PAT-INC', name: 'Incendio y líneas aliadas', accountingCode: '10-01' },
  { branch: 'PATRIMONIAL', subBranchCode: 'INCENDIO', code: 'PAT-ROBO', name: 'Robo con violencia', accountingCode: '10-02' },
  { branch: 'PATRIMONIAL', subBranchCode: 'PASTORA', code: 'PAS-BAS', name: 'Cobertura básica Pastora', accountingCode: '10-50' },
  { branch: 'PATRIMONIAL', subBranchCode: 'PASTORA', code: 'PAS-ADIC', name: 'Cobertura adicional Pastora', accountingCode: '10-51' },
  { branch: 'VIDA', subBranchCode: 'INDIVIDUAL', code: 'VIDA-BAS', name: 'Vida básica', accountingCode: '07-01' },
  { branch: 'INCLUSIVO', subBranchCode: 'GENERAL', code: 'INC-GEN', name: 'Cobertura inclusiva general', accountingCode: '22-01' },
];
