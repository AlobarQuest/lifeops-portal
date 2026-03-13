# Task API External Access Handoff

This document records the current state of the LifeOps task API and the next work required to make it a stable integration surface for other internal applications.

## Goal

Use LifeOps Portal as the shared task system for Devon-owned applications.

That means other apps should create, update, complete, and read tasks through LifeOps Portal instead of:

- writing to their own local task tables
- calling Todoist
- duplicating task state in multiple systems

## Current Production State

As of 2026-03-13, the current task API pass is live.

Implemented:

- database-backed `/tasks` page
- quick task capture in the UI
- browser task detail drawer with full-task editing, comments, manual ordering, project and section reassignment, and archive controls on `/tasks`
- task completion and reopen actions
- owner-scoped task queries through Prisma
- first protected task API route at `/api/tasks`
- source-aware task fields: `sourceType` and `sourceKey`
- idempotent `POST /api/tasks` behavior when a caller supplies `(sourceType, sourceKey)`
- `PATCH /api/tasks` lookup by task `id` or by `(sourceType, sourceKey)`
- source filters on `GET /api/tasks`
- path-based task routes for `GET /api/tasks/:id`, `PATCH /api/tasks/:id`, `POST /api/tasks/:id/complete`, `POST /api/tasks/:id/reopen`, and `POST /api/tasks/:id/archive`
- task soft-archive support through `archivedAt`
- parent-task nesting through `parentTaskId`
- task labels through the existing `Tag` / `TaskTag` join model
- richer scheduling fields through `scheduledFor`, `deadlineAt`, and `durationMinutes`
- recurring task cadence through enum-based `recurrenceRule`
- recurring completion now creates the next occurrence and moves source-aware lookup onto the active recurring task
- project helper route at `/api/task-projects` for list, lookup, create, and update flows
- section helper route at `/api/task-sections` for list, lookup, create, and update flows
- label helper route at `/api/task-labels` for list and lookup flows
- comment helper route at `/api/tasks/:id/comments` for list and create flows
- `npm run test:integration` covers the core task route flows against a real local PostgreSQL database
- task API writes now create `TaskAuditEvent` rows with auth and request context snapshots
- `npm run smoke:task-api` provides a real bearer-token HTTP verification path for the first external caller rollout
- production bearer-token smoke passed against `https://portal.devonwatkins.com` on 2026-03-13

Not implemented yet:

- external source reference tables
- idempotency keys
- per-caller auth separation beyond the shared internal token

## Current Auth Model

The task API currently supports two auth paths:

### 1. Owner session cookie

Browser requests from the signed-in owner can call the task API with the normal app session cookie.

### 2. Internal API token

Other applications should authenticate with:

- `Authorization: Bearer <INTERNAL_API_TOKEN>`
- or `x-lifeops-token: <INTERNAL_API_TOKEN>`

Current production state:

- `INTERNAL_API_TOKEN` is configured in Coolify and validated through the production smoke client

## Current API Surface

### `GET /api/tasks`

Purpose:

- list tasks
- optionally fetch one task by `id`
- return task counts for major views

Supported query params:

- `view`: `all`, `inbox`, `today`, `overdue`, `blocked`, `completed`
- `status`
- `recurrenceRule`
- `recurring`
- `projectId`
- `sectionId`
- `parentTaskId`
- `label`
- `labelId`
- `sourceType`
- `sourceKey`
- `includeArchived`
- `limit`
- `id`

Response shape:

- `tasks` array plus `counts` object for list requests
- `task` object for single-task fetch by `id`

Accepted aliases:

- `project_id`
- `section_id`
- `source_type`
- `source_key`
- `externalSource`
- `externalKey`
- `include_archived`
- `parent_task_id`
- `label_id`
- `recurrence_rule`

### `POST /api/tasks`

Purpose:

- create a task

Current accepted fields:

- `title`
- `description`
- `priority`
- `status`
- `scheduledFor`
- `dueOn`
- `deadlineOn`
- `durationMinutes`
- `recurrenceRule`
- `sortOrder`
- `projectId`
- `sectionId`
- `parentTaskId`
- `labels`
- `sourceType`
- `sourceKey`

Accepted aliases for external callers:

- `source_type`
- `source_key`
- `externalSource`
- `externalKey`
- `parent_task_id`
- `scheduled_for`
- `deadline_on`
- `duration_minutes`
- `recurrence_rule`
- `sort_order`

### `PATCH /api/tasks`

Purpose:

- update a task
- complete a task
- reopen a task

Current accepted fields:

- `id` required
- or `sourceType` plus `sourceKey`
- `title`
- `description`
- `priority`
- `status`
- `scheduledFor`
- `dueOn`
- `deadlineOn`
- `durationMinutes`
- `recurrenceRule`
- `sortOrder`
- `projectId`
- `sectionId`
- `parentTaskId`
- `labels`
- `blockedReason`
- `mode`

Accepted aliases for external callers:

- `source_type`
- `source_key`
- `externalSource`
- `externalKey`
- `project_id`
- `section_id`
- `parent_task_id`
- `scheduled_for`
- `deadline_on`
- `duration_minutes`
- `recurrence_rule`
- `sort_order`
- `due_on`
- `blocked_reason`

`mode` behavior:

- `complete`
- `reopen`

Legacy note:

- `PATCH /api/tasks` remains supported for callers that target by body `id` or `(sourceType, sourceKey)`

### `GET /api/tasks/:id`

Purpose:

- fetch one task by path id

Archived behavior:

- archived tasks are still returned by direct id lookup

### `PATCH /api/tasks/:id`

Purpose:

- update one task by path id

Accepted fields:

- `title`
- `description`
- `priority`
- `status`
- `scheduledFor`
- `dueOn`
- `deadlineOn`
- `durationMinutes`
- `recurrenceRule`
- `sortOrder`
- `projectId`
- `sectionId`
- `parentTaskId`
- `labels`
- `blockedReason`

Accepted aliases:

- `project_id`
- `section_id`
- `parent_task_id`
- `scheduled_for`
- `deadline_on`
- `duration_minutes`
- `recurrence_rule`
- `sort_order`
- `due_on`
- `blocked_reason`

### `GET /api/tasks/:id/comments`

Purpose:

- list task comments for one task

Returned fields:

- `id`
- `bodyMarkdown`
- `author`
- `createdAt`
- `updatedAt`

### `POST /api/tasks/:id/comments`

Purpose:

- create a task comment

Current accepted fields:

- `bodyMarkdown`

Accepted aliases:

- `body_markdown`
- `body`
- `comment`

### `GET /api/task-labels`

Purpose:

- list existing task labels used by the owner
- optionally fetch one label by `id`

### `POST /api/tasks/:id/complete`

Purpose:

- mark a task done by path id

Recurring behavior:

- recurring tasks return `task` for the completed occurrence plus `nextTask` for the generated active occurrence

### `POST /api/tasks/:id/reopen`

Purpose:

- reopen a completed task by path id

### `POST /api/tasks/:id/archive`

Purpose:

- soft-archive a task by path id

Archived behavior:

- archived tasks are excluded from normal list/count queries unless `includeArchived=true`

### `GET /api/task-projects`

Purpose:

- list task-eligible projects
- optionally fetch one project by `id` or `slug`

Supported query params:

- `id`
- `slug`
- `q`
- `status`
- `includeArchived`
- `limit`

Accepted aliases:

- `query`
- `search`
- `include_archived`

### `POST /api/task-projects`

Purpose:

- create a project workspace for later task attachment

Current accepted fields:

- `name`
- `summary`
- `description`
- `status`
- `priority`
- `primaryRoleId`
- `targetStartOn`
- `targetEndOn`

Accepted aliases:

- `primary_role_id`
- `target_start_on`
- `target_end_on`

### `PATCH /api/task-projects`

Purpose:

- update an existing project record

Current accepted fields:

- `id` required
- `name`
- `summary`
- `description`
- `status`
- `priority`
- `primaryRoleId`
- `targetStartOn`
- `targetEndOn`

Accepted aliases:

- `primary_role_id`
- `target_start_on`
- `target_end_on`

### `GET /api/task-sections`

Purpose:

- list task sections
- optionally fetch one section by `id`

Supported query params:

- `id`
- `projectId`
- `includeArchived`
- `limit`

Accepted aliases:

- `project_id`
- `include_archived`

### `POST /api/task-sections`

Purpose:

- create a project-local task section

Current accepted fields:

- `projectId`
- `name`
- `sortOrder`

Accepted aliases:

- `project_id`
- `sort_order`

### `PATCH /api/task-sections`

Purpose:

- update an existing task section

Current accepted fields:

- `id` required
- `name`
- `sortOrder`
- `archived`

Accepted aliases:

- `sort_order`
- `isArchived`
- `is_archived`

## Current Task Object Shape

Returned task objects currently expose:

- `id`
- `title`
- `description`
- `status`
- `statusLabel`
- `priority`
- `priorityLabel`
- `scheduledFor`
- `scheduledLabel`
- `dueAt`
- `dueLabel`
- `deadlineAt`
- `deadlineLabel`
- `durationMinutes`
- `durationLabel`
- `recurrenceRule`
- `recurrenceLabel`
- `sortOrder`
- `blockedReason`
- `parentTaskId`
- `labels`
- `commentCount`
- `comments`
- `sourceType`
- `sourceKey`
- `project`
- `section`
- `role`
- `createdAt`
- `updatedAt`

This is enough for a first internal client, but it is not yet a long-term stable contract.

## Gaps Before Broad External Use

### 1. Stable machine-to-machine auth rollout

Still needed:

- define which internal apps are allowed to use the shared token
- decide whether the single shared token should stay or be replaced by per-caller credentials

### 2. Richer source attribution and external refs

Still needed:

- optional `task_external_refs` or audit records if one task needs multiple upstream references
- explicit last-writer or request-context tracking for external updates

The basic duplicate-prevention path now exists, but the longer-term audit model is still thin.

### 3. Narrower API contract

Still needed:

- documented request and response schemas
- versioning strategy or compatibility rules
- explicit validation errors

### 4. Richer task model

Still needed:

- saved filters
- richer comment-specific audit/history if route-level provenance becomes important

### 5. Auditability

Still needed:

- richer external source history when one task maps to multiple upstream records
- route-level documentation for how audit records should be interpreted and retained

Current state:

- successful task API writes now record auth type, request metadata, request payload, and task snapshot context in `TaskAuditEvent`

## Recommended Next Build Sequence

### Phase A: Make the current API usable for one internal caller

- status: complete on 2026-03-13
- `INTERNAL_API_TOKEN` is live in Coolify
- production smoke passed against `https://portal.devonwatkins.com`
- a known-good caller example exists in `docs/task-api-first-caller-runbook.md`

Exit criteria:

- one external app can create and complete a task reliably

### Phase B: Expand the domain model

- add parent/sub-task support
- add labels and recurring logic
- add task comments, manual ordering, and richer external refs

Exit criteria:

- external callers can create richer tasks that match the UI model

### Phase C: Harden the contract

- add API-specific documentation with examples
- add request tests for auth, validation, and idempotency
- define audit-log retention and interpretation rules

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
