# Servidor API — JorgeDuranAlcala/product-builder

> **Nota:** No existe ningún repo "nest-api". Eso fue un error de búsqueda anterior.  
> El backend de Jorge es este: https://github.com/JorgeDuranAlcala/product-builder

Repositorio clonado en: **`server-api/`** (nombre local; el repo en GitHub se llama `product-builder`)

---

## Estado local

| Item | Valor |
|------|-------|
| API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/docs |
| Health | http://localhost:3000/api/v1/health |
| Base de datos | `products_config` en PostgreSQL local (puerto 5432) |
| Seed admin | `admin@local.test` / `admin123` |

---

## Cómo levantarlo

```powershell
cd server-api
Copy-Item .env.example .env
# Ajustar DATABASE_URL a tu PostgreSQL local

npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

**Login (obtener token JWT):**

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "admin@local.test", "password": "admin123" }
```

Usar el `accessToken` en mutaciones:

```http
Authorization: Bearer <token>
```

---

## ⚠️ Compatibilidad con el frontend actual

El frontend de este monorepo (`frontend/src/lib/api.ts`) **no es compatible directamente** con esta API.

| Aspecto | Frontend actual | API de Jorge |
|---------|-----------------|--------------|
| Prefijo | `/api` | `/api/v1` |
| Puerto (dev) | 3001 (proxy Vite) | 3000 |
| Auth | Sin JWT | JWT Bearer obligatorio |
| Modelo | Wizard SUDEASEG (7 pasos) | Flujo SISIP (6 pasos técnicos) |
| IDs producto | UUID string | Integer |
| Crear producto | `POST /products` | `POST /products/wizard` |
| Coberturas | `PUT /products/:id/coverages` | Dentro de `full-config` |
| Planes / actuarial / legal / emisión | Endpoints separados | No existen igual |
| Workflow SUDEASEG | `workflow/transition` | `certify`, `emit-preview` |

### Qué hacer para integrar

**Opción A — Recomendada:** Jorge implementa el contrato documentado en  
`docs/API_CONTRATO_FRONTEND_BACKEND.md` (endpoints que ya consume el UI).

**Opción B:** Adaptar el frontend a la API SISIP de Jorge (cambio grande en `api.ts` y wizard).

**Opción C:** Capa BFF/adapter en Nest que traduzca `/api/*` → `/api/v1/*`.

Mientras tanto, para desarrollo del **UI actual**, seguir usando el backend del monorepo:

```powershell
npm run dev -w backend   # puerto 3001, /api
npm run dev -w frontend  # puerto 5173
```

---

## Endpoints principales (API Jorge)

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/auth/login` | Público |
| GET | `/health` | Público |
| GET | `/products` | JWT |
| POST | `/products/wizard` | JWT |
| GET | `/products/:id/full-config` | JWT |
| PUT | `/products/:id/full-config` | JWT |
| GET | `/products/:id/emit-preview` | JWT |
| POST | `/products/:id/certify` | JWT |
| POST | `/branches/wizard` | JWT |

Ver Swagger para payloads completos.

---

## Notas

- `server-api/.env` está en `.gitignore` (credenciales locales).
- Si usas Docker: `docker compose up -d` en `server-api/` (PostgreSQL en puerto **5433** para no chocar con el del monorepo).
- El backend original del monorepo (`backend/`) sigue en puerto **3001** con BD `insurance_product_builder`.
