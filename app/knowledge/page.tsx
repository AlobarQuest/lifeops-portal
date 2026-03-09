import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { knowledgeItems } from "@/lib/site-data";

export default function KnowledgePage() {
  return (
    <AppShell eyebrow="Knowledge" title="Repository">
      <div className="stack">
        <PageHeader
          title="Durable knowledge"
          description="Knowledge is a first-class object, not an attachment. Store SOPs, lessons, research, definitions, and decisions directly in the portal."
          actionLabel="Create note"
        />

        <SectionCard title="Suggested filters">
          <div className="pill-row">
            <span className="filter-pill active">All</span>
            <span className="filter-pill">SOP</span>
            <span className="filter-pill">Decision</span>
            <span className="filter-pill">Reference</span>
          </div>
        </SectionCard>

        <SectionCard title="Knowledge items">
          <div className="list">
            {knowledgeItems.map((item) => (
              <div className="list-item" key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                <div className="meta-row">
                  <span className="pill">{item.type}</span>
                  <span className="pill">Markdown body</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

