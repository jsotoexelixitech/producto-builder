# Contributing

Thank you for your interest in **Products Builder**. This document summarizes how to work on the codebase.

## Prerequisites

- **Node.js** 20+ (22 recommended)
- **npm** 10+
- **PostgreSQL** 15+ (local install or Docker Compose)
- **Git**

## Local setup

```bash
git clone https://github.com/jsotoexelixitech/products-builder.git
cd products-builder
npm install
npm run build -w packages/shared
cp backend/.env.example backend/.env   # Windows: copy backend\.env.example backend\.env
docker compose up -d                   # optional: PostgreSQL only
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:3001/api  

## Branching

- `main` — stable, deployable code
- `feature/<short-description>` — new functionality
- `fix/<short-description>` — bug fixes

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(wizard): add commercial plans step
fix(plans): sync coverage IDs after save
docs(readme): update API section
chore(ci): add postgres service to workflow
```

## Pull requests

1. Fork and create a feature branch from `main`.
2. Keep changes focused; update docs when behavior changes.
3. Ensure `npm run build` passes locally.
4. Fill in the PR template (summary, test plan, screenshots if UI).
5. Request review from a maintainer.

## Code style

- TypeScript strict mode across packages.
- Prefer immutable updates and explicit validation (Zod / class-validator).
- Match existing patterns in the module you are editing.
- UI follows Tailwind + Radix conventions in `frontend/src/components/ui/`.

## Cursor / ECC (optional)

The repo includes Cursor rules under `.cursor/`. The ECC bundle is not committed; see `AGENTS.md` to install developer tooling locally.

## Security

Do not commit secrets, `.env` files or production credentials. Report vulnerabilities privately to the maintainers (see `SECURITY.md`).
