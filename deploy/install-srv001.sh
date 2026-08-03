#!/usr/bin/env bash
# Instalación Producto Builder — srv001 (192.168.8.120)
# Uso: cd ~/producto-builder && bash deploy/install-srv001.sh
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

# srv001 — PostgreSQL nativo (deploy/setup-db-native.sql)
DATABASE_URL="postgresql://producto_builder:ProductoBuilder_2026!@127.0.0.1:5432/producto_builder?schema=public"
JWT_SECRET="cambiar-en-produccion-srv001"
FRONTEND_URL="http://192.168.8.120"
EOF
  echo "==> Revisa backend/.env (DATABASE_URL, JWT_SECRET)"
fi

# ── 3. PostgreSQL ───────────────────────────────────────────────────────────
setup_native_db() {
  echo "==> Creando BD nativa (pipe — postgres no lee ~/jsoto)..."
  cat "$ROOT/deploy/setup-db-native.sql" | sudo -u postgres psql
}

COMPOSE_FILE="$ROOT/deploy/docker-compose.db.yml"
DB_STARTED=false

if command -v docker-compose >/dev/null 2>&1; then
  if docker-compose -f "$COMPOSE_FILE" up -d 2>/dev/null; then
    DB_STARTED=true
  elif sudo docker-compose -f "$COMPOSE_FILE" up -d 2>/dev/null; then
    DB_STARTED=true
  fi
elif docker compose version >/dev/null 2>&1; then
  if docker compose -f "$COMPOSE_FILE" up -d 2>/dev/null; then
    DB_STARTED=true
  elif sudo docker compose -f "$COMPOSE_FILE" up -d 2>/dev/null; then
    DB_STARTED=true
  fi
fi

if [[ "$DB_STARTED" != "true" ]]; then
  echo "WARN: Docker no disponible o sin permisos — usando PostgreSQL nativo."
  setup_native_db
fi

echo "==> Verificando conexión a PostgreSQL..."
if ! PGPASSWORD='ProductoBuilder_2026!' psql -h 127.0.0.1 -U producto_builder -d producto_builder -c 'SELECT 1' >/dev/null 2>&1; then
  echo "WARN: Conexión fallida con usuario producto_builder — reintentando setup nativo..."
  setup_native_db
  sleep 2
  PGPASSWORD='ProductoBuilder_2026!' psql -h 127.0.0.1 -U producto_builder -d producto_builder -c 'SELECT 1' \
    || { echo "ERROR: No se pudo conectar a producto_builder. Revisa PostgreSQL en 127.0.0.1:5432"; exit 1; }
fi

# ── 4. Prisma ───────────────────────────────────────────────────────────────
npm run db:generate
(cd backend && npx prisma migrate deploy && npm run prisma:seed)

# ── 5. Build producción ─────────────────────────────────────────────────────
npm run build

MAIN_JS="$ROOT/backend/dist/src/main.js"
if [[ ! -f "$MAIN_JS" ]]; then
  echo "ERROR: No existe $MAIN_JS tras npm run build"
  echo "       Contenido de backend/dist:"
  ls -laR "$ROOT/backend/dist" 2>/dev/null || true
  exit 1
fi

# ── 6. PM2 ──────────────────────────────────────────────────────────────────
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete producto-builder-api 2>/dev/null || true
  pm2 start "$ROOT/deploy/ecosystem.config.cjs"
  pm2 save
  PORT="$(grep -E '^PORT=' backend/.env | cut -d= -f2 | tr -d '"' || echo 3001)"
  echo "==> API en http://127.0.0.1:${PORT}/api"
else
  echo "WARN: PM2 no instalado. Ejecuta: node backend/dist/src/main.js"
fi

echo ""
echo "==> Listo. Siguiente paso: Nginx (deploy/nginx-producto-builder.conf)"
echo "    Health: curl http://127.0.0.1:\${PORT:-3001}/api/health"
echo "    Login:  admin@local.test / admin123"
echo ""
echo "    nest-api (server-api-sys) — agregar en ~/server-api-sys/.env:"
echo "    PRODUCT_BUILDER_API_URL=http://127.0.0.1:\${PORT:-3001}"
echo "    PRODUCT_BUILDER_API_EMAIL=admin@local.test"
echo "    PRODUCT_BUILDER_API_PASSWORD=admin123"
