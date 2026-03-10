# Screen Inventory

This screen plan turns the navigation model from the source documents into an MVP route inventory and build order.

## Route Map

### `/`

Purpose:
Home dashboard for daily execution and fast situational awareness.

MVP contents:
- today tasks
- overdue tasks
- blocked tasks
- active projects
- recent knowledge
- quick capture entry point

### `/tasks`

Purpose:
Master task list with filters and sorting.

MVP contents:
- status tabs or filter bar
- filters for role, project, due date, priority, blocked
- create task action
- task detail/edit panel or dedicated page
- API-aligned quick capture so the UI and external callers use the same task model

Current implementation note:
- `/tasks` is now database-backed and includes the first quick-add flow
- the next step is richer edit/detail behavior plus project/section organization

### `/projects`

Purpose:
List of all projects with status visibility.

MVP contents:
- project cards or rows
- filters for role, status, active/inactive
- create project action

### `/projects/[slug]`

Purpose:
Single project dashboard.

MVP contents:
- project summary and status
- next actions
- blockers
- linked tasks
- linked knowledge
- linked decisions
- linked external resources

### `/ideas`

Purpose:
Intake queue for concepts and possible future projects.

MVP contents:
- capture form
- status filters
- approve/reject/park actions
- convert to project action

### `/knowledge`

Purpose:
Embedded repository for durable internal notes.

MVP contents:
- searchable list
- filters by type, role, project, tag
- create/edit knowledge item
- rich text or markdown body editing

### `/resources`

Purpose:
Registry of external tools, documents, repos, and systems.

MVP contents:
- list of links
- filters by type and role
- create/edit resource
- quick open to external URL

### `/reviews`

Purpose:
Weekly review and stale work surfacing.

MVP contents:
- overdue tasks section
- blocked work section
- stale active projects
- ideas pending decision

### `/settings`

Purpose:
Low-volume configuration for the MVP.

MVP contents:
- role management
- statuses and tag management
- owner password rotation
- future API token rotation and integration settings

## Non-UI Route Inventory

### `/api/tasks`

Purpose:
Protected task API surface for browser calls and internal application access.

Current contents:
- `GET` task listing
- `POST` task creation
- `PATCH` task update and complete/reopen behavior

Current auth paths:
- owner browser session
- `Authorization: Bearer <INTERNAL_API_TOKEN>`
- `x-lifeops-token: <INTERNAL_API_TOKEN>`

Next additions:
- idempotent create/update support
- external source keys
- project and section helper routes

## Widget Inventory For Home

- `Today`
- `Overdue`
- `Blocked`
- `Active Projects`
- `Recent Knowledge`
- `Quick Capture`

Do not build configurable dashboards first. Ship a fixed widget layout, then add configuration later if usage demands it.

## Quick Capture Plan

The quickest capture flow should be reachable from every screen.

Version 1 capture targets:
- task
- idea
- knowledge item
- external resource

Refinement can happen later on the dedicated pages.

## Recommended Build Order

1. `/` with placeholder widgets
2. `/tasks`
3. `/projects`
4. `/projects/[slug]`
5. `/knowledge`
6. `/ideas`
7. `/resources`
8. `/reviews`
9. `/settings`

## Acceptance Checks For The MVP

- Devon can decide what to work on from the home screen.
- Every active project has a dashboard with context, not just a title and status.
- New tasks, ideas, and knowledge can be captured in under a minute.
- Searchable knowledge is available without leaving the portal.
- External tools are reachable from inside the portal without pretending to replace them.
