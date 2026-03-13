# LifeOps Portal / AlobarDashboard

This repository now contains the initial application scaffold for `LifeOpsPortal`, plus the original product-definition documents that drove the build.

## Current Stack

- `Next.js` with App Router and TypeScript
- `Prisma` with PostgreSQL
- Docker-first deployment for Coolify
- Single-owner credential login for the initial release

## Current Task System State

- `/tasks` is now backed by PostgreSQL instead of placeholder site data
- `/api/tasks` is the first protected task API route for browser and internal-app access
- `POST /api/tasks` now supports source-aware idempotent create-or-update when `sourceType` and `sourceKey` are provided
- `PATCH /api/tasks` can now target a task by LifeOps `id` or by the external `(sourceType, sourceKey)` pair
- `GET /api/tasks` now accepts `includeArchived`, and explicit source lookups can return completed or archived tasks without disappearing behind the default active-task view
- `/api/tasks/[id]`, `/api/tasks/[id]/complete`, `/api/tasks/[id]/reopen`, and `/api/tasks/[id]/archive` now provide path-based task reads and state transitions for external callers
- task API writes now create `TaskAuditEvent` rows with auth method, request metadata, payload, and task snapshot context
- `/tasks` now supports a task detail drawer with full-task editing, manual move up/down ordering, comments, nested subtask creation, project/section reassignment, and archive controls
- tasks now support `scheduledFor`, `deadlineAt`, `durationMinutes`, and recurring cadence metadata
- recurring task completion now generates the next occurrence and keeps source-aware lookups pointed at the active recurrence
- `/api/task-projects` now supports project lookup, creation, and update for machine callers that need real project IDs before writing tasks
- `/api/task-sections` now supports section lookup, creation, and update for project-scoped task organization
- `/api/task-labels` now supports owner-scoped label lookup for clients that need existing task labels
- `/api/tasks/[id]/comments` now supports owner-scoped comment list and create flows for browser and token-authenticated callers
- external applications are intended to use LifeOps Portal as the shared task layer instead of Todoist
- machine-to-machine task access uses `INTERNAL_API_TOKEN`; richer external-ref history, saved filters, and broader UX polish still remain to be built

## Project Layout

- `app/` application routes
- `components/` shared UI
- `lib/` auth and site data
- `prisma/` schema and seed data
- `docs/` product and implementation planning
- `Dockerfile` production image for Coolify
- `docker-compose.local.yml` local app/database stack

## Local Setup

1. Copy `.env.example` to `.env`.
2. Set `AUTH_PASSWORD` and `SESSION_SECRET`.
3. Install dependencies with `npm install`.
4. Start PostgreSQL and the app locally with Docker Compose, or run the app directly after setting `DATABASE_URL`.
5. Run Prisma commands as the schema evolves:
   - `npm run db:generate`
   - `npm run db:migrate`
   - `npm run db:seed`
6. Run the task-platform integration suite against the local Postgres database:
   - `npm run test:integration`
7. Smoke the real HTTP bearer-token flow with a running app:
   - `LIFEOPS_API_BASE_URL=http://127.0.0.1:3000 LIFEOPS_API_TOKEN=test-internal-token npm run smoke:task-api`

## Deployment Shape

- GitHub Actions runs `.github/workflows/ci.yml` on pull requests and `main`, including TypeScript, lint, build, Prisma migrate/seed, and `npm run test:integration`
- GitHub Actions publishes the root `Dockerfile` to GHCR through `.github/workflows/publish-image.yml`
- `.github/workflows/publish-image.yml` now waits for a successful `CI` run on `main` before pushing `ghcr.io/alobarquest/lifeops-portal`
- Coolify runs a Docker Image application that pulls `ghcr.io/alobarquest/lifeops-portal`
- first external-caller rollout now has a concrete runbook in `docs/task-api-first-caller-runbook.md` and a smoke client in `scripts/task-api-smoke.ts`
- Do not switch production back to source builds on the current Coolify host unless server capacity changes
- Separate Coolify PostgreSQL resource
- Production domain: `portal.devonwatkins.com`

## Source Documents

- `00_LifeOps_Portal_Document_Set_Overview.docx`
- `01_LifeOps_Portal_Project_Charter.docx`
- `02_LifeOps_Portal_System_Definition.docx`
- `03_LifeOps_Portal_MVP_Priorities_and_Roadmap.docx`

## Planning Documents

- `docs/build-plan.md`
- `docs/schema-draft.md`
- `docs/screen-inventory.md`
- `docs/coolify-deployment-plan.md`
- `docs/task-api-first-caller-runbook.md`
- `docs/task-system-update-plan.md`
- `docs/task-api-external-access-plan.md`

## Handoff Focus

If work resumes later to make tasks accessible to other applications, start with:

1. `docs/task-api-external-access-plan.md`
2. `docs/task-system-update-plan.md`
3. `docs/schema-draft.md`
4. `docs/coolify-deployment-plan.md`
