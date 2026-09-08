export interface Sis2000Product {
  cproducto: string;
  xdescripcion_l: string;
  xabreviatura: string;
  xform: string;
  iproductor: boolean;
  icanal: boolean;
  cramo: number;
  ctiporamo: number;
  xdescripcion_prod?: string;
  mmonto_inicial?: string;
  xfraccionamiento?: string;
  xurl_presentacion?: string;
  norden?: number;
  xdescripcion_c?: string;
  ifuente?: string;
  cprog?: string;
  fingreso?: string;
}

export type Sis2000ProductInput = Omit<
  Sis2000Product,
  'ifuente' | 'cprog' | 'fingreso'
>;

export const SIS2000_XFORM_OPTIONS = [
  { value: 'persons', label: 'Personas' },
  { value: 'persons-ind', label: 'Personas individual' },
  { value: 'automobile', label: 'Automóvil / RCV' },
  { value: 'rcv-external', label: 'RCV externo (iframe)' },
  { value: 'traveler', label: 'Viajero local' },
  { value: 'alt-traveler', label: 'Viajero' },
  { value: 'general-risk', label: 'Riesgos generales' },
  { value: 'embarcaciones', label: 'Embarcaciones' },
] as const;

export const EMPTY_SIS2000_PRODUCT: Sis2000ProductInput = {
  cproducto: '',
  xdescripcion_l: '',
  xabreviatura: '',
  xform: 'persons',
  iproductor: true,
  icanal: true,
  cramo: 7,
  ctiporamo: 2,
  xdescripcion_prod: '',
  mmonto_inicial: '',
  xfraccionamiento: '',
  xurl_presentacion: '',
  norden: undefined,
  xdescripcion_c: '',
};

export function sis2000SourceLabel(p: Sis2000Product): string {
  if (p.ifuente === 'API') return 'API';
  if (p.ifuente === 'SQL') return 'Sis2000';
  return p.ifuente ?? '—';
}
