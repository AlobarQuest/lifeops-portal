# Coolify Deployment Plan

Verified against Coolify official docs on 2026-03-09.

## Deployment Recommendation

Use a Coolify `Application` connected directly to the GitHub repository, with the `Dockerfile` build pack, and provision PostgreSQL as a separate Coolify database resource.

This is the right starting point because:

- Coolify applications are designed for Git-based CI/CD.
- The Dockerfile build pack gives full control over the production image.
- The MVP only needs one app container to start.
- Running the database separately gives cleaner backups, upgrades, and recovery.

## Do Not Start With

- A single Docker Compose stack that includes the database
- Multiple custom services before the product model is stable
- Local-file-only persistence for important user content

If the app later needs a worker, scheduler, or background sync service, reevaluate whether to move to Docker Compose or separate application resources.

## Target Topology

- `lifeops-web`: Coolify Application built from GitHub with root `Dockerfile`
- `lifeops-db`: Coolify PostgreSQL resource
- optional later: `lifeops-worker` for background jobs

## GitHub Setup

For a private repository, prefer the Coolify GitHub App integration.

Initial setup:

1. Create the GitHub repository.
2. In Coolify, create or connect a GitHub App source.
3. Grant that GitHub App access to the repository.
4. Create a new Coolify `Application`.
5. Select the repository and branch.
6. Select the `Dockerfile` build pack.
7. Set base directory to `/`.

For a public repository, Coolify can deploy directly from the repository URL.

## Application Configuration

- Build pack: `Dockerfile`
- Base directory: `/`
- Exposed port: `3000`
- Health endpoint: `/api/health`
- Branch strategy: `main` for production; add `develop` only if a staging environment becomes necessary

Make sure the app listens on `0.0.0.0`, not `localhost`.

## Environment Variables

Application variables:

- `DATABASE_URL`
- `APP_URL`
- `AUTH_SECRET`
- `NODE_ENV=production`
- `LOG_LEVEL=info`

Useful Coolify-provided variables:

- `PORT`
- `HOST`
- `COOLIFY_FQDN`
- `COOLIFY_URL`
- `COOLIFY_BRANCH`
- `SOURCE_COMMIT`

Notes:

- Mark anything needed at image build time as a Coolify build variable.
- Keep secrets in Coolify, not in the repository.

## Database Plan

- Use PostgreSQL in Coolify, not SQLite in production.
- Enable automated backups to S3-compatible storage before the app contains real data.
- Keep schema migrations in the app repository through Prisma.
- Run migrations as part of deployment or as a controlled post-deploy step.

## Local Development Plan

Use Docker locally as well so the deployment path stays aligned.

Recommended files to add during scaffolding:

- `Dockerfile`
- `.dockerignore`
- `docker-compose.local.yml`
- `.env.example`

Local stack:

- app container
- postgres container

## Deploy-Readiness Checklist

Before the first production deployment:

1. The repo is on GitHub.
2. The app builds successfully from the root `Dockerfile`.
3. The app starts with `HOST=0.0.0.0`.
4. `DATABASE_URL` points to the Coolify PostgreSQL instance.
5. A health endpoint returns `200`.
6. Secrets are stored in Coolify.
7. Database backups are enabled.
8. The main branch deploys automatically after push.

## Why Dockerfile Over Docker Compose For Day One

Coolify supports both, but the simpler option is better here.

- Dockerfile is enough for one web app.
- It keeps GitHub-to-deploy setup straightforward.
- It avoids coupling the app lifecycle to the database lifecycle.
- It keeps the initial repo shape simple.

Use Docker Compose later only if the product genuinely needs multiple first-party containers.

## Reference Docs

- Coolify CI/CD with Git providers: https://coolify.io/docs/applications/ci-cd/introduction
- Coolify GitHub integration: https://coolify.io/docs/knowledge-base/git/github/integration
- Coolify Dockerfile build pack: https://coolify.io/docs/applications/build-packs/dockerfile
- Coolify Docker Compose build pack: https://coolify.io/docs/applications/build-packs/docker-compose
- Coolify environment variables: https://coolify.io/docs/knowledge-base/environment-variables
