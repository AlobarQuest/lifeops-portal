import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ProjectDeleteForm } from "@/components/project-delete-form";
import { ProjectDocumentEditor } from "@/components/project-document-editor";
import { ProjectMetadataForm } from "@/components/project-metadata-form";
import { SectionCard } from "@/components/section-card";
import { getCurrentUser } from "@/lib/current-user";
import {
  getProjectDocumentDefinition,
  getProjectDocumentSlug,
  getProjectDocumentTypeFromSlug,
} from "@/lib/project-documents";
import {
  formatProjectPriorityLabel,
  formatProjectStatusLabel,
  getProjectWorkspaceBySlug,
  listProjectRoles,
} from "@/lib/projects";

type ProjectDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    doc?: string;
  }>;
};

function formatDateLabel(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateInputValue(date: Date | null) {
  if (!date) {
    return undefined;
  }

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [project, roleOptions] = await Promise.all([
    getProjectWorkspaceBySlug(slug, currentUser.id),
    listProjectRoles(),
  ]);

  if (!project) {
    notFound();
  }

  const activeType = getProjectDocumentTypeFromSlug(query.doc);
  const activeDocument =
    project.documents.find((document) => document.type === activeType) ?? project.documents[0];

  if (!activeDocument) {
    notFound();
  }

  const activeDefinition = getProjectDocumentDefinition(activeDocument.type);

  if (!activeDefinition) {
    notFound();
  }

  return (
    <AppShell eyebrow={project.primaryRole?.name ?? "Project"} title={project.name}>
      <div className="stack">
        <section className="detail-hero">
          <div className="section-heading">
            <div>
              <h3>{project.summary}</h3>
              <p>{project.description ?? "This project now keeps its planning artifacts directly inside LifeOps."}</p>
            </div>
            <div className="meta-row">
              <span className="pill">{formatProjectStatusLabel(project.status)}</span>
              <span className="pill">{formatProjectPriorityLabel(project.priority)}</span>
              {project.primaryRole ? <span className="pill">{project.primaryRole.name}</span> : null}
            </div>
          </div>

          <div className="detail-grid">
            <article>
              <strong>Document pack</strong>
              <p>{project.documents.length} core project artifacts live inside this page.</p>
            </article>
            <article>
              <strong>Task load</strong>
              <p>{project.tasks.length} linked tasks currently sit under this project.</p>
            </article>
            <article>
              <strong>Task sections</strong>
              <p>{project.taskSections.length} active sections currently shape the project board.</p>
            </article>
            <article>
              <strong>Last reviewed</strong>
              <p>{formatDateLabel(project.lastReviewedAt)}</p>
            </article>
          </div>
        </section>

        <section className="project-workspace-layout">
          <SectionCard
            title="Project document pack"
            caption="Move across the default artifact set without leaving the project page."
          >
            <div className="document-nav">
              {project.documents.map((document) => {
                const definition = getProjectDocumentDefinition(document.type);

                if (!definition) {
                  return null;
                }

                const href = `/projects/${project.slug}?doc=${getProjectDocumentSlug(document.type)}`;
                const isActive = document.type === activeDocument.type;

                return (
                  <Link
                    className={`document-nav-item ${isActive ? "active" : ""}`}
                    href={href}
                    key={document.id}
                  >
                    <strong>{definition.title}</strong>
                    <p>{definition.description}</p>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title={activeDefinition.title}
            caption="All document bodies are editable in-place and saved to PostgreSQL."
          >
            <ProjectDocumentEditor
              bodyMarkdown={activeDocument.bodyMarkdown}
              documentDescription={activeDefinition.description}
              documentTitle={activeDefinition.title}
              documentType={activeDocument.type}
              key={activeDocument.id}
              projectSlug={project.slug}
              updatedAt={formatDateLabel(activeDocument.updatedAt)}
            />
          </SectionCard>
        </section>

        <section className="two-column">
          <SectionCard
            title="Project task board"
            caption="This is the live project task board. Keep board-specific notes in the Task Board document above, and execution items here."
          >
            <div className="stack">
              {project.tasks.length === 0 ? (
                <div className="list">
                  <div className="list-item">
                    <strong>No project tasks yet</strong>
                    <p>Use the shared task flow to attach work to this project and keep execution visible here.</p>
                  </div>
                </div>
              ) : null}

              {project.sectionGroups.map((group) => (
                <div key={group.id}>
                  <div className="section-heading">
                    <div>
                      <h4>{group.name}</h4>
                      <p>{group.tasks.length} task{group.tasks.length === 1 ? "" : "s"} in this lane.</p>
                    </div>
                  </div>

                  <div className="list">
                    {group.tasks.length === 0 ? (
                      <div className="list-item">
                        <strong>No tasks in this section</strong>
                        <p>External callers can now place tasks here through the task section APIs.</p>
                      </div>
                    ) : null}

                    {group.tasks.map((task) => (
                      <div className="list-item" key={task.id}>
                        <strong>{task.title}</strong>
                        {task.parentTask ? <p>Subtask of: {task.parentTask.title}</p> : null}
                        {task.blockedReason ? <p>Blocked by: {task.blockedReason}</p> : null}
                        <div className="meta-row">
                          <span className="pill">{task.statusLabel}</span>
                          <span className="pill">{task.priorityLabel}</span>
                          <span className="pill">{task.dueLabel}</span>
                          {task.parentTaskId ? <span className="pill">Subtask</span> : null}
                          {task.tags.map((taskTag) => (
                            <span className="pill" key={taskTag.tag.id}>
                              #{taskTag.tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="subtle-grid">
            <SectionCard
              title="Project settings"
              caption="Edit the project record here. The actual project documents remain editable in the workspace above."
            >
              <ProjectMetadataForm
                description={project.description}
                name={project.name}
                primaryRoleId={project.primaryRole?.id}
                priority={project.priority}
                projectSlug={project.slug}
                roleOptions={roleOptions}
                status={project.status}
                summary={project.summary}
                targetEndOn={formatDateInputValue(project.targetEndAt)}
                targetStartOn={formatDateInputValue(project.targetStartAt)}
              />
            </SectionCard>

            <SectionCard
              title="Project context snapshot"
              caption="Keep the current working shape visible while the document pack carries the deeper details."
            >
              <div className="detail-grid single-column-grid">
                <article>
                  <strong>Target start</strong>
                  <p>{formatDateLabel(project.targetStartAt)}</p>
                </article>
                <article>
                  <strong>Target end</strong>
                  <p>{formatDateLabel(project.targetEndAt)}</p>
                </article>
                <article>
                  <strong>Workspace route</strong>
                  <p>/projects/{project.slug}</p>
                </article>
              </div>
            </SectionCard>

            <SectionCard
              title="Danger zone"
              caption="Use this only when the project workspace should be removed altogether."
            >
              <ProjectDeleteForm projectName={project.name} projectSlug={project.slug} />
            </SectionCard>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
