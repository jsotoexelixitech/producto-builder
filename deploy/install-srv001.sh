#!/usr/bin/env bash
# Instalación Producto Builder — srv001 (192.168.8.120)
# Uso: bash deploy/install-srv001.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Raíz del proyecto: $ROOT"

# ── 1. Dependencias y shared ────────────────────────────────────────────────
npm install
npm run build -w packages/shared

# ── 2. .env ─────────────────────────────────────────────────────────────────
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
fi

if ! grep -q 'producto_builder' backend/.env 2>/dev/null; then
  cat >> backend/.env << 'EOF'

# srv001 — PostgreSQL Docker (deploy/docker-compose.db.yml)
DATABASE_URL="postgresql://producto_builder:ProductoBuilder_2026!@127.0.0.1:5432/producto_builder?schema=public"
JWT_SECRET="cambiar-en-produccion"
FRONTEND_URL="http://192.168.8.120"
EOF
  echo "==> Revisa backend/.env (DATABASE_URL, JWT_SECRET)"
fi

# ── 3. PostgreSQL Docker ───────────────────────────────────────────────────
COMPOSE_FILE="$ROOT/deploy/docker-compose.db.yml"
if command -v docker-compose >/dev/null 2>&1; then
  docker-compose -f "$COMPOSE_FILE" up -d
elif docker compose version >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" up -d
else
  echo "WARN: Docker Compose no encontrado. Usa PostgreSQL ya instalado en el servidor."
  echo "      Crea DB/usuario y ajusta DATABASE_URL en backend/.env"
fi

echo "==> Esperando PostgreSQL..."
sleep 6

# ── 4. Prisma ───────────────────────────────────────────────────────────────
npm run db:generate
(cd backend && npx prisma migrate deploy && npm run prisma:seed)

# ── 5. Build producción ─────────────────────────────────────────────────────
npm run build

# ── 6. PM2 ──────────────────────────────────────────────────────────────────
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete producto-builder-api 2>/dev/null || true
  pm2 start "$ROOT/deploy/ecosystem.config.cjs"
  pm2 save
  echo "==> API en http://127.0.0.1:3001/api"
else
  echo "WARN: PM2 no instalado. Ejecuta: node backend/dist/main.js"
fi

echo ""
echo "==> Listo. Siguiente paso: Nginx (deploy/nginx-producto-builder.conf)"
echo "    Health: curl http://127.0.0.1:3001/api/health"
echo "    Login:  admin@local.test / admin123"
