/** Prefijo de despliegue en cierrelmds (sin barra final). */
export const DEPLOY_BASE = '/producto-builder';

/** Base del router: sin barra final (React Router). Ej. `/producto-builder`. */
export function routerBase(): string {
  const fromBuild = import.meta.env.BASE_URL ?? '/';
  if (fromBuild !== '/' && fromBuild !== './') {
    return fromBuild.replace(/\/+$/, '') || '/';
  }

  // Fallback: build sin prefijo embebido pero servido bajo /producto-builder
  if (typeof window !== 'undefined') {
    const p = window.location.pathname;
    if (p === DEPLOY_BASE || p.startsWith(`${DEPLOY_BASE}/`)) {
      return DEPLOY_BASE;
    }
  }

  return '/';
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

/** Ruta interna del SPA respetando el prefijo (ej. `/producto-builder/login`). */
export function appRoute(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase()}${clean}`.replace(/\/{2,}/g, '/');
}

/** Path relativo al router (para `<Link to={...}>`). */
export function appPath(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean;
}
