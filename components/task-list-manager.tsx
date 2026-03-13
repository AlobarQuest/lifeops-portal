"use client";

import { useActionState, useState } from "react";

import {
  archiveTaskAction,
  toggleTaskCompletionAction,
  updateTaskAction,
  type TaskActionState,
} from "@/app/actions/tasks";

type TaskListManagerProps = {
  tasks: Array<{
    id: string;
    title: string;
    description?: string | null;
    status: string;
    statusLabel: string;
    priority: string;
    priorityLabel: string;
    dueLabel: string;
    dueOn?: string;
    updatedAt: string;
    blockedReason?: string | null;
    archivedAt?: string | null;
    project?: {
      id: string;
      name: string;
    } | null;
    section?: {
      id: string;
      name: string;
      projectId: string;
    } | null;
    role?: {
      id: string;
      name: string;
    } | null;
  }>;
  projectOptions: Array<{
    id: string;
    name: string;
  }>;
  sectionOptions: Array<{
    id: string;
    name: string;
    projectId: string;
  }>;
};

const initialState: TaskActionState = {
  status: "idle",
  message: "",
};

const statusOptions = [
  { value: "INBOX", label: "Inbox" },
  { value: "TODO", label: "Next" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
  { value: "CANCELED", label: "Canceled" },
];

const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

export function TaskListManager({
  tasks,
  projectOptions,
  sectionOptions,
}: TaskListManagerProps) {
  return (
    <div className="list">
      {tasks.map((task) => (
        <TaskListRow
          key={`${task.id}-${task.updatedAt}`}
          projectOptions={projectOptions}
          sectionOptions={sectionOptions}
          task={task}
        />
      ))}
    </div>
  );
}

function TaskListRow({
  task,
  projectOptions,
  sectionOptions,
}: {
  task: TaskListManagerProps["tasks"][number];
  projectOptions: TaskListManagerProps["projectOptions"];
  sectionOptions: TaskListManagerProps["sectionOptions"];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(task.project?.id ?? "");
  const [selectedSectionId, setSelectedSectionId] = useState(task.section?.id ?? "");
  const [state, formAction, isPending] = useActionState(updateTaskAction, initialState);

  const availableSections = sectionOptions.filter((section) => section.projectId === selectedProjectId);
  const isArchived = Boolean(task.archivedAt);

  return (
    <div className={`list-item task-row ${isArchived ? "task-row-archived" : ""}`}>
      <div className="task-row-main">
        <strong>{task.title}</strong>
        <p>{task.project?.name ?? "Inbox / unassigned project"}</p>
        {task.description ? <p>{task.description}</p> : null}
        {task.blockedReason ? <p>Blocked by: {task.blockedReason}</p> : null}
        <div className="meta-row">
          <span className="pill">{task.statusLabel}</span>
          <span className="pill">{task.priorityLabel}</span>
          <span className="pill">{task.dueLabel}</span>
          {task.section ? <span className="pill">{task.section.name}</span> : null}
          {task.role ? <span className="pill">{task.role.name}</span> : null}
          {isArchived ? <span className="pill">Archived</span> : null}
        </div>

        {isEditing ? (
          <form action={formAction} className="task-form task-edit-form">
            <input name="taskId" type="hidden" value={task.id} />

            {state.status === "error" ? <div className="error-banner">{state.message}</div> : null}
            {state.status === "success" ? <div className="success-banner">{state.message}</div> : null}

            <div className="field">
              <label htmlFor={`task-title-${task.id}`}>Title</label>
              <input defaultValue={task.title} id={`task-title-${task.id}`} name="title" required type="text" />
            </div>

            <div className="field">
              <label htmlFor={`task-description-${task.id}`}>Notes</label>
              <textarea
                defaultValue={task.description ?? ""}
                id={`task-description-${task.id}`}
                name="description"
                rows={4}
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor={`task-priority-${task.id}`}>Priority</label>
                <select defaultValue={task.priority} id={`task-priority-${task.id}`} name="priority">
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`task-status-${task.id}`}>Status</label>
                <select defaultValue={task.status} id={`task-status-${task.id}`} name="status">
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`task-due-on-${task.id}`}>Due date</label>
                <input defaultValue={task.dueOn ?? ""} id={`task-due-on-${task.id}`} name="dueOn" type="date" />
              </div>

              <div className="field">
                <label htmlFor={`task-project-${task.id}`}>Project</label>
                <select
                  id={`task-project-${task.id}`}
                  name="projectId"
                  onChange={(event) => {
                    const nextProjectId = event.target.value;
                    setSelectedProjectId(nextProjectId);

                    if (!availableSections.some((section) => section.id === selectedSectionId && section.projectId === nextProjectId)) {
                      setSelectedSectionId("");
                    }
                  }}
                  value={selectedProjectId}
                >
                  <option value="">Inbox / no project</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`task-section-${task.id}`}>Section</label>
                <select
                  disabled={!selectedProjectId}
                  id={`task-section-${task.id}`}
                  key={`${task.id}-${selectedProjectId}`}
                  name="sectionId"
                  onChange={(event) => {
                    setSelectedSectionId(event.target.value);
                  }}
                  value={selectedSectionId}
                >
                  <option value="">{selectedProjectId ? "No section" : "Choose a project first"}</option>
                  {availableSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`task-blocked-${task.id}`}>Blocked reason</label>
                <input
                  defaultValue={task.blockedReason ?? ""}
                  id={`task-blocked-${task.id}`}
                  name="blockedReason"
                  placeholder="Why this task is blocked right now"
                  type="text"
                />
              </div>
            </div>

            <div className="task-edit-actions">
              <button className="primary-button" disabled={isPending} type="submit">
                {isPending ? "Saving..." : "Save task"}
              </button>
              <button
                className="secondary-inline-button"
                onClick={() => {
                  setIsEditing(false);
                  setSelectedProjectId(task.project?.id ?? "");
                  setSelectedSectionId(task.section?.id ?? "");
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="task-actions task-actions-stack">
        {!isArchived ? (
          <>
            <form action={toggleTaskCompletionAction}>
              <input name="taskId" type="hidden" value={task.id} />
              <input
                name="mode"
                type="hidden"
                value={task.status === "DONE" ? "reopen" : "complete"}
              />
              <button className="secondary-inline-button" type="submit">
                {task.status === "DONE" ? "Reopen" : "Mark done"}
              </button>
            </form>

            <button
              className="secondary-inline-button"
              onClick={() => {
                setIsEditing((value) => !value);
              }}
              type="button"
            >
              {isEditing ? "Close editor" : "Edit"}
            </button>

            <form action={archiveTaskAction}>
              <input name="taskId" type="hidden" value={task.id} />
              <button className="secondary-inline-button" type="submit">
                Archive
              </button>
            </form>
          </>
        ) : (
          <div className="support-text task-archived-note">
            Archived tasks stay readable when archived visibility is enabled.
          </div>
        )}
      </div>
    </div>
  );
}
