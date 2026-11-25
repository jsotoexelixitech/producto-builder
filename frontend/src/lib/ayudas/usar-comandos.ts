import { useEffect, useRef } from 'react';
import { registrarComandos, type Comando } from './busqueda';
import { useAyudas } from '@/components/ayudas/AyudasProvider';

/** La pantalla ofrece sus comandos al buscador Ctrl+K mientras está abierta (solo con la vista con ayudas). */
export function useRegistrarComandos(clave: string, comandos: Comando[]) {
  const { activas } = useAyudas();
  const ultimo = useRef(comandos);
  ultimo.current = comandos;
  useEffect(() => {
    if (!activas) return undefined;
    return registrarComandos(clave, () => ultimo.current);
  }, [clave, activas]);
}
