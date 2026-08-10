/** Prefijo Apache + Vite: `/producto-builder/` (con barra final). */
export const DEPLOY_BASE = '/producto-builder/';

/** Base del router (React Router basename, sin barra final). */
export function routerBase(): string {
  const fromBuild = import.meta.env.BASE_URL ?? '/';
  if (fromBuild !== '/' && fromBuild !== './') {
    return fromBuild.replace(/\/+$/, '') || '/';
  }
  if (typeof window !== 'undefined') {
    const p = window.location.pathname;
    if (p === '/producto-builder' || p.startsWith('/producto-builder/')) {
      return '/producto-builder';
    }
  }
  return '/';
}

/** Base con barra final para assets y window.location. */
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

export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${normalizedBase()}${clean}`;
}

/** Ruta absoluta del SPA (ej. `/producto-builder/login`). */
export function appRoute(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase()}${clean}`.replace(/\/{2,}/g, '/');
}

/** Fuerza barra final en la raíz del módulo (/producto-builder/). */
export function ensureTrailingSlashOnRoot(): void {
  if (typeof window === 'undefined') return;
  const root = normalizedBase();
  const rootNoSlash = root.replace(/\/$/, '');
  if (window.location.pathname === rootNoSlash) {
    window.history.replaceState(
      null,
      '',
      `${root}${window.location.search}${window.location.hash}`,
    );
  }
}
