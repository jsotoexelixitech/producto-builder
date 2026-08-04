/** Base normalizada del SPA (Vite `base`). Ej. `/` o `/producto-builder/`. */
export function normalizedBase(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Prefijo de API REST bajo el mismo base path (Apache → producto-builder-api). */
export function moduleApiBase(): string {
  return `${normalizedBase()}api`.replace(/\/{2,}/g, '/');
}

/** Ruta de un archivo en `public/` respetando el prefijo de despliegue. */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${normalizedBase()}${clean}`;
}
