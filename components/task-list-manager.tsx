"use client";

import { useActionState, useState } from "react";

import {
  addTaskCommentAction,
  archiveTaskAction,
  createTaskAction,
  moveTaskAction,
  toggleTaskCompletionAction,
  updateTaskAction,
  type TaskActionState,
} from "@/app/actions/tasks";

type TaskComment = {
  id: string;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    email: string;
  };
};

type TaskListManagerTask = {
  id: string;
  sortOrder?: number | null;
  parentTaskId?: string | null;
  title: string;
  description?: string | null;
  status: string;
  statusLabel: string;
  priority: string;
  priorityLabel: string;
  scheduledFor?: string;
  scheduledLabel: string;
  dueLabel: string;
  dueOn?: string;
  deadlineOn?: string;
  deadlineLabel: string;
  durationMinutes?: number | null;
  durationLabel: string;
  recurrenceRule?: string | null;
  recurrenceLabel: string;
  updatedAt: string;
  blockedReason?: string | null;
  archivedAt?: string | null;
  commentCount: number;
  comments: TaskComment[];
  labels: Array<{
    id: string;
    name: string;
    slug: string;
    color?: string | null;
  }>;
  parentTask?: {
    id: string;
    title: string;
    status: string;
    statusLabel: string;
  } | null;
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
};

type TaskListManagerProps = {
  tasks: TaskListManagerTask[];
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

const recurrenceOptions = [
  { value: "", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKDAYS", label: "Weekdays" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

export function TaskListManager({
  tasks,
  projectOptions,
  sectionOptions,
}: TaskListManagerProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const taskIds = new Set(tasks.map((task) => task.id));
  const subtasksByParentId = new Map<string, TaskListManagerTask[]>();
  const rootTasks: TaskListManagerTask[] = [];

  for (const task of tasks) {
    if (task.parentTaskId && taskIds.has(task.parentTaskId)) {
      const subtasks = subtasksByParentId.get(task.parentTaskId) ?? [];
      subtasks.push(task);
      subtasksByParentId.set(task.parentTaskId, subtasks);
      continue;
    }

    rootTasks.push(task);
  }

  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId) ?? null
    : null;

  return (
    <>
      <div className="list">
        {rootTasks.map((task) => (
          <TaskListBranch
            depth={0}
            key={`${task.id}-${task.updatedAt}`}
            onOpenTask={setSelectedTaskId}
            projectOptions={projectOptions}
            sectionOptions={sectionOptions}
            selectedTaskId={selectedTaskId}
            subtasksByParentId={subtasksByParentId}
            task={task}
          />
        ))}
      </div>

      {selectedTask ? (
        <TaskDetailDrawer
          key={`${selectedTask.id}-${selectedTask.updatedAt}-${selectedTask.commentCount}`}
          onClose={() => {
            setSelectedTaskId(null);
          }}
          projectOptions={projectOptions}
          sectionOptions={sectionOptions}
          task={selectedTask}
        />
      ) : null}
    </>
  );
}

function TaskListBranch({
  task,
  depth,
  onOpenTask,
  projectOptions,
  sectionOptions,
  selectedTaskId,
  subtasksByParentId,
}: {
  task: TaskListManagerTask;
  depth: number;
  onOpenTask: (taskId: string) => void;
  projectOptions: TaskListManagerProps["projectOptions"];
  sectionOptions: TaskListManagerProps["sectionOptions"];
  selectedTaskId: string | null;
  subtasksByParentId: Map<string, TaskListManagerTask[]>;
}) {
  const subtasks = subtasksByParentId.get(task.id) ?? [];

  return (
    <div className={`task-branch ${depth > 0 ? "task-branch-nested" : ""}`}>
      <TaskListRow
        depth={depth}
        isSelected={selectedTaskId === task.id}
        onOpenTask={onOpenTask}
        subtaskCount={subtasks.length}
        task={task}
      />
      {subtasks.length > 0 ? (
        <div className="task-subtasks">
          {subtasks.map((subtask) => (
            <TaskListBranch
              depth={depth + 1}
              key={`${subtask.id}-${subtask.updatedAt}`}
              onOpenTask={onOpenTask}
              projectOptions={projectOptions}
              sectionOptions={sectionOptions}
              selectedTaskId={selectedTaskId}
              subtasksByParentId={subtasksByParentId}
              task={subtask}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TaskListRow({
  task,
  depth,
  isSelected,
  onOpenTask,
  subtaskCount,
}: {
  task: TaskListManagerTask;
  depth: number;
  isSelected: boolean;
  onOpenTask: (taskId: string) => void;
  subtaskCount: number;
}) {
  const isArchived = Boolean(task.archivedAt);
  const isSubtask = Boolean(task.parentTaskId);

  return (
    <div
      className={`list-item task-row ${isArchived ? "task-row-archived" : ""} ${isSubtask ? "task-row-subtask" : ""} ${isSelected ? "task-row-selected" : ""}`}
      style={depth > 0 ? { marginLeft: `${Math.min(depth, 5) * 1.1}rem` } : undefined}
    >
      <div className="task-row-main">
        <strong>{task.title}</strong>
        <p>{task.project?.name ?? "Inbox / unassigned project"}</p>
        {task.description ? <p>{task.description}</p> : null}
        {task.parentTask && depth === 0 ? <p>Subtask of: {task.parentTask.title}</p> : null}
        {task.blockedReason ? <p>Blocked by: {task.blockedReason}</p> : null}
        <div className="meta-row">
          <span className="pill">{task.statusLabel}</span>
          <span className="pill">{task.priorityLabel}</span>
          {task.scheduledFor ? <span className="pill">Scheduled {task.scheduledLabel}</span> : null}
          {task.dueOn ? <span className="pill">Due {task.dueLabel}</span> : null}
          {task.deadlineOn ? <span className="pill">Deadline {task.deadlineLabel}</span> : null}
          {task.durationMinutes ? <span className="pill">{task.durationLabel}</span> : null}
          {task.recurrenceRule ? <span className="pill">{task.recurrenceLabel}</span> : null}
          {task.section ? <span className="pill">{task.section.name}</span> : null}
          {task.role ? <span className="pill">{task.role.name}</span> : null}
          {isSubtask ? <span className="pill">Subtask</span> : null}
          {subtaskCount > 0 ? <span className="pill">{subtaskCount} subtasks</span> : null}
          {task.commentCount > 0 ? <span className="pill">{task.commentCount} comments</span> : null}
          {isArchived ? <span className="pill">Archived</span> : null}
          {task.labels.map((label) => (
            <span className="pill" key={label.id}>
              #{label.name}
            </span>
          ))}
        </div>
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
                onOpenTask(task.id);
              }}
              type="button"
            >
              Details
            </button>

            <form action={archiveTaskAction}>
              <input name="taskId" type="hidden" value={task.id} />
              <button className="secondary-inline-button" type="submit">
                Archive
              </button>
            </form>
          </>
        ) : (
          <>
            <button
              className="secondary-inline-button"
              onClick={() => {
                onOpenTask(task.id);
              }}
              type="button"
            >
              Details
            </button>
            <div className="support-text task-archived-note">
              Archived tasks stay readable when archived visibility is enabled.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TaskDetailDrawer({
  task,
  onClose,
  projectOptions,
  sectionOptions,
}: {
  task: TaskListManagerTask;
  onClose: () => void;
  projectOptions: TaskListManagerProps["projectOptions"];
  sectionOptions: TaskListManagerProps["sectionOptions"];
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(task.project?.id ?? "");
  const [selectedSectionId, setSelectedSectionId] = useState(task.section?.id ?? "");
  const [updateState, updateFormAction, isUpdatePending] = useActionState(updateTaskAction, initialState);
  const [commentState, commentFormAction, isCommentPending] = useActionState(addTaskCommentAction, initialState);
  const [subtaskState, subtaskFormAction, isSubtaskPending] = useActionState(createTaskAction, initialState);
  const availableSections = sectionOptions.filter((section) => section.projectId === selectedProjectId);
  const isSubtask = Boolean(task.parentTaskId);
  const isArchived = Boolean(task.archivedAt);

  return (
    <div className="task-drawer-shell">
      <button
        aria-label="Close task details"
        className="task-drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <aside aria-label="Task details" className="task-drawer-panel">
        <div className="task-drawer-header">
          <div>
            <p className="task-drawer-eyebrow">Task detail</p>
            <h3>{task.title}</h3>
            <p className="support-text">
              Keep edit context, comments, and ordering in one place without losing the list.
            </p>
          </div>
          <button className="secondary-inline-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="task-drawer-meta">
          <span className="pill">{task.statusLabel}</span>
          <span className="pill">{task.priorityLabel}</span>
          <span className="pill">Order {task.sortOrder ?? 0}</span>
          {task.recurrenceRule ? <span className="pill">{task.recurrenceLabel}</span> : null}
          {task.commentCount > 0 ? <span className="pill">{task.commentCount} comments</span> : null}
        </div>

        <section className="task-drawer-section">
          <div className="task-drawer-section-heading">
            <div>
              <strong>Ordering</strong>
              <p className="support-text">Manual ordering applies within the current sibling list.</p>
            </div>
          </div>

          <div className="task-inline-actions">
            <form action={moveTaskAction}>
              <input name="taskId" type="hidden" value={task.id} />
              <input name="direction" type="hidden" value="up" />
              <button className="secondary-inline-button" disabled={isArchived} type="submit">
                Move up
              </button>
            </form>
            <form action={moveTaskAction}>
              <input name="taskId" type="hidden" value={task.id} />
              <input name="direction" type="hidden" value="down" />
              <button className="secondary-inline-button" disabled={isArchived} type="submit">
                Move down
              </button>
            </form>
          </div>
        </section>

        <section className="task-drawer-section">
          <div className="task-drawer-section-heading">
            <div>
              <strong>Edit task</strong>
              <p className="support-text">This replaces the old row-inline editor.</p>
            </div>
          </div>

          <form action={updateFormAction} className="task-form task-drawer-form">
            <input name="taskId" type="hidden" value={task.id} />

            {updateState.status === "error" ? <div className="error-banner">{updateState.message}</div> : null}
            {updateState.status === "success" ? <div className="success-banner">{updateState.message}</div> : null}

            <div className="field">
              <label htmlFor={`drawer-task-title-${task.id}`}>Title</label>
              <input defaultValue={task.title} id={`drawer-task-title-${task.id}`} name="title" required type="text" />
            </div>

            <div className="field">
              <label htmlFor={`drawer-task-description-${task.id}`}>Notes</label>
              <textarea
                defaultValue={task.description ?? ""}
                id={`drawer-task-description-${task.id}`}
                name="description"
                rows={5}
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor={`drawer-task-priority-${task.id}`}>Priority</label>
                <select defaultValue={task.priority} id={`drawer-task-priority-${task.id}`} name="priority">
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`drawer-task-status-${task.id}`}>Status</label>
                <select defaultValue={task.status} id={`drawer-task-status-${task.id}`} name="status">
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`drawer-task-scheduled-${task.id}`}>Scheduled for</label>
                <input
                  defaultValue={task.scheduledFor ?? ""}
                  id={`drawer-task-scheduled-${task.id}`}
                  name="scheduledFor"
                  type="date"
                />
              </div>

              <div className="field">
                <label htmlFor={`drawer-task-due-${task.id}`}>Due date</label>
                <input
                  defaultValue={task.dueOn ?? ""}
                  id={`drawer-task-due-${task.id}`}
                  name="dueOn"
                  type="date"
                />
              </div>

              <div className="field">
                <label htmlFor={`drawer-task-deadline-${task.id}`}>Deadline</label>
                <input
                  defaultValue={task.deadlineOn ?? ""}
                  id={`drawer-task-deadline-${task.id}`}
                  name="deadlineOn"
                  type="date"
                />
              </div>

              <div className="field">
                <label htmlFor={`drawer-task-duration-${task.id}`}>Estimate (minutes)</label>
                <input
                  defaultValue={task.durationMinutes ?? ""}
                  id={`drawer-task-duration-${task.id}`}
                  min={0}
                  name="durationMinutes"
                  placeholder="45"
                  type="number"
                />
              </div>

              <div className="field">
                <label htmlFor={`drawer-task-project-${task.id}`}>Project</label>
                <select
                  disabled={isSubtask}
                  id={`drawer-task-project-${task.id}`}
                  name="projectId"
                  onChange={(event) => {
                    const nextProjectId = event.target.value;
                    setSelectedProjectId(nextProjectId);

                    if (!sectionOptions.some((section) => section.id === selectedSectionId && section.projectId === nextProjectId)) {
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
                <label htmlFor={`drawer-task-section-${task.id}`}>Section</label>
                <select
                  disabled={!selectedProjectId || isSubtask}
                  id={`drawer-task-section-${task.id}`}
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
                <label htmlFor={`drawer-task-blocked-${task.id}`}>Blocked reason</label>
                <input
                  defaultValue={task.blockedReason ?? ""}
                  id={`drawer-task-blocked-${task.id}`}
                  name="blockedReason"
                  placeholder="Why this task is blocked right now"
                  type="text"
                />
              </div>

              <div className="field">
                <label htmlFor={`drawer-task-labels-${task.id}`}>Labels</label>
                <input
                  defaultValue={task.labels.map((label) => label.name).join(", ")}
                  id={`drawer-task-labels-${task.id}`}
                  name="labels"
                  placeholder="ops, portal, follow-up"
                  type="text"
                />
              </div>

              <div className="field">
                <label htmlFor={`drawer-task-recurrence-${task.id}`}>Repeats</label>
                <select
                  defaultValue={task.recurrenceRule ?? ""}
                  disabled={isSubtask}
                  id={`drawer-task-recurrence-${task.id}`}
                  name="recurrenceRule"
                >
                  {recurrenceOptions.map((option) => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isSubtask && task.parentTask ? (
              <p className="support-text">
                This subtask inherits project and section from {task.parentTask.title}. Recurrence is only supported on top-level tasks for now.
              </p>
            ) : null}

            <div className="task-edit-actions">
              <button className="primary-button" disabled={isUpdatePending} type="submit">
                {isUpdatePending ? "Saving..." : "Save task"}
              </button>
            </div>
          </form>
        </section>

        <section className="task-drawer-section">
          <div className="task-drawer-section-heading">
            <div>
              <strong>Comments</strong>
              <p className="support-text">Use comments for operator notes that should stay attached to the task timeline.</p>
            </div>
          </div>

          <div className="task-comment-list">
            {task.comments.length === 0 ? (
              <div className="list-item">
                <strong>No comments yet</strong>
                <p>Use this thread for execution notes instead of burying new context in the description field.</p>
              </div>
            ) : (
              task.comments.map((comment) => (
                <article className="task-comment-item" key={comment.id}>
                  <div className="task-comment-meta">
                    <strong>{comment.author.displayName}</strong>
                    <span>{new Date(comment.createdAt).toLocaleString("en-US")}</span>
                  </div>
                  <p>{comment.bodyMarkdown}</p>
                </article>
              ))
            )}
          </div>

          <form action={commentFormAction} className="task-form task-comment-form">
            <input name="taskId" type="hidden" value={task.id} />

            {commentState.status === "error" ? <div className="error-banner">{commentState.message}</div> : null}
            {commentState.status === "success" ? <div className="success-banner">{commentState.message}</div> : null}

            <div className="field">
              <label htmlFor={`task-comment-${task.id}`}>Add comment</label>
              <textarea
                id={`task-comment-${task.id}`}
                name="bodyMarkdown"
                placeholder="Capture a status note, decision, or handoff detail."
                rows={4}
              />
            </div>

            <div className="task-edit-actions">
              <button className="primary-button" disabled={isCommentPending} type="submit">
                {isCommentPending ? "Saving..." : "Add comment"}
              </button>
            </div>
          </form>
        </section>

        {!isArchived ? (
          <section className="task-drawer-section">
            <div className="task-drawer-section-heading">
              <div>
                <strong>Subtasks</strong>
                <p className="support-text">Break this work into dependent steps without leaving the current context.</p>
              </div>
            </div>

            <form action={subtaskFormAction} className="task-form">
              <input name="parentTaskId" type="hidden" value={task.id} />
              <input name="priority" type="hidden" value="MEDIUM" />
              <input name="status" type="hidden" value="TODO" />

              {subtaskState.status === "error" ? <div className="error-banner">{subtaskState.message}</div> : null}
              {subtaskState.status === "success" ? <div className="success-banner">{subtaskState.message}</div> : null}

              <div className="form-grid single-column-grid">
                <div className="field">
                  <label htmlFor={`drawer-subtask-title-${task.id}`}>Subtask title</label>
                  <input
                    id={`drawer-subtask-title-${task.id}`}
                    name="title"
                    placeholder="Capture the next dependent step"
                    required
                    type="text"
                  />
                </div>

                <div className="field">
                  <label htmlFor={`drawer-subtask-labels-${task.id}`}>Labels</label>
                  <input
                    id={`drawer-subtask-labels-${task.id}`}
                    name="labels"
                    placeholder="api, follow-up"
                    type="text"
                  />
                </div>
              </div>

              <div className="task-edit-actions">
                <button className="primary-button" disabled={isSubtaskPending} type="submit">
                  {isSubtaskPending ? "Adding..." : "Create subtask"}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
