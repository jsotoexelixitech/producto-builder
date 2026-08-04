/** Base normalizada del SPA (Vite `base`). Ej. `/` o `/producto-builder/`. */
export function normalizedBase(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Prefijo público de la API (Apache). En cierrelmds: `/producto-builder-api`. */
export function moduleApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_PUBLIC_BASE?.trim().replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv.startsWith('/') ? fromEnv : `/${fromEnv}`;
  }
  return `${normalizedBase()}api`.replace(/\/{2,}/g, '/');
}

/** Ruta de un archivo en `public/` respetando el prefijo de despliegue. */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${normalizedBase()}${clean}`;
}
