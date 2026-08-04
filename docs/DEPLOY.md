# Despliegue en servidor 192.168.8.120

Guía para instalar **Producto Builder** (frontend + API + PostgreSQL) en el servidor interno **srv120** (`192.168.8.120`).

Repositorio oficial: [jsotoexelixitech/producto-builder](https://github.com/jsotoexelixitech/producto-builder.git)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  Nginx (:80 / :8080)                                    │
│  ├── /          → frontend estático (Vite build)        │
│  └── /api/*     → proxy → NestJS (:3001)                │
└─────────────────────────────────────────────────────────┘
                              │
                    PostgreSQL (:5432)
```

---

## Requisitos del servidor

| Componente | Versión |
|------------|---------|
| Node.js | 20 LTS o 22 |
| npm | 10+ |
| PostgreSQL | 15+ |
| Git | 2.x |
| PM2 (opcional) | 5+ |
| Nginx (opcional) | 1.24+ |

---

## 1. Clonar repositorio

```bash
cd /opt
git clone https://github.com/jsotoexelixitech/producto-builder.git
cd producto-builder
npm install
```

---

## 2. Variables de entorno

```bash
cp backend/.env.example backend/.env
cp deploy/.env.production.example deploy/.env.production
```

Editar `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/producto_builder?schema=public"
PORT=3001
JWT_SECRET="generar-secreto-largo-aleatorio"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="http://192.168.8.120"
```

---

## 3. Base de datos

### Opción A — Docker (solo PostgreSQL)

En servidores con **Docker Compose v1** (comando con guión):

```bash
docker-compose -f deploy/docker-compose.db.yml up -d
```

En servidores con **Docker Compose v2** (plugin):

```bash
docker compose -f deploy/docker-compose.db.yml up -d
```

O ejecutar el script completo:

```bash
bash deploy/install-srv001.sh
```

Credenciales del contenedor (`deploy/docker-compose.db.yml`):

| Variable | Valor |
|----------|-------|
| Usuario | `producto_builder` |
| Contraseña | `ProductoBuilder_2026!` |
| Base de datos | `producto_builder` |

`backend/.env` debe coincidir:

```env
DATABASE_URL="postgresql://producto_builder:ProductoBuilder_2026!@127.0.0.1:5432/producto_builder?schema=public"
```

### Opción B — PostgreSQL nativo en srv001 (sin Docker, recomendado si Docker da permiso denegado)

El usuario `postgres` **no puede leer** `~/producto-builder` (home privado). Usar pipe o `/tmp`:

```bash
cd ~/producto-builder
cat deploy/setup-db-native.sql | sudo -u postgres psql
```

Alternativa:

```bash
cp deploy/setup-db-native.sql /tmp/setup-db-native.sql
sudo -u postgres psql -f /tmp/setup-db-native.sql
```

O SQL inline:

```bash
sudo -u postgres psql << 'SQL'
CREATE USER producto_builder WITH PASSWORD 'ProductoBuilder_2026!';
CREATE DATABASE producto_builder OWNER producto_builder;
GRANT ALL PRIVILEGES ON DATABASE producto_builder TO producto_builder;
SQL
```

Luego `backend/.env`:

```env
DATABASE_URL="postgresql://producto_builder:ProductoBuilder_2026!@127.0.0.1:5432/producto_builder?schema=public"
```

### Opción C — PostgreSQL ya instalado (manual)

```sql
CREATE DATABASE producto_builder;
CREATE USER producto_builder WITH ENCRYPTED PASSWORD 'tu_password';
GRANT ALL PRIVILEGES ON DATABASE producto_builder TO producto_builder;
```

### Migraciones y seed

```bash
npm run build -w packages/shared
npm run db:generate
cd backend && npx prisma migrate deploy && npm run prisma:seed
cd ..
```

**Usuario demo:** `admin@local.test` / `admin123` (cambiar en producción).

---

## 4. Build de producción

```bash
npm run build
```

Genera:
- `backend/dist/` — API NestJS
- `frontend/dist/` — SPA estática

---

## 5. Ejecutar con PM2

**Importante:** ejecutar desde la **raíz** del repo (`~/producto-builder`), no desde `backend/`:

```bash
cd ~/producto-builder
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

O con ruta absoluta (funciona desde cualquier directorio):

```bash
pm2 start ~/producto-builder/deploy/ecosystem.config.cjs
```

| Proceso | Puerto | Descripción |
|---------|--------|-------------|
| `producto-builder-api` | 3001 | API REST |
| `producto-builder-web` | 5215 | SPA (vite preview — rutas `/emitir`, etc.) |

Para producción con Nginx o Apache, proxy `/` → `:5215` y `/api/` → `:3001`.  
Ver `deploy/apache-producto-builder.conf`.

### Flujo emisión Exélixi (`/emitir`)

| URL | Cuándo |
|-----|--------|
| http://192.168.8.120:5215/emitir | Siempre (PM2 directo) |
| http://192.168.8.120/emitir | Tras configurar Apache (FallbackResource o proxy) |

Deploy rápido: `bash deploy/deploy-emitir-srv001.sh`

Variables en `backend/.env` para emisión:

```env
NEST_API_URL=http://127.0.0.1:3002
NEST_API_KEY=<NEST_ADMIN_TOKEN>
OCR_API_URL=http://127.0.0.1:4001
PRODUCT_BUILDER_PUBLIC_URL=http://192.168.8.120
```

Para producción con Nginx, servir `frontend/dist` y hacer proxy de `/api` a `:3001`.

---

## 6. Nginx (recomendado)

```bash
sudo cp deploy/nginx-producto-builder.conf /etc/nginx/sites-available/producto-builder
sudo ln -s /etc/nginx/sites-available/producto-builder /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Acceso: **http://192.168.8.120**

---

## 7. Verificación

```bash
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local.test","password":"admin123"}'
```

Swagger: `http://192.168.8.120/api/docs` (si Nginx expone el backend).

---

## Troubleshooting (srv001)

| Error | Causa | Solución |
|-------|--------|----------|
| `unknown shorthand flag: 'f'` | Docker sin plugin `compose` | Usar `docker-compose -f ...` (con guión) |
| `Permission denied` (Docker) | Usuario sin acceso al socket docker | `sudo docker-compose ...` o usar Postgres nativo (ver abajo) |
| `P1000 Authentication failed` | BD/usuario no creados (Docker no levantó) | `sudo -u postgres psql -f deploy/setup-db-native.sql` |
| `Script not found: .../dist/main.js` | Nest compila a `dist/src/main.js` | Actualizar repo (`git pull`) — PM2 ya corregido |

---

```bash
cd /opt/producto-builder
git pull origin main
npm install
npm run build -w packages/shared
npm run build
cd backend && npx prisma migrate deploy
pm2 restart all
```

---

## Puertos en srv120

| Servicio | Puerto | Notas |
|----------|--------|-------|
| Producto Builder (web) | 80 / 8080 | Nginx |
| Producto Builder API | 3001 | Interno |
| PostgreSQL | 5432 | Solo localhost |
| API RCV (otro servicio) | 3002 | No confundir |

---

## Soporte

**Exelixi Tech** — La Mundial de Seguros  
Documentación API: [`docs/API_CONTRATO_FRONTEND_BACKEND.md`](API_CONTRATO_FRONTEND_BACKEND.md)
