import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Base Vite siempre con `/` final — igual que Apache ProxyPass /producto-builder/ */
function normalizeAppBase(raw: string | undefined): string {
  const base = (raw ?? '/producto-builder/').trim() || '/';
  if (base === '/') return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

const appBase = normalizeAppBase(process.env.VITE_APP_BASE);

/** Redirige /producto-builder → /producto-builder/ (URL canónica en cierrelmds). */
function subpathTrailingSlash(base: string): Plugin {
  const withoutSlash = base.replace(/\/$/, '');
  if (!withoutSlash || base === '/') {
    return { name: 'subpath-trailing-slash' };
  }

  const redirect = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? '';
    const pathOnly = url.split('?')[0]?.split('#')[0] ?? '';
    if (pathOnly !== withoutSlash) {
      next();
      return;
    }
    const qIndex = url.indexOf('?');
    const suffix = qIndex >= 0 ? url.slice(qIndex) : '';
    res.writeHead(301, { Location: `${base}${suffix}` });
    res.end();
  };

  return {
    name: 'subpath-trailing-slash',
    configureServer(server) {
      server.middlewares.use(redirect);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect);
    },
  };
}

export default defineConfig({
  base: appBase,
  plugins: [react(), subpathTrailingSlash(appBase)],
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
