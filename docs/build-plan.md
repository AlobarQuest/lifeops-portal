# Build Plan

## What The Source Docs Already Lock In

- Single primary user: Devon
- Desktop-first MVP
- Core objects: roles, projects, tasks, ideas, knowledge, decisions, external resources
- Version 1 emphasis: dashboard, tasks, projects, knowledge, intake, search, resource links
- Orchestration first, deep integrations later

## Build-Start Decisions

Current status on 2026-03-13:

- phases 0 through 3 are largely in place for the task platform
- production bearer-token access is live and smoke-tested
- the biggest remaining product work is phase 4 and the placeholder MVP sections outside tasks/projects

### 1. Application Shape

Start with one full-stack web application, not a distributed system. The MVP is mostly CRUD, search, dashboards, and linked context. A single app keeps deployment, debugging, and schema iteration fast.

### 2. Deployment Shape

Deploy the app to Coolify as a Docker Image application that pulls a GHCR image built from the root `Dockerfile` by GitHub Actions. Run PostgreSQL as a separate Coolify database resource. Do not bundle the database into the same application container.

### 3. Version 1 Technical Baseline

- Framework: `Next.js` with App Router
- Language: `TypeScript`
- Database: `PostgreSQL 16`
- ORM/migrations: `Prisma`
- Styling/UI: `Tailwind CSS` plus a small local component set
- Search: PostgreSQL full-text search across projects, tasks, ideas, knowledge, and resources
- Auth: single-owner auth flow, seeded owner account, no multi-user permissions yet
- Jobs: no dedicated worker at first; only add one if review reminders or connector sync actually require it

## Why This Stack

- It matches the product: form-heavy, dashboard-heavy, linked records, fast iteration.
- It stays Docker-friendly for Coolify.
- It avoids introducing Elasticsearch, Redis, queues, or event systems before the product model is proven.
- PostgreSQL can cover search, filtering, and relational links well enough for version 1.

## Suggested Repository Shape

Keep the application at the repository root for the first iteration.

- `app/` route tree
- `components/` reusable UI
- `lib/` domain logic, validators, helpers
- `prisma/` schema and migrations
- `public/` static assets
- `docs/` product and implementation planning
- `Dockerfile` production build
- `docker-compose.local.yml` local app + database workflow

Avoid a monorepo until there is a real second deployable service.

## Delivery Phases

### Phase 0: Foundation

- Initialize git in this folder and create the GitHub repository.
- Scaffold the root app.
- Add `Dockerfile`, `.dockerignore`, and local Docker Compose for development.
- Add the GHCR publish workflow.
- Create the Coolify project, environment, and PostgreSQL instance.
- Define shared environment variables and secrets.
- Add a basic health endpoint for Coolify checks.

Exit criteria:
- App runs locally in Docker.
- App builds from the root `Dockerfile`.
- GitHub Actions can publish the production image to GHCR.
- Coolify can pull and run the published image.

### Phase 1: Data Model And App Shell

- Implement the initial Prisma schema.
- Seed roles, statuses, and one owner user.
- Build the root layout, navigation, and empty route shells.
- Add basic auth and route protection.

Exit criteria:
- Database migrates cleanly.
- Navigation covers every MVP section.
- Auth protects the app outside the public health endpoint.

### Phase 2: Core MVP Objects

- Build tasks list/detail/create/edit.
- Add the first task API routes so other Devon-owned applications can create and update tasks through LifeOps Portal.
- Build projects list/detail/create/edit.
- Build knowledge list/detail/create/edit.
- Build dashboard widgets for today, overdue, blocked, and recent context.
- Link tasks, projects, and knowledge together.

Exit criteria:
- Daily execution workflow works end to end.
- Another internal application can create a task without writing directly to the database.
- Project dashboards show status, next actions, links, and knowledge.

### Phase 3: External Task Accessibility

- Add `INTERNAL_API_TOKEN` based access for internal machine clients.
- Add source attribution fields and idempotent task create/update flows.
- Add project and section task APIs needed by external callers.
- Add integration tests for bearer-token access and duplicate-prevention behavior.

Exit criteria:
- Another internal application can create and update tasks through the LifeOps API with stable auth.
- Retries do not create duplicate tasks.
- Task ownership and source attribution remain visible in the database.

### Phase 4: Intake, Resources, And Search

- Build ideas/inbox capture flow.
- Implement idea-to-project conversion.
- Build external resources registry.
- Add unified search.
- Add saved filters for the highest-traffic list pages.

Exit criteria:
- Devon can capture, refine, search, and connect work records without leaving the app.

### Phase 5: Reviews And Hardening

- Build weekly review screens and stale project detection.
- Tighten validations and empty-state UX.
- Add backups, error logging, and deployment checks.
- Prepare seed/demo data for live usage.

Exit criteria:
- The app is stable enough to become the daily home screen.

## First Build Backlog

1. Create root app scaffold with Docker support.
2. Implement schema for users, roles, projects, tasks, ideas, knowledge, decisions, resources, and tags.
3. Build route shell and navigation.
4. Build task CRUD plus initial task API.
5. Build project CRUD.
6. Build knowledge CRUD.
7. Build home dashboard.
8. Build quick capture and ideas queue.
9. Harden the task API for other internal apps.
10. Build search and resources registry.
11. Build reviews and stale project surfacing.

## Open Decisions That Should Be Resolved Early

- Final product/repo name: `AlobarDashboard` vs `LifeOps Portal`
- Auth method: built-in credentials vs GitHub login vs another provider
- Attachment storage: database-only content for v1 vs object storage
- Whether a project belongs to one primary role or supports multiple roles on day one
- Whether decisions stay a separate table or start as a knowledge subtype
