import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

const settingGroups = [
  {
    title: "Roles",
    summary: "Developer, Realtor, Adjuster, Venture, Executive, and Knowledge seed the portal lens model.",
  },
  {
    title: "Statuses",
    summary: "Project, task, idea, and knowledge states should stay opinionated and short.",
  },
  {
    title: "Templates",
    summary: "Project templates can follow after the first live workflows are validated.",
  },
];

export default function SettingsPage() {
  return (
    <AppShell eyebrow="Configuration" title="Settings">
      <div className="stack">
        <PageHeader
          title="Initial configuration"
          description="Version 1 remains lightweight. Settings are intentionally narrow until real usage shows what deserves abstraction."
        />

        <SectionCard title="Configuration domains">
          <div className="detail-grid">
            {settingGroups.map((group) => (
              <article key={group.title}>
                <strong>{group.title}</strong>
                <p>{group.summary}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

