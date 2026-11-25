import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAyudas } from '@/components/ayudas/AyudasProvider';

type Tipo = 'exito' | 'error' | 'info';

/**
 * Aviso complementario (toast) cuando `mensaje` cambia a un texto nuevo. NO reemplaza el mensaje en pantalla: solo
 * lo repite en una esquina. Sin la vista con ayudas no hace nada.
 */
export function useAvisoComplementario(mensaje: string | null | undefined, tipo: Tipo) {
  const { activas } = useAyudas();
  const ultimo = useRef<string | null>(null);
  useEffect(() => {
    const m = (mensaje ?? '').trim();
    if (!m) {
      ultimo.current = null;
      return;
    }
    if (m === ultimo.current) return;
    ultimo.current = m;
    if (!activas) return;
    if (tipo === 'exito') toast.success(m);
    else if (tipo === 'error') toast.error(m);
    else toast(m);
  }, [mensaje, tipo, activas]);
}
