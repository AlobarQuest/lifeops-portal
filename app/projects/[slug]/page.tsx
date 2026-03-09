import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { knowledgeItems, projects, resources, tasks } from "@/lib/site-data";

type ProjectDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    notFound();
  }

  const relatedTasks = tasks.filter((task) => task.project === project.name);

  return (
    <AppShell eyebrow={project.role} title={project.name}>
      <div className="stack">
        <section className="detail-hero">
          <div className="section-heading">
            <div>
              <h3>{project.summary}</h3>
              <p>{project.nextAction}</p>
            </div>
            <div className="meta-row">
              <span className="pill">{project.status}</span>
              <span className="pill">{project.role}</span>
            </div>
          </div>
          <div className="meta-row">
            <span className="pill">Blocker: {project.blocker}</span>
          </div>
        </section>

        <section className="two-column">
          <SectionCard title="Next actions">
            <div className="list">
              {relatedTasks.map((task) => (
                <div className="list-item" key={task.title}>
                  <strong>{task.title}</strong>
                  <p>{task.status}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Linked resources">
            <div className="list">
              {resources.map((resource) => (
                <a className="list-item" href={resource.url} key={resource.title} rel="noreferrer" target="_blank">
                  <strong>{resource.title}</strong>
                  <p>{resource.summary}</p>
                </a>
              ))}
            </div>
          </SectionCard>
        </section>

        <SectionCard title="Knowledge context">
          <div className="detail-grid">
            {knowledgeItems.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

