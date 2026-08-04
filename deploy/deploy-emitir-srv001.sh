#!/usr/bin/env bash
# Deploy flujo /emitir en srv001 — pull, build, PM2 web+api
# Uso: cd ~/producto-builder && bash deploy/deploy-emitir-srv001.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull origin main

echo "==> npm install + build"
npm install
npm run build

echo "==> PM2 producto-builder-api + producto-builder-web"
pm2 delete producto-builder-api producto-builder-web 2>/dev/null || true
pm2 start "$ROOT/deploy/ecosystem.config.cjs"
pm2 save

echo ""
echo "==> URLs del flujo Exélixi (emisión genérica)"
echo "    Directo PM2:  http://192.168.8.120:5215/emitir"
echo "    Tras Apache:  http://192.168.8.120/emitir"
echo ""
echo "    Si /emitir da 404 en :80, habilitar Apache:"
echo "    sudo cp deploy/apache-producto-builder.conf /etc/apache2/sites-available/producto-builder.conf"
echo "    sudo a2enmod proxy proxy_http && sudo a2ensite producto-builder.conf"
echo "    sudo apache2ctl configtest && sudo systemctl reload apache2"
echo ""
echo "    Health API: curl -s http://127.0.0.1:3001/api/health"
echo "    Web:        curl -sI http://127.0.0.1:5215/emitir | head -3"
