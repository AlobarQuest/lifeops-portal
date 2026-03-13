import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";
import { getCurrentUser } from "@/lib/current-user";
import {
  formatTaskDueLabel,
  getTaskCounts,
  getTaskPriorityLabel,
  getTaskStatusLabel,
  listTasks,
} from "@/lib/tasks";
import { knowledgeItems, projects } from "@/lib/site-data";

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const [counts, executionTasks] = currentUser
    ? await Promise.all([
        getTaskCounts(currentUser.id),
        listTasks({
          ownerId: currentUser.id,
          view: "all",
          limit: 4,
        }),
      ])
    : [
        {
          all: 0,
          inbox: 0,
          today: 0,
          overdue: 0,
          blocked: 0,
          completed: 0,
        },
        [],
      ];

  const dashboardMetrics = [
    { label: "Open Tasks", value: String(counts.all), tone: "sunrise" },
    { label: "Today", value: String(counts.today), tone: "atlas" },
    { label: "Blocked", value: String(counts.blocked), tone: "ember" },
    { label: "Completed", value: String(counts.completed), tone: "mint" },
  ];

  return (
    <AppShell eyebrow="Executive Overview" title="Today has shape, pressure, and context.">
      <div className="stack">
        <section className="metrics-grid">
          {dashboardMetrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
          ))}
        </section>

        <section className="two-column">
          <SectionCard
            title="Active projects"
            caption="The MVP starts with real project dashboards instead of disconnected task lists."
          >
            <div className="list">
              {projects.map((project) => (
                <Link className="list-item" href={`/projects/${project.slug}`} key={project.slug}>
                  <strong>{project.name}</strong>
                  <p>{project.summary}</p>
                  <div className="meta-row">
                    <span className="pill">{project.role}</span>
                    <span className="pill">{project.status}</span>
                    <span className="pill">{project.nextAction}</span>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Execution lane" caption="Immediate work, blockers, and useful memory stay visible together.">
            <div className="list">
              {executionTasks.length === 0 ? (
                <div className="list-item">
                  <strong>No live tasks yet</strong>
                  <p>Capture the first real task in the Tasks section to replace the placeholder execution lane.</p>
                </div>
              ) : null}

              {executionTasks.map((task) => (
                <div className="list-item" key={task.id}>
                  <strong>{task.title}</strong>
                  <p>{task.project?.name ?? "Inbox / unassigned project"}</p>
                  <div className="meta-row">
                    <span className="pill">{getTaskStatusLabel(task.status)}</span>
                    <span className="pill">{getTaskPriorityLabel(task.priority)}</span>
                    <span className="pill">{formatTaskDueLabel(task.dueAt)}</span>
                    {task.section ? <span className="pill">{task.section.name}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </section>

        <SectionCard title="Recent knowledge" caption="Knowledge remains a first-class object in version 1.">
          <div className="detail-grid">
            {knowledgeItems.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                <div className="meta-row">
                  <span className="pill">{item.type}</span>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
