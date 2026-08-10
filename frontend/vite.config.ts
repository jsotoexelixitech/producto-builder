import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage } from 'http';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Base pública canónica: `/producto-builder` (sin barra final en la URL). */
function canonicalBase(raw: string | undefined): string {
  const base = (raw ?? '/producto-builder').trim() || '/';
  if (base === '/') return '/';
  return base.replace(/\/+$/, '');
}

/** Vite exige `base` con `/` final para assets en subpath. */
function viteAssetBase(canonical: string): string {
  if (canonical === '/') return '/';
  return `${canonical}/`;
}

const publicBase = canonicalBase(process.env.VITE_APP_BASE);
const assetBase = viteAssetBase(publicBase);

/**
 * Sirve el SPA en `/producto-builder` sin forzar redirect visible a `/producto-builder/`.
 * Rewrite interno → el navegador conserva la URL sin barra final.
 */
function subpathRootRewrite(canonical: string, asset: string): Plugin {
  if (canonical === '/') {
    return { name: 'subpath-root-rewrite' };
  }

  const rewrite = (req: IncomingMessage, _res: unknown, next: () => void) => {
    const url = req.url ?? '';
    const pathOnly = url.split('?')[0]?.split('#')[0] ?? '';
    if (pathOnly !== canonical) {
      next();
      return;
    }
    const qIndex = url.indexOf('?');
    const suffix = qIndex >= 0 ? url.slice(qIndex) : '';
    req.url = `${asset}${suffix}`;
    next();
  };

  return {
    name: 'subpath-root-rewrite',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  base: assetBase,
  plugins: [react(), subpathRootRewrite(publicBase, assetBase)],
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  optimizeDeps: {
    include: ['@ipb/shared'],
  },
  build: {
    commonjsOptions: {
      include: [/packages\/shared/, /node_modules/],
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/producto-builder-api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  preview: {
    host: true,
    port: 5215,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/producto-builder-api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
});
