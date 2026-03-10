import Link from "next/link";
import { redirect } from "next/navigation";

import { toggleTaskCompletionAction } from "@/app/actions/tasks";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { TaskQuickAddForm } from "@/components/task-quick-add-form";
import { getCurrentUser } from "@/lib/current-user";
import {
  formatTaskDueLabel,
  getTaskCounts,
  getTaskPriorityLabel,
  getTaskStatusLabel,
  getTaskViewLabel,
  listTaskProjects,
  listTasks,
} from "@/lib/tasks";
import { type TaskView, taskViewValues } from "@/lib/task-validators";

type TasksPageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

const taskViews: TaskView[] = [...taskViewValues];

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/tasks");
  }

  const params = await searchParams;
  const activeView = taskViews.includes(params.view as TaskView) ? (params.view as TaskView) : "all";

  const [tasks, counts, projectOptions] = await Promise.all([
    listTasks({
      ownerId: currentUser.id,
      view: activeView,
    }),
    getTaskCounts(currentUser.id),
    listTaskProjects(),
  ]);

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
                const href = view === "all" ? "/tasks" : `/tasks?view=${view}`;

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
              ? "This list is now backed by the database instead of placeholder site data."
              : "No tasks match this view yet. Capture one above to start replacing the external task system."
          }
        >
          <div className="list">
            {tasks.length === 0 ? (
              <div className="list-item">
                <strong>No tasks yet</strong>
                <p>
                  Start with a single capture in inbox or next. The task API is now ready to become the shared task
                  entrypoint for other internal applications.
                </p>
              </div>
            ) : null}

            {tasks.map((task) => (
              <div className="list-item task-row" key={task.id}>
                <div className="task-row-main">
                  <strong>{task.title}</strong>
                  <p>{task.project?.name ?? "Inbox / unassigned project"}</p>
                  {task.description ? <p>{task.description}</p> : null}
                  {task.blockedReason ? <p>Blocked by: {task.blockedReason}</p> : null}
                  <div className="meta-row">
                    <span className="pill">{getTaskStatusLabel(task.status)}</span>
                    <span className="pill">{getTaskPriorityLabel(task.priority)}</span>
                    <span className="pill">{formatTaskDueLabel(task.dueAt)}</span>
                    {task.role ? <span className="pill">{task.role.name}</span> : null}
                  </div>
                </div>

                <div className="task-actions">
                  <form action={toggleTaskCompletionAction}>
                    <input name="taskId" type="hidden" value={task.id} />
                    <input
                      name="mode"
                      type="hidden"
                      value={task.status === "DONE" ? "reopen" : "complete"}
                    />
                    <button className="secondary-inline-button" type="submit">
                      {task.status === "DONE" ? "Reopen" : "Mark done"}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
