"use client";

import { useActionState } from "react";

import { createTaskAction, type TaskActionState } from "@/app/actions/tasks";

type TaskQuickAddFormProps = {
  projectOptions: Array<{
    id: string;
    name: string;
  }>;
};

export function TaskQuickAddForm({ projectOptions }: TaskQuickAddFormProps) {
  const initialState: TaskActionState = {
    status: "idle",
    message: "",
  };

  const [state, formAction, isPending] = useActionState(createTaskAction, initialState);

  return (
    <form action={formAction} className="task-form">
      {state.status === "error" ? <div className="error-banner">{state.message}</div> : null}
      {state.status === "success" ? <div className="success-banner">{state.message}</div> : null}

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" placeholder="Capture the next action" required type="text" />
      </div>

      <div className="field">
        <label htmlFor="description">Notes</label>
        <textarea
          id="description"
          name="description"
          placeholder="Why this task matters, what is blocked, or what done looks like."
          rows={3}
        />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="priority">Priority</label>
          <select defaultValue="MEDIUM" id="priority" name="priority">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="status">Starting lane</label>
          <select defaultValue="INBOX" id="status" name="status">
            <option value="INBOX">Inbox</option>
            <option value="TODO">Next</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="dueOn">Due date</label>
          <input id="dueOn" name="dueOn" type="date" />
        </div>

        <div className="field">
          <label htmlFor="projectId">Project</label>
          <select defaultValue="" id="projectId" name="projectId">
            <option value="">Inbox / no project</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="support-text">
        This is the first real task capture flow. Other applications should eventually use the same task domain through
        the `/api/tasks` routes instead of writing to separate task tools.
      </p>

      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Add task"}
      </button>
    </form>
  );
}
