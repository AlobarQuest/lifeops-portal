import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProjectCreateForm } from "@/components/project-create-form";
import { SectionCard } from "@/components/section-card";
import { getCurrentUser } from "@/lib/current-user";
import {
  formatProjectPriorityLabel,
  formatProjectStatusLabel,
  listProjectRoles,
  listProjects,
} from "@/lib/projects";

export default async function ProjectsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/projects");
  }

  const [projects, roleOptions] = await Promise.all([
    listProjects(currentUser.id),
    listProjectRoles(),
  ]);

  return (
    <AppShell eyebrow="Planning" title="Projects">
      <div className="stack">
        <PageHeader
          title="Project workspaces"
          description="Each project now owns a stable working pack: charter, brief, backlog, requirements, architecture, data, decisions, task board, testing, deployment, AI rules, and context."
        />

        <SectionCard
          title="Create project workspace"
          caption="Start a project here, then manage its full document pack inside the project page."
        >
          <ProjectCreateForm roleOptions={roleOptions} />
        </SectionCard>

        <SectionCard
          title="Project list"
          caption="Open a project to work inside its document pack instead of scattering planning artifacts across separate tools."
        >
          <div className="list">
            {projects.length === 0 ? (
              <div className="list-item">
                <strong>No projects yet</strong>
                <p>Create the first project workspace above to start building out the pack.</p>
              </div>
            ) : null}

            {projects.map((project) => (
              <Link className="list-item project-list-item" href={`/projects/${project.slug}`} key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.summary}</p>
                  <div className="meta-row">
                    {project.primaryRole ? <span className="pill">{project.primaryRole.name}</span> : null}
                    <span className="pill">{formatProjectStatusLabel(project.status)}</span>
                    <span className="pill">{formatProjectPriorityLabel(project.priority)}</span>
                  </div>
                </div>

                <div className="project-list-stats">
                  <span className="pill">{project._count.documents} docs</span>
                  <span className="pill">{project._count.tasks} tasks</span>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
