# Build Plan

## What The Source Docs Already Lock In

- Single primary user: Devon
- Desktop-first MVP
- Core objects: roles, projects, tasks, ideas, knowledge, decisions, external resources
- Version 1 emphasis: dashboard, tasks, projects, knowledge, intake, search, resource links
- Orchestration first, deep integrations later

## Build-Start Decisions

### 1. Application Shape

Start with one full-stack web application, not a distributed system. The MVP is mostly CRUD, search, dashboards, and linked context. A single app keeps deployment, debugging, and schema iteration fast.

### 2. Deployment Shape

Deploy the app to Coolify as an `Application` connected to a GitHub repository, using a root `Dockerfile`. Run PostgreSQL as a separate Coolify database resource. Do not bundle the database into the same application container.

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
- Create the Coolify project, environment, and PostgreSQL instance.
- Define shared environment variables and secrets.
- Add a basic health endpoint for Coolify checks.

Exit criteria:
- App runs locally in Docker.
- App builds from the root `Dockerfile`.
- Coolify can deploy the default branch from GitHub.

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
- Build projects list/detail/create/edit.
- Build knowledge list/detail/create/edit.
- Build dashboard widgets for today, overdue, blocked, and recent context.
- Link tasks, projects, and knowledge together.

Exit criteria:
- Daily execution workflow works end to end.
- Project dashboards show status, next actions, links, and knowledge.

### Phase 3: Intake, Resources, And Search

- Build ideas/inbox capture flow.
- Implement idea-to-project conversion.
- Build external resources registry.
- Add unified search.
- Add saved filters for the highest-traffic list pages.

Exit criteria:
- Devon can capture, refine, search, and connect work records without leaving the app.

### Phase 4: Reviews And Hardening

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
4. Build task and project CRUD.
5. Build knowledge CRUD.
6. Build home dashboard.
7. Build quick capture and ideas queue.
8. Build search and resources registry.
9. Build reviews and stale project surfacing.

## Open Decisions That Should Be Resolved Early

- Final product/repo name: `AlobarDashboard` vs `LifeOps Portal`
- Auth method: built-in credentials vs GitHub login vs another provider
- Attachment storage: database-only content for v1 vs object storage
- Whether a project belongs to one primary role or supports multiple roles on day one
- Whether decisions stay a separate table or start as a knowledge subtype
