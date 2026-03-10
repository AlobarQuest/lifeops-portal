import { AppShell } from "@/components/app-shell";
import { PasswordChangeForm } from "@/components/password-change-form";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getConfiguredEmail } from "@/lib/auth";

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
  const ownerEmail = getConfiguredEmail();

  return (
    <AppShell eyebrow="Configuration" title="Settings">
      <div className="stack">
        <PageHeader
          title="Initial configuration"
          description="Version 1 remains lightweight. Settings are intentionally narrow until real usage shows what deserves abstraction."
        />

        <SectionCard
          title="Owner sign-in"
          caption="The owner password is now persisted in the application database and can be rotated from here."
        >
          <PasswordChangeForm ownerEmail={ownerEmail || "AUTH_EMAIL is not configured"} />
        </SectionCard>

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
