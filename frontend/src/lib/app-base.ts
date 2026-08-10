/** Base del router: sin barra final (React Router). Ej. `/producto-builder`. */
export function routerBase(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  if (base === '/') return '/';
  return base.replace(/\/+$/, '');
}

/** Base para assets/rutas: con barra final. Ej. `/producto-builder/`. */
export function normalizedBase(): string {
  const base = routerBase();
  return base === '/' ? '/' : `${base}/`;
}

/** Prefijo público de la API (Apache). En cierrelmds: `/producto-builder-api`. */
export function moduleApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_PUBLIC_BASE?.trim().replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv.startsWith('/') ? fromEnv : `/${fromEnv}`;
  }
  return '/producto-builder-api';
}

/** Ruta de un archivo en `public/` respetando el prefijo de despliegue. */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${normalizedBase()}${clean}`;
}

/** Ruta interna del SPA respetando `VITE_APP_BASE` (ej. `/producto-builder/login`). */
export function appRoute(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase()}${clean}`.replace(/\/{2,}/g, '/');
}
