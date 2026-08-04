#!/usr/bin/env bash
# Deploy flujo /emitir en srv001 — pull, build, PM2 web+api
# Uso: cd ~/producto-builder && bash deploy/deploy-emitir-srv001.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull origin main

echo "==> npm install + build (cierrelmds: SPA + API con prefijos separados)"
npm install
export VITE_APP_BASE=/producto-builder/
export VITE_API_PUBLIC_BASE=/producto-builder-api
npm run build

echo "==> PM2 producto-builder-api + producto-builder-web"
pm2 delete producto-builder-api producto-builder-web 2>/dev/null || true
pm2 start "$ROOT/deploy/ecosystem.config.cjs"
pm2 save

echo ""
echo "==> URLs del flujo Exélixi (emisión genérica)"
echo "    cierrelmds:   https://cierrelmds.exelixitech.com/producto-builder/emitir"
echo "    Directo PM2:  http://192.168.8.120:5215/producto-builder/emitir"
echo ""
echo "    Si /producto-builder/ da 404 en cierrelmds, añadir al VHost SSL:"
echo "    sudo nano /etc/apache2/sites-available/cierrelmds.exelixitech.com-le-ssl.conf"
echo "    (pegar deploy/apache-cierrelmds-producto-builder.conf)"
echo "    sudo apache2ctl configtest && sudo systemctl reload apache2"
echo ""
echo "    Health API: curl -s https://cierrelmds.exelixitech.com/producto-builder-api/health"
echo "    Web:        curl -sI https://cierrelmds.exelixitech.com/producto-builder/emitir | head -3"
