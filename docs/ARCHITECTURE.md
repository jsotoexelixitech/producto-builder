# Architecture

## Overview

Products Builder is a **monorepo** that separates concerns into three deployable units:

```
┌─────────────────────────────────────────────────────────────┐
│                     frontend (React SPA)                     │
│  Dashboard · Product Wizard · Emission Flow Preview          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP /api (Vite proxy in dev)
┌──────────────────────────▼──────────────────────────────────┐
│                     backend (NestJS)                           │
│  products · coverages · actuarial · legal · workflow         │
│  emission-config · product-plans · sisip (reference)         │
└──────────────────────────┬──────────────────────────────────┘
                           │ Prisma
┌──────────────────────────▼──────────────────────────────────┐
│                     PostgreSQL                                 │
└─────────────────────────────────────────────────────────────┘

        packages/shared ──► Zod schemas + guardrails
              ▲
              │ imported by frontend & backend
```

## Backend modules

| Module | Responsibility |
|--------|----------------|
| `products` | CRUD, core product metadata, branch and status |
| `coverages` | Coverage definitions linked to a product |
| `actuarial` | Premium calculation inputs and actuary registry |
| `legal` | Exclusions, required documents, legal artifacts |
| `product-plans` | Commercial plans with linked coverage IDs |
| `emission-config` | Flow steps, form fields, step toggles |
| `workflow` | State transitions and submission guardrails |
| `sisip` | Reference integration (read-only patterns) |

## Data model (high level)

- **Product** — root entity with branch, currency, emission type and workflow status.
- **Coverage** — insured sums, deductibles, mandatory flag.
- **ProductPlan** — named plan with JSON `coverageIds`.
- **FlowStepConfig** — ordered emission steps with `enabled` and `formEnabled`.
- **FormField** — dynamic fields bound to a `stepKey` (e.g. `CLIENT_DATA`).
- **ActuarialData**, **Exclusion**, **RequiredDocument** — specialized 1:N relations.

See `backend/prisma/schema.prisma` for the full schema.

## Frontend routes

| Route | Page |
|-------|------|
| `/` | Dashboard — product list and status |
| `/products/new` | Wizard — create product |
| `/products/:id` | Wizard — edit product |
| `/products/:id/preview` | Emission flow preview |

## Shared validation

`packages/shared` centralizes:

- Zod schemas for API payloads
- Guardrail rules executed before SUDEASEG submission
- Types consumed by both tiers (build required before backend/frontend)

## Emission flow

1. Wizard step **Flujo de emisión** configures `FlowStepConfig[]` and optional `FormField[]`.
2. Steps can be disabled per product; form-capable steps (`CLIENT_DATA`, `RISK_DATA`) support custom forms or branch defaults.
3. `buildFlowPreviewContext()` in `frontend/src/lib/emission-flow.ts` assembles preview data from saved product state.

## Environment variables

| Variable | Location | Description |
|----------|----------|-------------|
| `DATABASE_URL` | `backend/.env` | PostgreSQL connection string |
| `PORT` | `backend/.env` | API port (default `3001`) |

Copy `backend/.env.example` to `backend/.env` before running migrations.

## Deployment notes

- Build order: `shared` → `backend` → `frontend`.
- Run `prisma migrate deploy` in production (not `migrate dev`).
- Serve frontend static assets behind a reverse proxy; proxy `/api` to NestJS.
- Configure CORS origins in `backend/src/main.ts` for production domains.
