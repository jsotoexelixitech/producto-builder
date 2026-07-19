# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-18

### Added

- Monorepo with NestJS API, React SPA and shared Zod validation package.
- Product wizard: core data, coverages, commercial plans, actuarial, legal, emission flow and SUDEASEG review.
- Emission flow configuration with per-step toggles, custom forms and linked content (plans, documents).
- Workflow state machine with five submission guardrails aligned to SUDEASEG requirements.
- Emission flow preview for end-user experience validation.
- PostgreSQL schema via Prisma with migrations and seed data.
- Docker Compose profile for local PostgreSQL.
- GitHub Actions CI pipeline and issue/PR templates.

[0.1.0]: https://github.com/jsotoexelixitech/products-builder/releases/tag/v0.1.0
