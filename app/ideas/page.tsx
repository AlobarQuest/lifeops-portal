import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

const ideas = [
  {
    title: "Project intake scorecard",
    status: "Reviewing",
    summary: "Standardize the promote, park, or reject decision for new ideas.",
  },
  {
    title: "Role-specific dashboard presets",
    status: "Captured",
    summary: "Allow the portal home to shift emphasis by active domain.",
  },
  {
    title: "Weekly review digest",
    status: "Approved",
    summary: "Surface stale projects and blocked work before Monday planning.",
  },
];

export default function IdeasPage() {
  return (
    <AppShell eyebrow="Intake" title="Ideas">
      <div className="stack">
        <PageHeader
          title="Idea and intake queue"
          description="This screen converts loose thoughts into concrete work without forcing every idea into a project immediately."
          actionLabel="Capture idea"
        />

        <SectionCard title="Pipeline states">
          <div className="pill-row">
            <span className="filter-pill active">Captured</span>
            <span className="filter-pill">Reviewing</span>
            <span className="filter-pill">Approved</span>
            <span className="filter-pill">Parked</span>
          </div>
        </SectionCard>

        <SectionCard title="Current queue">
          <div className="list">
            {ideas.map((idea) => (
              <div className="list-item" key={idea.title}>
                <strong>{idea.title}</strong>
                <p>{idea.summary}</p>
                <div className="meta-row">
                  <span className="pill">{idea.status}</span>
                  <span className="pill">Convert to project</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

