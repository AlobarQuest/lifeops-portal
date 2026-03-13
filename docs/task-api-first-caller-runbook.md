# Task API First Caller Runbook

This runbook covers the first production bearer-token rollout for LifeOps Portal task API clients.

Current status on 2026-03-13:

- `INTERNAL_API_TOKEN` is configured in Coolify
- production smoke passed against `https://portal.devonwatkins.com`
- the next caller can reuse this same verification path after token rotation or image updates

## Goal

Verify that one external caller can create, update, complete, and archive a task through LifeOps Portal using `INTERNAL_API_TOKEN`.

## Required Values

- Coolify app secret: `INTERNAL_API_TOKEN`
- Caller secret: same token value stored in the calling application
- Base URL: `https://portal.devonwatkins.com`

## Rollout Steps

1. Generate a strong token.
   Example: `openssl rand -hex 32`
2. Set `INTERNAL_API_TOKEN` in the Coolify application environment.
3. Redeploy the LifeOps Portal app so the new secret is active.
4. Store the same token in the first calling application secret store.
5. Run the smoke client from this repo:

```bash
LIFEOPS_API_BASE_URL=https://portal.devonwatkins.com \
LIFEOPS_API_TOKEN='replace-with-the-production-token' \
npm run smoke:task-api
```

6. Confirm the script completes with:
   `Task API smoke test passed.`
7. If a write looks wrong, inspect the new `TaskAuditEvent` rows for that task to see auth type, request path, request payload, and post-write task snapshot.

## Rotation Notes

Current limitation:

- LifeOps Portal supports a single active `INTERNAL_API_TOKEN` value at a time.

That means rotation is a coordinated cutover:

1. Generate the replacement token.
2. Update the caller secret.
3. Update the Coolify app secret.
4. Redeploy LifeOps Portal.
5. Rerun `npm run smoke:task-api`.
6. Retire the previous token everywhere it was stored.

## Known-Good Minimal Client Example

This is the smallest useful `create -> update -> complete` example for another Node-based app:

```ts
const baseUrl = "https://portal.devonwatkins.com";
const token = process.env.LIFEOPS_API_TOKEN!;

async function call(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status}`);
  }

  return response.json();
}

const created = await call("/api/tasks", "POST", {
  title: "External caller task",
  sourceType: "my-app",
  sourceKey: "customer-123",
});

await call("/api/tasks", "PATCH", {
  sourceType: "my-app",
  sourceKey: "customer-123",
  description: "Updated later by the same external caller.",
});

await call(`/api/tasks/${created.task.id}/complete`, "POST");
```

## Repo References

- runnable smoke client: `scripts/task-api-smoke.ts`
- task API handoff: `docs/task-api-external-access-plan.md`
- deployment notes: `docs/coolify-deployment-plan.md`
