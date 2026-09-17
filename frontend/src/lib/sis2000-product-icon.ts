import { publicAsset } from '@/lib/app-base';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

/** Nombre de archivo en maproductos.xdescripcion_c (icono marketplace Sis2000). */
export function sis2000ProductIconFileName(
  xdescripcion_c: string | null | undefined,
): string | null {
  const name = xdescripcion_c?.trim();
  if (!name || !IMAGE_EXT.test(name)) return null;
  return name;
}

/** URL bajo public/sis2000-icons/ (ej. 4_1.png → /producto-builder/sis2000-icons/4_1.png). */
export function sis2000ProductIconUrl(
  xdescripcion_c: string | null | undefined,
): string | null {
  const name = sis2000ProductIconFileName(xdescripcion_c);
  if (!name) return null;
  return publicAsset(`sis2000-icons/${name}`);
}
