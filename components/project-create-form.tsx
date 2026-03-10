"use client";

import { useActionState } from "react";

import {
  createProjectAction,
  type ProjectFormActionState,
} from "@/app/actions/projects";

type ProjectCreateFormProps = {
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

export function ProjectCreateForm({ roleOptions }: ProjectCreateFormProps) {
  const initialState: ProjectFormActionState = {
    status: "idle",
    message: "",
  };

  const [state, formAction, isPending] = useActionState(createProjectAction, initialState);

  return (
    <form action={formAction} className="project-form">
      {state.status === "error" ? <div className="error-banner">{state.message}</div> : null}

      <div className="field">
        <label htmlFor="project-name">Project name</label>
        <input
          id="project-name"
          name="name"
          placeholder="Client portal refresh"
          required
          type="text"
        />
      </div>

      <div className="field">
        <label htmlFor="project-summary">Summary</label>
        <textarea
          id="project-summary"
          name="summary"
          placeholder="What this project is, why it matters, and what success should change."
          required
          rows={3}
        />
      </div>

      <div className="field">
        <label htmlFor="project-description">Working description</label>
        <textarea
          id="project-description"
          name="description"
          placeholder="Any initial context, constraints, or framing notes."
          rows={5}
        />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="project-status">Status</label>
          <select defaultValue="DRAFT" id="project-status" name="status">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="project-priority">Priority</label>
          <select defaultValue="MEDIUM" id="project-priority" name="priority">
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="project-role">Primary role</label>
          <select defaultValue="" id="project-role" name="primaryRoleId">
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
          <input id="project-start" name="targetStartOn" type="date" />
        </div>

        <div className="field">
          <label htmlFor="project-end">Target end</label>
          <input id="project-end" name="targetEndOn" type="date" />
        </div>
      </div>

      <p className="support-text">
        Creating a project also creates its full document pack. The detailed charter, brief, backlog, architecture,
        and other project documents are edited inside the project page after creation.
      </p>

      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? "Creating..." : "Create project"}
      </button>
    </form>
  );
}
