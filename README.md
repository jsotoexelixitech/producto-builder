# Producto Builder

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Motor de configuración de productos de seguros** para **La Mundial de Seguros**, alineado al marco regulatorio **SUDEASEG** (Venezuela).

Permite diseñar coberturas, planes comerciales, parámetros actuariales, documentación legal y flujos de emisión digital desde un wizard guiado de 7 pasos.

> Repositorio oficial: [github.com/jsotoexelixitech/producto-builder](https://github.com/jsotoexelixitech/producto-builder)  
> Mantenido por **Exelixi Tech**.

---

## Características

| Módulo | Descripción |
|--------|-------------|
| **Autenticación** | Login JWT, roles (ADMIN, PRODUCT_MANAGER, VIEWER, AUDITOR) |
| **Core** | Identificación comercial, ramo SUDEASEG, moneda, condiciones del plan |
| **Coberturas** | Builder con suma mín/máx, prima por cobertura, editar/eliminar |
| **Planes comerciales** | Planes con tarifas, activar/desactivar, precio = suma de primas |
| **Actuarial** | Variables de tarificación, prima comercial, actuario SUDEASEG |
| **Legal** | Exclusiones Art. 68, documentos del catálogo y personalizados |
| **Flujo de emisión** | Pasos configurables por ramo, formularios y vista previa |
| **Activación** | Resumen y transición de workflow hacia SUDEASEG |
| **Integración SISIP** | Ramo interno, contadores, máscaras de documentos |

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, React Hook Form |
| Backend | NestJS 11, JWT, Prisma ORM, Swagger |
| Base de datos | PostgreSQL 15+ |
| Validación compartida | `packages/shared` (Zod + guardrails) |

---

## Inicio rápido (desarrollo)

### Requisitos

- Node.js **20+**
- npm **10+**
- PostgreSQL **15+**

### Instalación

```bash
git clone https://github.com/jsotoexelixitech/producto-builder.git
cd producto-builder
npm install

npm run build -w packages/shared

cp backend/.env.example backend/.env
# Editar DATABASE_URL si es necesario

docker compose up -d          # PostgreSQL local
npm run db:generate
npm run db:migrate
npm run db:seed

npm run dev                   # API :3001 + SPA :5173
```

| Servicio | URL |
|----------|-----|
| Aplicación | http://localhost:5173 |
| API REST | http://localhost:3001/api |
| Swagger | http://localhost:3001/api/docs |
| Health | http://localhost:3001/api/health |

### Credenciales demo (seed)

| Campo | Valor |
|-------|-------|
| Email | `admin@local.test` |
| Contraseña | `admin123` |

---

## Despliegue en servidor

Guía completa para **192.168.8.120**: [`docs/DEPLOY.md`](docs/DEPLOY.md)

Incluye PostgreSQL, build de producción, PM2, Nginx y actualización.

---

## Estructura del monorepo

```
producto-builder/
├── backend/              # API NestJS + Prisma + Auth JWT
├── frontend/             # SPA React (wizard + dashboard)
├── packages/shared/      # Schemas Zod y guardrails
├── deploy/               # Nginx, PM2, Docker DB producción
├── docs/                 # Contrato API, arquitectura, despliegue
└── docker-compose.yml    # PostgreSQL desarrollo
```

---

## API principal

```
POST   /api/auth/login          # Público
GET    /api/auth/me             # Bearer JWT
GET    /api/health              # Público

GET    /api/products            # JWT
POST   /api/products
GET    /api/products/:id
PATCH  /api/products/:id

PUT    /api/products/:id/coverages
PUT    /api/products/:id/plans
PUT    /api/products/:id/actuarial
PUT    /api/products/:id/legal
GET/PUT /api/products/:id/emission-config
GET/PUT /api/products/:id/sisip
GET    /api/products/:id/workflow/validate-submission
POST   /api/products/:id/workflow/transition
```

Contrato detallado: [`docs/API_CONTRATO_FRONTEND_BACKEND.md`](docs/API_CONTRATO_FRONTEND_BACKEND.md)

---

## Wizard de producto (7 pasos)

| Paso | Contenido |
|------|-----------|
| 0 | Identificación del producto |
| 1 | Coberturas |
| 2 | Planes comerciales |
| 3 | Actuarial |
| 4 | Legal |
| 5 | Integración SISIP |
| 6 | Flujo de emisión |
| 7 | Activación |

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Backend + frontend en desarrollo |
| `npm run build` | Build shared + backend + frontend |
| `npm run db:generate` | Cliente Prisma |
| `npm run db:migrate` | Migraciones (dev) |
| `npm run db:seed` | Admin demo + producto RCV |

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Instalación en srv120 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura técnica |
| [`docs/API_CONTRATO_FRONTEND_BACKEND.md`](docs/API_CONTRATO_FRONTEND_BACKEND.md) | Contrato REST |
| [`AGENTS.md`](AGENTS.md) | Guía para agentes IA (Cursor) |

---

## Licencia

[MIT](LICENSE) © 2026 Exelixi Tech
