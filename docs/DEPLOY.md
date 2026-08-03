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

```bash
docker compose -f deploy/docker-compose.db.yml up -d
```

### Opción B — PostgreSQL instalado en el servidor

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

```bash
npm install -g pm2
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

| Proceso | Puerto | Descripción |
|---------|--------|-------------|
| `producto-builder-api` | 3001 | API REST |
| `producto-builder-web` | 5173 | Preview estático (solo dev interno) |

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

## 8. Actualizar versión

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
