# Coolify Deployment Plan

Verified against Coolify official docs on 2026-03-10.

## Deployment Recommendation

Use a Coolify Docker Image application that pulls a prebuilt GHCR image, and provision PostgreSQL as a separate Coolify database resource.

This is the right starting point because:

- The production image is still defined by the root `Dockerfile`.
- Building on GitHub or another external builder avoids CPU spikes on the Coolify host.
- Coolify only needs to pull and run the image, which is materially safer on a small server.
- The MVP only needs one app container to start.
- Running the database separately gives cleaner backups, upgrades, and recovery.

## Do Not Start With

- A single Docker Compose stack that includes the database
- Multiple custom services before the product model is stable
- Local-file-only persistence for important user content

If the app later needs a worker, scheduler, or background sync service, reevaluate whether to move to Docker Compose or separate application resources.

## Target Topology

- `lifeops-web`: Coolify Docker Image application pulling `ghcr.io/alobarquest/lifeops-portal`
- `lifeops-db`: Coolify PostgreSQL resource
- optional later: `lifeops-worker` for background jobs

## GitHub Setup

Use GitHub as the image builder and GHCR as the registry.

Initial setup:

1. Push the repository to GitHub.
2. Enable the workflow at `.github/workflows/publish-image.yml`.
3. Publish `ghcr.io/alobarquest/lifeops-portal` tags from `main`.
4. In Coolify, create a Docker Image application.
5. Point it at `ghcr.io/alobarquest/lifeops-portal`.
6. Use a stable tag like `latest`, or a specific commit SHA tag for controlled rollouts.
7. Set registry credentials if the GHCR package remains private.

This repo can still remain private even if Coolify no longer builds directly from GitHub.

## Application Configuration

- Image source: `ghcr.io/alobarquest/lifeops-portal`
- Image tag: `latest` or commit SHA
- Exposed port: `3000`
- Health endpoint: `/api/health`
- Health check host: `127.0.0.1`
- Branch strategy: `main` for production; add `develop` only if a staging environment becomes necessary

Make sure the app listens on `0.0.0.0`, not `localhost`.

## Operational Notes From Production

- Do not use Coolify source builds on the current server for this app. Host-side `npm ci` and `next build` caused repeated CPU spikes and stalled deploys.
- Keep the app as a Docker Image deployment that pulls from GHCR.
- Keep health checks enabled.
- Use `127.0.0.1` as the health check host, not `localhost`, because `localhost` produced false negatives during rollout on this image.
- The image must expose either `curl` or `wget` for Coolify health checks. The current `node:alpine` image path works with `wget`.

## Environment Variables

Application variables:

- `DATABASE_URL`
- `APP_URL`
- `AUTH_EMAIL`
- `AUTH_PASSWORD`
- `SESSION_SECRET`
- `OWNER_EMAIL`
- `INTERNAL_API_TOKEN`
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

- Do not mark application secrets as image build variables.
- Keep secrets in Coolify, not in the repository.
- The only system still building the image should be GitHub Actions or another external builder.
- `INTERNAL_API_TOKEN` is required before other internal applications can call the task API as machine clients.
- If GHCR remains private, Coolify must have working registry credentials before rollout. Public repository visibility alone does not make the container package public.

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
2. The image publishes successfully to GHCR.
3. The app starts with `HOST=0.0.0.0`.
4. `DATABASE_URL` points to the Coolify PostgreSQL instance.
5. A health endpoint returns `200`.
6. Secrets are stored in Coolify.
7. Database backups are enabled.
8. Coolify pulls the latest image without building on the host.

## Why GHCR Image Over Host Builds

Coolify supports Git source builds, but the safer option here is a pulled image.

- The root Dockerfile still defines the image.
- The Coolify host no longer spends CPU on `npm ci` and `next build`.
- It avoids rollout hangs caused by on-host builds.
- It keeps the app lifecycle separate from the database lifecycle.

Use Docker Compose later only if the product genuinely needs multiple first-party containers.

## Reference Docs

- Coolify Docker Image application: https://coolify.io/docs/applications/docker-image
- Coolify Docker Compose build pack: https://coolify.io/docs/applications/build-packs/docker-compose
- Coolify environment variables: https://coolify.io/docs/knowledge-base/environment-variables
