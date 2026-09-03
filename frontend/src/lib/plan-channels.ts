import type { CommercialChannel } from '@/types/product';

export const PLAN_CHANNEL_TYPES = [
  { value: 'PUBLIC', label: 'Todos los canales (sin restricción)' },
  { value: 'CORREDOR', label: 'Corredor' },
  { value: 'CORRETAJE', label: 'Corretaje' },
  { value: 'CANAL', label: 'Canal de comercialización' },
  { value: 'PUNTO', label: 'Punto de comercialización' },
] as const;

export type PlanChannelType = (typeof PLAN_CHANNEL_TYPES)[number]['value'];

const TYPE_LABEL = new Map(PLAN_CHANNEL_TYPES.map((t) => [t.value, t.label]));

/** Persiste en ProductPlan.assignedChannel como `TIPO|nombre`. */
export function formatAssignedChannel(type: string, name: string): string | null {
  if (!type || type === 'PUBLIC') return null;
  const trimmed = name.trim();
  return trimmed ? `${type}|${trimmed}` : type;
}

export function parseAssignedChannel(value?: string | null): {
  type: PlanChannelType | string;
  name: string;
} {
  if (!value?.trim()) return { type: 'PUBLIC', name: '' };
  const pipe = value.indexOf('|');
  if (pipe === -1) {
    const known = TYPE_LABEL.has(value as PlanChannelType);
    return known
      ? { type: value as PlanChannelType, name: '' }
      : { type: 'CANAL', name: value.trim() };
  }
  const type = value.slice(0, pipe);
  const name = value.slice(pipe + 1).trim();
  if (TYPE_LABEL.has(type as PlanChannelType)) {
    return { type: type as PlanChannelType, name };
  }
  return { type: 'CANAL', name: value.trim() };
}

export function labelAssignedChannel(value?: string | null): string {
  if (!value?.trim()) return 'Todos los canales';
  const { type, name } = parseAssignedChannel(value);
  const typeLabel = TYPE_LABEL.get(type as PlanChannelType) ?? type;
  return name ? `${typeLabel}: ${name}` : typeLabel;
}

export function channelPickerOptions(
  commercialChannels: CommercialChannel[] = [],
): string[] {
  const fromProduct = commercialChannels.map((c) => c.name.trim()).filter(Boolean);
  return [...new Set(fromProduct)];
}
