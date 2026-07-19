# Products Builder

[![CI](https://github.com/jsotoexelixitech/products-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/jsotoexelixitech/products-builder/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Motor de configuración de productos de seguros** alineado al marco regulatorio **SUDEASEG** (Venezuela). Permite diseñar coberturas, planes comerciales, datos actuariales, documentación legal y flujos de emisión digital desde un wizard guiado.

> Repositorio mantenido por [Exelixi Tech](https://github.com/jsotoexelixitech).

---

## Características

| Módulo | Descripción |
|--------|-------------|
| **Core** | Identificación comercial, ramo SUDEASEG, moneda, vigencia y tipo de emisión |
| **Coberturas** | Builder con cobertura básica obligatoria y suma asegurada |
| **Planes comerciales** | Planes con coberturas seleccionables del producto |
| **Actuarial** | Variables de tarificación, prima comercial y actuario registrado SUDEASEG |
| **Legal** | Exclusiones (Art. 68), documentos requeridos y condiciones |
| **Flujo de emisión** | Pasos configurables, formularios por paso y vista previa del journey |
| **Workflow** | Máquina de estados con guardrails antes del envío a SUDEASEG |

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, React Hook Form, Zod |
| Backend | NestJS 11, class-validator, Prisma ORM |
| Base de datos | PostgreSQL 15+ |
| Validación compartida | `packages/shared` (Zod + guardrails) |
| PDF | `@react-pdf/renderer` |

---

## Inicio rápido

### Requisitos

- Node.js **20+** (22 recomendado)
- npm **10+**
- PostgreSQL **15+** (local o Docker)

### Instalación

```bash
# Clonar e instalar
git clone https://github.com/jsotoexelixitech/products-builder.git
cd products-builder
npm install

# Compilar paquete compartido
npm run build -w packages/shared

# Variables de entorno
cp backend/.env.example backend/.env
# Windows PowerShell:
# Copy-Item backend\.env.example backend\.env

# Base de datos (con Docker)
docker compose up -d

# Migraciones y datos demo
npm run db:generate
npm run db:migrate
npm run db:seed

# Desarrollo (API :3001 + SPA :5173)
npm run dev
```

| Servicio | URL |
|----------|-----|
| Aplicación | http://localhost:5173 |
| API REST | http://localhost:3001/api |
| PostgreSQL (Docker) | `localhost:5432` |

---

## Estructura del monorepo

```
products-builder/
├── backend/           # API NestJS + Prisma
├── frontend/          # SPA React (wizard + dashboard + preview)
├── packages/shared/   # Schemas Zod y guardrails compartidos
├── docs/              # Documentación técnica
├── .github/           # CI, plantillas de issues y PRs
└── docker-compose.yml # PostgreSQL para desarrollo
```

---

## Wizard de producto

| Paso | Contenido |
|------|-----------|
| 0 | Datos del producto (core) |
| 1 | Coberturas |
| 2 | Planes comerciales |
| 3 | Actuarial |
| 4 | Legal |
| 5 | Flujo de emisión |
| 6 | Revisión SUDEASEG |

---

## API principal

```
GET    /api/products
POST   /api/products
GET    /api/products/:id
PATCH  /api/products/:id
DELETE /api/products/:id

PUT    /api/products/:id/coverages
PUT    /api/products/:id/actuarial
PUT    /api/products/:id/legal
GET    /api/products/:id/plans
PUT    /api/products/:id/plans
GET    /api/products/:id/emission-config
PUT    /api/products/:id/emission-config

GET    /api/products/:id/workflow/validate-submission
POST   /api/products/:id/workflow/transition
POST   /api/products/:id/workflow/approve
```

Documentación ampliada en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Guardrails de envío (DRAFT → SUDEASEG)

1. Actuario con registro SUDEASEG válido  
2. Exclusiones con resalte tipográfico del Art. 68  
3. Al menos una cobertura marcada como básica obligatoria  
4. Gastos administrativos + comisiones + utilidad &lt; 100%  
5. Ramo INCLUSIVO: canal alternativo y contrato simplificado  

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Backend + frontend en modo desarrollo |
| `npm run build` | Build de shared, backend y frontend |
| `npm run db:generate` | Generar cliente Prisma |
| `npm run db:migrate` | Aplicar migraciones (dev) |
| `npm run db:seed` | Cargar producto demo |

---

## Desarrollo con Cursor (opcional)

El proyecto incluye reglas en `.cursor/` para agentes de IA. El bundle ECC no se versiona; consulta [`AGENTS.md`](AGENTS.md) para configuración local.

---

## Contribuir

Lee [`CONTRIBUTING.md`](CONTRIBUTING.md) para flujo de branches, commits convencionales y PRs.

---

## Licencia

[MIT](LICENSE) © 2026 Exelixi Tech

---

## Topics

`insurance` · `sudeaseg` · `nestjs` · `react` · `typescript` · `prisma` · `postgresql` · `product-configurator` · `monorepo` · `vite` · `tailwindcss`
