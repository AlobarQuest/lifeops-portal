import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { reviews } from "@/lib/site-data";

export default function ReviewsPage() {
  return (
    <AppShell eyebrow="Weekly Review" title="Reviews">
      <div className="stack">
        <PageHeader
          title="Review cadence"
          description="Overdue work, blocked work, stale projects, and idea decisions belong in one review flow."
          actionLabel="Run weekly review"
        />

        <SectionCard title="What needs attention now">
          <div className="list">
            {reviews.map((review) => (
              <div className="list-item" key={review}>
                <strong>{review}</strong>
                <p>Review support will eventually be backed by live task and project queries.</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

