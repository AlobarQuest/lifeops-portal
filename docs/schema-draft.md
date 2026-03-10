# Schema Draft

This is the first-pass schema to turn the product documents into an implementation-ready database plan. It is intentionally biased toward a simple version 1 release.

## Core Principles

- Keep knowledge first-class.
- Model relationships directly in PostgreSQL.
- Prefer flexible text and JSON fields over premature table explosion.
- Leave room for future multi-user support without implementing full permissions now.

## Core Enums

- `project_status`: `draft`, `planned`, `active`, `blocked`, `on_hold`, `completed`, `archived`
- `task_status`: `inbox`, `next`, `in_progress`, `blocked`, `done`, `canceled`
- `priority_level`: `low`, `medium`, `high`, `critical`
- `idea_status`: `captured`, `reviewing`, `approved`, `rejected`, `parked`, `converted`
- `knowledge_status`: `draft`, `active`, `archived`
- `decision_status`: `proposed`, `accepted`, `superseded`, `rejected`
- `knowledge_type`: `note`, `sop`, `decision`, `research`, `reference`, `lesson`, `definition`
- `resource_type`: `repo`, `document`, `folder`, `tool`, `service`, `board`, `calendar`, `link`

## Required Models For Version 1

### `users`

- `id`
- `email`
- `display_name`
- `timezone`
- `is_owner`
- `created_at`
- `updated_at`

Notes:
- Seed one owner user for the initial build.
- Keep the table even for single-user mode so auth does not need to be redesigned later.

### `roles`

- `id`
- `slug`
- `name`
- `description`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`

Seed values:
- `developer`
- `realtor`
- `adjuster`
- `venture`
- `executive`
- `knowledge`

### `projects`

- `id`
- `slug`
- `name`
- `summary`
- `description`
- `status`
- `primary_role_id`
- `owner_id`
- `priority`
- `target_start_at`
- `target_end_at`
- `last_reviewed_at`
- `is_active`
- `created_at`
- `updated_at`

Notes:
- Start with one primary role per project.
- Use `priority_level` for the `priority` field.
- If cross-role projects become common, add `project_roles` later.

### `tasks`

- `id`
- `project_id` nullable
- `section_id` nullable
- `parent_task_id` nullable
- `role_id` nullable
- `owner_id`
- `title`
- `description` nullable
- `status`
- `priority`
- `scheduled_for` nullable
- `due_at` nullable
- `deadline_at` nullable
- `is_recurring`
- `recurrence_rule` nullable
- `completed_at` nullable
- `archived_at` nullable
- `blocked_reason` nullable
- `sort_order` nullable
- `source_type` nullable
- `source_key` nullable
- `created_at`
- `updated_at`

Notes:
- Use `priority_level` for the `priority` field.
- Keep inbox tasks projectless until they are clarified.
- Derive `today`, `overdue`, and `upcoming` from dates instead of storing them as statuses.
- Use `source_type` and `source_key` to support safe API-driven task creation from other applications.

### `task_sections`

- `id`
- `project_id`
- `name`
- `sort_order`
- `archived_at` nullable
- `created_at`
- `updated_at`

Notes:
- Sections are project-scoped and should be orderable.
- This replaces the need to overload status for project-stage grouping.

### `task_labels`

- `id`
- `slug`
- `name`
- `color` nullable
- `created_at`

Notes:
- Keep task labels separate from the broader `tags` model if task filtering becomes high-traffic.
- If the wider tag model is sufficient in production, this table can collapse back into `tags`.

### `task_comments`

- `id`
- `task_id`
- `author_id`
- `body_markdown`
- `created_at`
- `updated_at`

Notes:
- This is optional in the first implementation pass.
- It becomes important once tasks are created by multiple systems and need durable audit context.

### `task_external_refs`

- `id`
- `task_id`
- `source_type`
- `source_key`
- `payload_json` nullable
- `created_at`
- `updated_at`

Notes:
- Add a unique index on `source_type + source_key`.
- This is the preferred place to anchor external-system references if one task can have more than one source relationship.

### `ideas`

- `id`
- `role_id` nullable
- `title`
- `summary`
- `problem`
- `opportunity`
- `status`
- `decision_notes` nullable
- `converted_project_id` nullable
- `created_at`
- `updated_at`

### `knowledge_items`

- `id`
- `type`
- `title`
- `summary` nullable
- `body_markdown`
- `status`
- `source_notes` nullable
- `owner_id`
- `created_at`
- `updated_at`
- `reviewed_at` nullable

Notes:
- Store version 1 content as Markdown.
- Use `knowledge_status` for the `status` field.
- This table is the primary durable-memory object.

### `decisions`

- `id`
- `project_id` nullable
- `title`
- `summary`
- `rationale`
- `status`
- `decided_at` nullable
- `owner_id`
- `created_at`
- `updated_at`

Notes:
- Use `decision_status` for the `status` field.
- This can be folded into `knowledge_items` later if the separate object proves unnecessary.

### `external_resources`

- `id`
- `type`
- `title`
- `url`
- `description` nullable
- `system_name` nullable
- `owner_id`
- `created_at`
- `updated_at`

### `tags`

- `id`
- `slug`
- `name`
- `color` nullable
- `created_at`

## Join Tables

### `project_knowledge_items`

- `project_id`
- `knowledge_item_id`

### `task_knowledge_items`

- `task_id`
- `knowledge_item_id`

### `project_external_resources`

- `project_id`
- `external_resource_id`

### `knowledge_external_resources`

- `knowledge_item_id`
- `external_resource_id`

### `decision_external_resources`

- `decision_id`
- `external_resource_id`

### `project_tags`

- `project_id`
- `tag_id`

### `task_tags`

- `task_id`
- `tag_id`

### `task_labels_tasks`

- `task_id`
- `task_label_id`

### `knowledge_item_tags`

- `knowledge_item_id`
- `tag_id`

## Tables That Can Wait

- `dashboard_layouts`
- `saved_views`
- `review_runs`
- `notifications`
- `connector_definitions`
- `sync_jobs`
- `attachments`

Task-specific exception:

- `task_sections` and `task_external_refs` should move into the earlier phases, not stay deferred, because they directly support the task-system replacement goal.

These should not block the first migration.

## Search Plan

Use PostgreSQL full-text search before adding any extra service.

- Add searchable text coverage to `projects`, `tasks`, `ideas`, `knowledge_items`, and `external_resources`.
- Start with per-table queries plus a unified API layer.
- Only introduce a dedicated search engine if real usage proves PostgreSQL insufficient.

## Prisma Build Order

1. Create enums and base tables.
2. Add one-to-many relations.
3. Add join tables.
4. Add task rebuild tables: `task_sections`, `task_external_refs`, and task self-reference.
5. Seed roles, owner account, and a few starter tasks.
6. Add indexes for `status`, `due_at`, `updated_at`, `source_type + source_key`, and search-heavy title fields.
