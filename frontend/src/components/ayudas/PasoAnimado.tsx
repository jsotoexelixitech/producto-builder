import { useEffect, useRef, type ComponentProps } from 'react';
import { animate } from 'motion';
import { useAyudas } from './AyudasProvider';

type Props = Omit<ComponentProps<'div'>, 'hidden'> & { activo: boolean };

function reducirMovimiento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function PasoConTransicion({ activo, ...resto }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const antes = useRef(activo);
  useEffect(() => {
    if (activo && !antes.current && ref.current && !reducirMovimiento()) {
      animate(ref.current, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] }, { duration: 0.2, ease: 'easeOut' });
    }
    antes.current = activo;
  }, [activo]);
  return <div ref={ref} hidden={!activo} {...resto} />;
}

/**
 * Un paso del asistente: queda montado y oculto como siempre; con la vista con ayudas, al abrirse entra con una
 * transición corta (sin ella si el sistema pide menos movimiento). En vista clásica es el mismo <div> de antes.
 */
export function PasoAnimado(props: Props) {
  const { activas } = useAyudas();
  if (!activas) {
    const { activo, ...resto } = props;
    return <div hidden={!activo} {...resto} />;
  }
  return <PasoConTransicion {...props} />;
}
