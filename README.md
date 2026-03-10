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
- external applications are intended to use LifeOps Portal as the shared task layer instead of Todoist
- machine-to-machine task access uses `INTERNAL_API_TOKEN`, but the broader external-app contract still needs idempotency, source attribution, and helper routes

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

## Deployment Shape

- GitHub Actions publishes the root `Dockerfile` to GHCR through `.github/workflows/publish-image.yml`
- Coolify runs a Docker Image application that pulls `ghcr.io/alobarquest/lifeops-portal`
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
- `docs/task-system-update-plan.md`
- `docs/task-api-external-access-plan.md`

## Handoff Focus

If work resumes later to make tasks accessible to other applications, start with:

1. `docs/task-api-external-access-plan.md`
2. `docs/task-system-update-plan.md`
3. `docs/schema-draft.md`
4. `docs/coolify-deployment-plan.md`
