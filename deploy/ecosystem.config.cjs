/** @type {import('pm2').StartOptions} */
const path = require('path');

const root = path.join(__dirname, '..');
const backendDir = path.join(root, 'backend');
// nest build emite src/ → dist/src/ (tsconfig incluye prisma/)
const entry = path.join(backendDir, 'dist', 'src', 'main.js');

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
        PORT: 3001,
      },
    },
  ],
};
