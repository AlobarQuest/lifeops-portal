import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { tasks } from "@/lib/site-data";

export default function TasksPage() {
  return (
    <AppShell eyebrow="Execution" title="Tasks">
      <div className="stack">
        <PageHeader
          title="Master task list"
          description="Filter by role, project, priority, due date, and blocked state. The first build keeps the shape visible before wiring in persistence."
          actionLabel="Create task"
        />

        <SectionCard title="Working filters">
          <div className="pill-row">
            <span className="filter-pill active">All</span>
            <span className="filter-pill">Today</span>
            <span className="filter-pill">Overdue</span>
            <span className="filter-pill">Blocked</span>
            <span className="filter-pill">Developer</span>
          </div>
        </SectionCard>

        <SectionCard title="Task inventory" caption="These placeholders map directly to the Prisma models planned for the MVP.">
          <div className="list">
            {tasks.map((task) => (
              <div className="list-item" key={task.title}>
                <strong>{task.title}</strong>
                <p>{task.project}</p>
                <div className="meta-row">
                  <span className="pill">{task.status}</span>
                  <span className="pill">{task.priority}</span>
                  <span className="pill">{task.due}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

