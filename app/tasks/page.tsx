import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { TaskListManager } from "@/components/task-list-manager";
import { TaskQuickAddForm } from "@/components/task-quick-add-form";
import { getCurrentUser } from "@/lib/current-user";
import { listTaskSectionsForApi } from "@/lib/task-sections";
import {
  formatTaskDateInputValue,
  formatTaskDeadlineLabel,
  formatTaskDurationLabel,
  formatTaskDueLabel,
  formatTaskScheduledLabel,
  getTaskCounts,
  getTaskPriorityLabel,
  getTaskRecurrenceLabel,
  getTaskStatusLabel,
  getTaskViewLabel,
  listTaskProjects,
  listTasks,
} from "@/lib/tasks";
import { type TaskView, taskViewValues } from "@/lib/task-validators";

type TasksPageProps = {
  searchParams: Promise<{
    view?: string;
    includeArchived?: string;
  }>;
};

const taskViews: TaskView[] = [...taskViewValues];

function buildTasksHref(view: TaskView, includeArchived: boolean) {
  const params = new URLSearchParams();

  if (view !== "all") {
    params.set("view", view);
  }

  if (includeArchived) {
    params.set("includeArchived", "true");
  }

  const query = params.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/tasks");
  }

  const params = await searchParams;
  const activeView = taskViews.includes(params.view as TaskView) ? (params.view as TaskView) : "all";
  const includeArchived = params.includeArchived === "true";

  const [tasks, counts, projectOptions, sectionOptions] = await Promise.all([
    listTasks({
      ownerId: currentUser.id,
      view: activeView,
      includeArchived,
    }),
    getTaskCounts(currentUser.id),
    listTaskProjects(),
    listTaskSectionsForApi({
      ownerId: currentUser.id,
      limit: 200,
    }),
  ]);

  const taskItems = tasks.map((task) => ({
    id: task.id,
    sortOrder: task.sortOrder,
    parentTaskId: task.parentTaskId,
    title: task.title,
    description: task.description,
    status: task.status,
    statusLabel: getTaskStatusLabel(task.status),
    priority: task.priority,
    priorityLabel: getTaskPriorityLabel(task.priority),
    scheduledFor: formatTaskDateInputValue(task.scheduledFor),
    scheduledLabel: formatTaskScheduledLabel(task.scheduledFor),
    dueLabel: formatTaskDueLabel(task.dueAt),
    dueOn: formatTaskDateInputValue(task.dueAt),
    deadlineOn: formatTaskDateInputValue(task.deadlineAt),
    deadlineLabel: formatTaskDeadlineLabel(task.deadlineAt),
    durationMinutes: task.durationMinutes,
    durationLabel: formatTaskDurationLabel(task.durationMinutes),
    recurrenceRule: task.recurrenceRule,
    recurrenceLabel: getTaskRecurrenceLabel(task.recurrenceRule),
    updatedAt: task.updatedAt.toISOString(),
    blockedReason: task.blockedReason,
    archivedAt: task.archivedAt?.toISOString() ?? null,
    commentCount: task.comments.length,
    comments: task.comments.map((comment) => ({
      id: comment.id,
      bodyMarkdown: comment.bodyMarkdown,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: {
        id: comment.author.id,
        displayName: comment.author.displayName,
        email: comment.author.email,
      },
    })),
    labels: task.tags.map((taskTag) => ({
      id: taskTag.tag.id,
      name: taskTag.tag.name,
      slug: taskTag.tag.slug,
      color: taskTag.tag.color,
    })),
    parentTask: task.parentTask
      ? {
          id: task.parentTask.id,
          title: task.parentTask.title,
          status: task.parentTask.status,
          statusLabel: getTaskStatusLabel(task.parentTask.status),
        }
      : null,
    project: task.project
      ? {
          id: task.project.id,
          name: task.project.name,
        }
      : null,
    section: task.section
      ? {
          id: task.section.id,
          name: task.section.name,
          projectId: task.section.projectId,
        }
      : null,
    role: task.role
      ? {
          id: task.role.id,
          name: task.role.name,
        }
      : null,
  }));

  return (
    <AppShell eyebrow="Execution" title="Tasks">
      <div className="stack">
        <PageHeader
          title="Master task list"
          description="LifeOps tasks are now persisted in PostgreSQL and exposed through the app itself. Capture work here first, then let other internal apps write into the same task layer."
        />

        <section className="two-column">
          <SectionCard
            title="Quick capture"
            caption="The owner task flow starts with fast capture and minimal structure, then tasks can be clarified into projects and lanes."
          >
            <TaskQuickAddForm projectOptions={projectOptions} />
          </SectionCard>

          <SectionCard
            title="Working filters"
            caption="These views are query-based, not separate task states, so the same task can naturally surface in today or overdue without workflow duplication."
          >
            <div className="pill-row">
              {taskViews.map((view) => {
                const count = counts[view];
                const href = buildTasksHref(view, includeArchived);

                return (
                  <Link
                    className={`filter-pill ${view === activeView ? "active" : ""}`}
                    href={href}
                    key={view}
                  >
                    {getTaskViewLabel(view)} ({count})
                  </Link>
                );
              })}
              <Link
                className={`filter-pill ${includeArchived ? "active" : ""}`}
                href={buildTasksHref(activeView, !includeArchived)}
              >
                {includeArchived ? "Hide archived" : "Show archived"}
              </Link>
            </div>

            <div className="detail-grid">
              <article>
                <strong>API-first</strong>
                <p>`GET /api/tasks` and `POST /api/tasks` are now scaffolded for internal callers.</p>
              </article>
              <article>
                <strong>Single source</strong>
                <p>Tasks should move into LifeOps Portal instead of being split across Todoist and custom tools.</p>
              </article>
              <article>
                <strong>Current owner</strong>
                <p>{currentUser.email}</p>
              </article>
            </div>
          </SectionCard>
        </section>

        <SectionCard
          title={`${getTaskViewLabel(activeView)} tasks`}
          caption={
            tasks.length > 0
              ? includeArchived
                ? "Active and archived tasks are visible in this query. Labels and nested subtasks stay readable even when older work is archived."
                : "This list is now backed by the database, including labels and nested subtasks."
              : includeArchived
                ? "No tasks match this view, even with archived visibility enabled."
                : "No tasks match this view yet. Capture one above to start replacing the external task system."
          }
        >
          {taskItems.length === 0 ? (
            <div className="list">
              <div className="list-item">
                <strong>No tasks yet</strong>
                <p>
                  Start with a single capture in inbox or next. The task API is now ready to become the shared task
                  entrypoint for other internal applications.
                </p>
              </div>
            </div>
          ) : (
            <TaskListManager
              projectOptions={projectOptions}
              sectionOptions={sectionOptions.map((section) => ({
                id: section.id,
                name: section.name,
                projectId: section.project.id,
              }))}
              tasks={taskItems}
            />
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
