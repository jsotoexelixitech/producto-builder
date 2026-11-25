import { createElement, type ReactNode } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useAyudas } from './AyudasProvider';

type Props = { as?: 'ul' | 'tbody'; className?: string; children?: ReactNode };

function Animada({ as = 'ul', ...resto }: Props) {
  // auto-animate respeta prefers-reduced-motion por sí mismo.
  const [ref] = useAutoAnimate<HTMLElement>({ duration: 180 });
  return createElement(as, { ...resto, ref });
}

/** Lista de coberturas: con la vista con ayudas, al agregar o quitar elementos se mueven suavemente. En clásica es un ul/tbody normal. */
export function ListaAnimada(props: Props) {
  const { activas } = useAyudas();
  if (!activas) {
    const { as = 'ul', ...resto } = props;
    return createElement(as, resto);
  }
  return <Animada {...props} />;
}
