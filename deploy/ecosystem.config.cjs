/** @type {import('pm2').StartOptions} */
const path = require('path');

const root = path.join(__dirname, '..');
const backendDir = path.join(root, 'backend');

module.exports = {
  apps: [
    {
      name: 'producto-builder-api',
      cwd: backendDir,
      script: path.join(backendDir, 'dist', 'main.js'),
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
