/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    {
      name: 'producto-builder-api',
      cwd: './backend',
      script: 'dist/main.js',
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
