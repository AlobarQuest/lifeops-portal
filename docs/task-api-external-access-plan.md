# Task API External Access Handoff

This document records the current state of the LifeOps task API and the next work required to make it a stable integration surface for other internal applications.

## Goal

Use LifeOps Portal as the shared task system for Devon-owned applications.

That means other apps should create, update, complete, and read tasks through LifeOps Portal instead of:

- writing to their own local task tables
- calling Todoist
- duplicating task state in multiple systems

## Current Production State

As of 2026-03-10, the first task API pass is live.

Implemented:

- database-backed `/tasks` page
- quick task capture in the UI
- task completion and reopen actions
- owner-scoped task queries through Prisma
- first protected task API route at `/api/tasks`

Not implemented yet:

- project creation/update API
- section creation/update API
- dedicated task comments
- recurring task rules
- external source reference tables
- idempotency keys
- broader machine-to-machine auth rollout

## Current Auth Model

The task API currently supports two auth paths:

### 1. Owner session cookie

Browser requests from the signed-in owner can call the task API with the normal app session cookie.

### 2. Internal API token

Other applications should authenticate with:

- `Authorization: Bearer <INTERNAL_API_TOKEN>`
- or `x-lifeops-token: <INTERNAL_API_TOKEN>`

Current requirement:

- `INTERNAL_API_TOKEN` must be defined in Coolify before external applications can use this path

## Current API Surface

### `GET /api/tasks`

Purpose:

- list tasks
- optionally fetch one task by `id`
- return task counts for major views

Supported query params:

- `view`: `all`, `inbox`, `today`, `overdue`, `blocked`, `completed`
- `status`
- `projectId`
- `limit`
- `id`

Response shape:

- `tasks` array plus `counts` object for list requests
- `task` object for single-task fetch by `id`

### `POST /api/tasks`

Purpose:

- create a task

Current accepted fields:

- `title`
- `description`
- `priority`
- `status`
- `dueOn`
- `projectId`

### `PATCH /api/tasks`

Purpose:

- update a task
- complete a task
- reopen a task

Current accepted fields:

- `id` required
- `title`
- `description`
- `priority`
- `status`
- `dueOn`
- `projectId`
- `blockedReason`
- `mode`

`mode` behavior:

- `complete`
- `reopen`

## Current Task Object Shape

Returned task objects currently expose:

- `id`
- `title`
- `description`
- `status`
- `statusLabel`
- `priority`
- `priorityLabel`
- `dueAt`
- `dueLabel`
- `blockedReason`
- `project`
- `role`
- `createdAt`
- `updatedAt`

This is enough for a first internal client, but it is not yet a long-term stable contract.

## Gaps Before Broad External Use

### 1. Stable machine-to-machine auth rollout

Still needed:

- set `INTERNAL_API_TOKEN` in Coolify
- document token rotation
- define which internal apps are allowed to use it

### 2. Source attribution and idempotency

Still needed:

- `source_type`
- `source_key`
- optional `task_external_refs`
- duplicate-prevention logic

Without this, another application can create tasks, but cannot safely retry writes without risk of duplication.

### 3. Narrower API contract

Still needed:

- documented request and response schemas
- versioning strategy or compatibility rules
- explicit validation errors

### 4. Project and section APIs

Still needed:

- project lookup support appropriate for task creation
- task sections for project-local organization

### 5. Auditability

Still needed:

- track external source that created or changed a task
- store enough request context to debug bad writes later

## Recommended Next Build Sequence

### Phase A: Make the current API usable for one internal caller

- add `INTERNAL_API_TOKEN` in Coolify
- verify bearer-token calls end to end
- document one known-good client example
- add a small integration smoke test

Exit criteria:

- one external app can create and complete a task reliably

### Phase B: Add source-safe writes

- add `source_type` and `source_key`
- add uniqueness constraints
- allow create-or-update by external key

Exit criteria:

- callers can retry safely without duplicate tasks

### Phase C: Expand the domain model

- add task sections
- add parent/sub-task support
- add labels and recurring logic

Exit criteria:

- external callers can create richer tasks that match the UI model

### Phase D: Harden the contract

- add API-specific documentation with examples
- add route-level audit logging
- add request tests for auth, validation, and idempotency

Exit criteria:

- the task API is stable enough to be a shared internal platform surface

## Recommended Production Variables

For the task API rollout, production should include:

- `DATABASE_URL`
- `APP_URL`
- `AUTH_EMAIL`
- `AUTH_PASSWORD`
- `SESSION_SECRET`
- `OWNER_EMAIL`
- `NODE_ENV=production`
- `INTERNAL_API_TOKEN`

## Caller Rules

Until the API matures further, internal callers should follow these rules:

- treat LifeOps Portal as the source of truth for task state
- do not keep an independent long-lived task table unless there is a clear cache need
- store returned LifeOps task IDs immediately
- prefer update by LifeOps task ID once a task is created
- assume the current API contract may still evolve

## Suggested First Client Contract

The safest first external use case is:

1. another app creates a task in LifeOps with a title, description, and project
2. the caller stores the returned `task.id`
3. the caller updates or completes the task later using that `id`

That flow avoids the still-missing idempotency and external-ref model.
