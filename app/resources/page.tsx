import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { resources } from "@/lib/site-data";

export default function ResourcesPage() {
  return (
    <AppShell eyebrow="Orchestration" title="Resources">
      <div className="stack">
        <PageHeader
          title="External resource registry"
          description="The portal coordinates outside tools from one place before attempting deep API integrations."
          actionLabel="Add resource"
        />

        <SectionCard title="Connected links">
          <div className="list">
            {resources.map((resource) => (
              <a className="list-item" href={resource.url} key={resource.title} rel="noreferrer" target="_blank">
                <strong>{resource.title}</strong>
                <p>{resource.summary}</p>
                <div className="meta-row">
                  <span className="pill">{resource.type}</span>
                  <span className="pill">{resource.url}</span>
                </div>
              </a>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

