import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const appBase = process.env.VITE_APP_BASE ?? '/';

export default defineConfig({
  base: appBase,
  plugins: [react()],
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
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  preview: {
    host: true,
    port: 5215,
    allowedHosts: true,
    proxy: {
      [`${appBase.replace(/\/$/, '')}/api`]: {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${appBase.replace(/\/$/, '')}/api`), '/api'),
      },
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
});
