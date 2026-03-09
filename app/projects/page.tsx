import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { projects } from "@/lib/site-data";

export default function ProjectsPage() {
  return (
    <AppShell eyebrow="Planning" title="Projects">
      <div className="stack">
        <PageHeader
          title="Project dashboards"
          description="Projects stay contextual: status, next actions, blockers, knowledge, decisions, and linked resources."
          actionLabel="Create project"
        />

        <SectionCard title="Project list">
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
      </div>
    </AppShell>
  );
}

