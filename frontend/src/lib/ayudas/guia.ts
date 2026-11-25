// Recorrido guiado del Combo («Ver guía»): pasos y preferencia de «ya la vi / no me la ofrezcas más». Puro: se prueba en node.
import type { AlmacenTexto } from './preferencia.ts';

export const CLAVE_GUIA_COMBO = 'ipb:guia-combo-vista';

export interface PasoGuia {
  /** Selector CSS del elemento que se resalta. */
  selector: string;
  titulo: string;
  texto: string;
}

export const PASOS_GUIA: PasoGuia[] = [
  {
    selector: 'nav[aria-label="Pasos"]',
    titulo: 'Los pasos del plan',
    texto: 'Aquí ves en qué paso vas. Puedes volver a cualquier paso que ya esté habilitado. Los últimos pasos se abren cuando el plan queda guardado.',
  },
  {
    selector: 'div[data-paso]:not([hidden])',
    titulo: 'Lo que llenas en cada paso',
    texto: 'En cada paso completas una parte del plan. El ícono (i) junto a un campo explica para qué sirve.',
  },
  {
    selector: 'aside[aria-label="Ayudas del plan"] [aria-label="¿Se puede emitir?"]',
    titulo: '¿Se puede emitir?',
    texto: 'Esta lista muestra qué está hecho y qué falta. Toca un punto para ir directo a ese paso.',
  },
  {
    selector: 'aside[aria-label="Ayudas del plan"] [aria-label="Antes de guardar"]',
    titulo: 'Antes de guardar',
    texto: 'Resume en palabras lo que se va a guardar, para que lo revises de un vistazo.',
  },
  {
    selector: 'aside[aria-label="Ayudas del plan"] [aria-label="Estimado de prima"]',
    titulo: 'Estimado de prima',
    texto: 'En planes de auto con tasa diaria puedes hacer una cuenta rápida. Es solo un estimado: la prima oficial la calcula Sis2000 al cotizar.',
  },
];

/** Deja solo los pasos cuyo elemento existe en pantalla ahora (por ejemplo, el estimado solo sale en planes de auto). */
export function pasosGuiaDisponibles(existe: (selector: string) => boolean): PasoGuia[] {
  return PASOS_GUIA.filter((p) => existe(p.selector));
}

/** true si ya se vio o se descartó la oferta de la guía. */
export function guiaYaVista(almacen: AlmacenTexto | null | undefined): boolean {
  try {
    return almacen?.getItem(CLAVE_GUIA_COMBO) === '1';
  } catch {
    return false;
  }
}

export function marcarGuiaVista(almacen: AlmacenTexto | null | undefined): void {
  try {
    almacen?.setItem(CLAVE_GUIA_COMBO, '1');
  } catch {
    // sin almacenamiento: se volverá a ofrecer, sin problema
  }
}
