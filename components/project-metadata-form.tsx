"use client";

import { useActionState } from "react";

import {
  updateProjectAction,
  type ProjectFormActionState,
} from "@/app/actions/projects";

type ProjectMetadataFormProps = {
  projectSlug: string;
  name: string;
  summary: string;
  description?: string | null;
  status: string;
  priority: string;
  primaryRoleId?: string | null;
  targetStartOn?: string;
  targetEndOn?: string;
  roleOptions: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
};

const statusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "PLANNED", label: "Planned" },
  { value: "ACTIVE", label: "Active" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
];

const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

export function ProjectMetadataForm({
  projectSlug,
  name,
  summary,
  description,
  status,
  priority,
  primaryRoleId,
  targetStartOn,
  targetEndOn,
  roleOptions,
}: ProjectMetadataFormProps) {
  const initialState: ProjectFormActionState = {
    status: "idle",
    message: "",
  };

  const [state, formAction, isPending] = useActionState(updateProjectAction, initialState);

  return (
    <form action={formAction} className="project-form">
      <input name="projectSlug" type="hidden" value={projectSlug} />

      {state.status === "error" ? <div className="error-banner">{state.message}</div> : null}
      {state.status === "success" ? <div className="success-banner">{state.message}</div> : null}

      <div className="field">
        <label htmlFor="project-name">Project name</label>
        <input defaultValue={name} id="project-name" name="name" required type="text" />
      </div>

      <div className="field">
        <label htmlFor="project-summary">Summary</label>
        <textarea defaultValue={summary} id="project-summary" name="summary" required rows={3} />
      </div>

      <div className="field">
        <label htmlFor="project-description">Working description</label>
        <textarea defaultValue={description ?? ""} id="project-description" name="description" rows={5} />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="project-status">Status</label>
          <select defaultValue={status} id="project-status" name="status">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="project-priority">Priority</label>
          <select defaultValue={priority} id="project-priority" name="priority">
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="project-role">Primary role</label>
          <select defaultValue={primaryRoleId ?? ""} id="project-role" name="primaryRoleId">
            <option value="">No primary role yet</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="project-start">Target start</label>
          <input defaultValue={targetStartOn ?? ""} id="project-start" name="targetStartOn" type="date" />
        </div>

        <div className="field">
          <label htmlFor="project-end">Target end</label>
          <input defaultValue={targetEndOn ?? ""} id="project-end" name="targetEndOn" type="date" />
        </div>
      </div>

      <p className="support-text">
        This form edits the project record itself. The actual charter, brief, backlog, architecture, test checklist,
        and other working documents stay editable in the document pack above.
      </p>

      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save project details"}
      </button>
    </form>
  );
}
