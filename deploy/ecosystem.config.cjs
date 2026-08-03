/** @type {import('pm2').StartOptions} */
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const backendDir = path.join(root, 'backend');

// nest build con tsconfig que incluye src/ + prisma/ → dist/src/main.js
const entryCandidates = [
  path.join(backendDir, 'dist', 'src', 'main.js'),
  path.join(backendDir, 'dist', 'main.js'),
];
const entry = entryCandidates.find((p) => fs.existsSync(p));
if (!entry) {
  throw new Error(
    `No se encontró main.js. Ejecuta: cd ${root} && npm run build\n` +
      `Buscado: ${entryCandidates.join(', ')}`,
  );
}

// Cargar PORT desde backend/.env si existe
let port = 3001;
const envPath = path.join(backendDir, '.env');
if (fs.existsSync(envPath)) {
  const match = fs.readFileSync(envPath, 'utf8').match(/^PORT=(.+)$/m);
  if (match) port = Number(String(match[1]).replace(/["']/g, '')) || 3001;
}

module.exports = {
  apps: [
    {
      name: 'producto-builder-api',
      cwd: backendDir,
      script: entry,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: port,
      },
    },
  ],
};
