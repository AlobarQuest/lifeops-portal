import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";
import { dashboardMetrics, knowledgeItems, projects, tasks } from "@/lib/site-data";

export default function HomePage() {
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

