# Task System Update Charter, Spec, and Delivery Plan

## Purpose

Replace Todoist as the primary task system with a first-party task capability inside LifeOps Portal.

This update treats Todoist as:

- a benchmark for useful task-management behavior
- a migration source for existing tasks
- not a long-term system integration target

## Current State

Today, the `/tasks` section is a static placeholder:

- task rows come from `lib/site-data.ts`
- filters are visual only
- there is no create, edit, complete, reorder, or API workflow
- other applications cannot create or update tasks through LifeOps Portal

That is acceptable for MVP scaffolding, but it is not sufficient if tasks are meant to become a shared execution layer across the wider system.

## Todoist Benchmark Findings

Todoist's public API shows a task model that is useful as a benchmark for a practical personal task system:

- tasks belong to projects and can also belong to sections
- tasks can have parent tasks, labels, priorities, due data, optional deadlines, duration, and explicit order
- task creation supports natural-language due input (`due_string` and `due_lang`)
- projects have their own order, color, default view style, inbox/favorite flags, and archived state
- sections are first-class objects within projects and have their own ordering

Inference:
Todoist is effective not because it has one giant task table, but because it combines a small set of stable task primitives with derived views such as inbox, today, upcoming, and project-based execution.

LifeOps Portal should copy that product shape where it is useful, but keep the design narrower for a single-owner, API-first system.

## Product Charter

### Objective

Build a task system inside LifeOps Portal that is strong enough to replace Todoist for day-to-day planning and execution while also serving as the central task API for other Devon-owned applications.

### Success Definition

The task section is successful when:

- new tasks can be captured inside LifeOps Portal faster than they can be captured in Todoist
- active work can be managed from inbox, today, upcoming, blocked, and project views
- other internal applications can create and update tasks through a stable LifeOps API
- projects, knowledge, and tasks are linked in one system instead of split across separate tools
- Todoist is no longer required for daily execution

### Product Principles

- API-first: every task action that matters in the UI should also be available through the app API
- single-owner first: optimize for one primary operator before adding team or collaboration complexity
- derived views over status sprawl: today, overdue, upcoming, and blocked should mostly be query logic, not separate workflow states
- project context matters: tasks should sit naturally inside projects and sections, not float as isolated checklist items
- migration, not sync: import from Todoist if needed, but do not build two-way sync

### Non-Goals

- two-way Todoist sync
- shared-team assignment and permissions beyond the owner account
- reminders, email notifications, and mobile parity in the first task rebuild
- full automation rules engine in the first task rebuild

## Product Spec

### User Jobs

The updated task system must support these jobs:

- capture a task quickly before it is lost
- decide where a task belongs: inbox, project, and optionally section
- focus on the right work for today
- see what is overdue, blocked, and due next
- break work into smaller sub-tasks when needed
- move tasks between projects and sections without losing context
- let other applications create or update tasks through API calls
- review completed work and recover context later

### Required Version 1 Capabilities

#### 1. Capture and edit

- quick task creation from `/tasks`
- create task inside a project or section
- task title, notes, project, section, labels, priority, due date, and blocked reason
- edit task inline or in a detail panel
- complete, reopen, archive, and delete task actions

#### 2. Views

- inbox
- today
- upcoming
- overdue
- blocked
- all tasks
- project view
- section view inside project

#### 3. Task structure

- parent task and sub-task support
- ordering within a list or section
- multiple labels
- project linkage
- optional knowledge links and resource links

#### 4. Scheduling

- due date
- optional deadline date
- recurring schedule support
- natural-language date capture is desirable, but parser quality can start narrow

#### 5. Workflow

- workflow status should be limited and opinionated:
  - `inbox`
  - `next`
  - `in_progress`
  - `blocked`
  - `done`
  - `canceled`
- today, overdue, and upcoming should be derived from dates, not stored as statuses

#### 6. API support for other apps

Other applications should be able to:

- create a task
- update a task
- mark a task done
- fetch tasks by state, project, label, due window, and external source
- attach an external reference so duplicate tasks are not created

### Recommended Version 1 API Surface

These routes are enough to make the task section useful as shared infrastructure:

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/complete`
- `POST /api/tasks/:id/reopen`
- `POST /api/tasks/:id/archive`
- `POST /api/task-projects`
- `PATCH /api/task-projects/:id`
- `POST /api/task-sections`
- `PATCH /api/task-sections/:id`

Request design requirements:

- support an `external_source` and `external_key`
- support an idempotency key for create flows
- return stable IDs that can be stored by other systems
- support filter parameters for `status`, `project_id`, `section_id`, `label`, `due_before`, `due_after`, `blocked`, and `completed`

### Proposed Schema Delta

The current schema draft is too thin for replacing Todoist. Update the task model to include:

#### `tasks`

- `id`
- `project_id` nullable
- `section_id` nullable
- `parent_task_id` nullable
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
- `blocked_reason` nullable
- `completed_at` nullable
- `archived_at` nullable
- `sort_order` nullable
- `source_type` nullable
- `source_key` nullable
- `created_at`
- `updated_at`

Notes:

- `scheduled_for` covers "do this on this day" behavior
- `due_at` covers due date/time pressure
- `deadline_at` covers harder commitments
- `source_type` and `source_key` are required for safe cross-app API writes

#### `task_sections`

- `id`
- `project_id`
- `name`
- `sort_order`
- `archived_at` nullable
- `created_at`
- `updated_at`

#### `task_labels`

- `id`
- `name`
- `slug`
- `color` nullable
- `created_at`

#### `task_comments`

- `id`
- `task_id`
- `author_id`
- `body_markdown`
- `created_at`
- `updated_at`

#### `task_external_refs`

- `id`
- `task_id`
- `source_type`
- `source_key`
- `payload_json` nullable
- `created_at`
- `updated_at`

Constraint notes:

- unique index on `task_external_refs (source_type, source_key)`
- unique index on `tasks (source_type, source_key)` may also be acceptable if only one external ref is allowed

### UX Updates

The task section should move from a static list to a real operator surface:

- top bar with quick add
- saved views for inbox, today, upcoming, blocked, and all
- left-side project and section navigation
- main task list with multi-filter support
- detail drawer for editing without losing list context
- project page should show section-grouped tasks, not only a flat related-task list

Recommended first UI sequence:

1. `/tasks` list with real filters and quick add
2. task detail drawer
3. project task grouping by section
4. inbox and today saved views

## Delivery Plan

### Phase 1: Replace the placeholder with a real task domain

Deliver:

- Prisma schema update for tasks, sections, labels, comments, and external refs
- migrations
- seeded sample task data
- task CRUD server actions or route handlers
- `/tasks` backed by the database

Exit criteria:

- owner can create, edit, complete, reopen, and delete tasks
- filters work against persisted data
- `/tasks` no longer depends on `lib/site-data.ts`

### Phase 2: Build the core execution views

Deliver:

- inbox, today, upcoming, overdue, and blocked views
- project and section organization
- parent/sub-task support
- task detail drawer

Exit criteria:

- owner can manage daily work entirely inside LifeOps Portal
- project pages show live tasks grouped by section

### Phase 3: Add API-first task ingestion

Deliver:

- authenticated task API
- idempotent create/update behavior
- external source references
- request validation and audit logging

Exit criteria:

- another internal application can safely create and update tasks without duplicate creation
- task ownership and source attribution remain clear

### Phase 4: Close the Todoist replacement gap

Deliver:

- recurrence support
- CSV or API-assisted one-time import from Todoist
- completed-task archive views
- saved filters if still needed after real usage

Exit criteria:

- current active tasks can be migrated from Todoist
- Todoist can be retired from daily workflow

## Recommended Immediate Backlog

1. Update `docs/schema-draft.md` task-related tables to match the schema delta above.
2. Replace static task placeholders with Prisma-backed queries.
3. Build task create/edit/complete flows before adding sophisticated filtering.
4. Add project sections and section grouping on project pages.
5. Add `external_source` and `external_key` support before exposing the task API to other applications.

## Open Decisions

- Should `project_id` remain nullable for inbox tasks, or should inbox be its own system project?
- Should recurring logic be stored as a simple rule string first, or as a more structured recurrence model?
- Should comments ship in the first pass, or can task notes cover the initial need?
- Should section order be manual only, or should tasks also support priority-first smart sorting?

## Source Notes

Todoist public docs used as the benchmark reference:

- Unified API task examples show task support for project, section, parent task, labels, priority, due input, deadline, duration, order, and completion state.
- Unified API project examples show inbox/favorite flags, view style, archived state, and ordering.
- Unified API section examples show sections as first-class project children with ordering.

Official references:

- https://developer.todoist.com/api/v1/
- https://developer.todoist.com/api/v1/#tag/Tasks
- https://developer.todoist.com/api/v1/#tag/Projects
- https://developer.todoist.com/api/v1/#tag/Sections
