import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAyudas } from './AyudasProvider';

/**
 * Encabezado de página. En la vista Clásica es el mismo div de siempre; en Moderna toma la clase `lm-banda`
 * (banda medianoche con auroras, retícula y línea de escaneo, ver moderna-lm.css). Solo estilo.
 */
export function BandaPagina({ className, children }: { className?: string; children: ReactNode }) {
  const { activas } = useAyudas();
  return <div className={cn(className, activas && 'lm-banda')}>{children}</div>;
}
