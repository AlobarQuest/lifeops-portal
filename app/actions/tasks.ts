"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/current-user";
import {
  createTaskCommentRecord,
  createTaskRecord,
  getTaskById,
  moveTaskRecord,
  setTaskArchived,
  setTaskCompletion,
  updateTaskRecord,
} from "@/lib/tasks";
import {
  createTaskCommentInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
} from "@/lib/task-validators";

export type TaskActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

function readOptionalFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  return value;
}

async function revalidateTaskSurfaces({
  ownerId,
  taskId,
  previousProjectSlug,
}: {
  ownerId: string;
  taskId: string;
  previousProjectSlug?: string | null;
}) {
  const task = await getTaskById(taskId, ownerId, { includeArchived: true });

  revalidatePath("/");
  revalidatePath("/tasks");

  if (previousProjectSlug) {
    revalidatePath(`/projects/${previousProjectSlug}`);
  }

  if (task?.project?.slug && task.project.slug !== previousProjectSlug) {
    revalidatePath(`/projects/${task.project.slug}`);
  }

  return task;
}

export async function createTaskAction(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/tasks");
  }

  const parsed = createTaskInputSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    priority: readOptionalFormValue(formData, "priority"),
    status: readOptionalFormValue(formData, "status"),
    scheduledFor: readOptionalFormValue(formData, "scheduledFor"),
    dueOn: readOptionalFormValue(formData, "dueOn"),
    deadlineOn: readOptionalFormValue(formData, "deadlineOn"),
    durationMinutes: readOptionalFormValue(formData, "durationMinutes"),
    recurrenceRule: readOptionalFormValue(formData, "recurrenceRule"),
    sortOrder: readOptionalFormValue(formData, "sortOrder"),
    projectId: readOptionalFormValue(formData, "projectId"),
    sectionId: readOptionalFormValue(formData, "sectionId"),
    parentTaskId: readOptionalFormValue(formData, "parentTaskId"),
    labels: readOptionalFormValue(formData, "labels"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the task fields and try again.",
    };
  }

  try {
    const task = await createTaskRecord({
      ownerId: currentUser.id,
      ...parsed.data,
    });

    revalidatePath("/");
    revalidatePath("/tasks");

    if (task.project?.slug) {
      revalidatePath(`/projects/${task.project.slug}`);
    }
  } catch {
    return {
      status: "error",
      message: "Task references could not be validated.",
    };
  }

  return {
    status: "success",
    message: "Task captured.",
  };
}

export async function updateTaskAction(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/tasks");
  }

  const taskId = String(formData.get("taskId") ?? "").trim();

  if (!taskId) {
    return {
      status: "error",
      message: "Task id is required.",
    };
  }

  const existingTask = await getTaskById(taskId, currentUser.id, { includeArchived: true });

  if (!existingTask) {
    return {
      status: "error",
      message: "Task not found.",
    };
  }

  const parsed = updateTaskInputSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    status: String(formData.get("status") ?? ""),
    scheduledFor: String(formData.get("scheduledFor") ?? ""),
    dueOn: String(formData.get("dueOn") ?? ""),
    deadlineOn: String(formData.get("deadlineOn") ?? ""),
    durationMinutes: readOptionalFormValue(formData, "durationMinutes") ?? "",
    recurrenceRule: readOptionalFormValue(formData, "recurrenceRule") ?? "",
    sortOrder: readOptionalFormValue(formData, "sortOrder") ?? "",
    projectId: String(formData.get("projectId") ?? ""),
    sectionId: String(formData.get("sectionId") ?? ""),
    parentTaskId: String(formData.get("parentTaskId") ?? ""),
    labels: readOptionalFormValue(formData, "labels"),
    blockedReason: String(formData.get("blockedReason") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the task fields and try again.",
    };
  }

  try {
    await updateTaskRecord(taskId, currentUser.id, parsed.data);
    await revalidateTaskSurfaces({
      ownerId: currentUser.id,
      taskId,
      previousProjectSlug: existingTask.project?.slug,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Task could not be updated.",
    };
  }

  return {
    status: "success",
    message: "Task updated.",
  };
}

export async function toggleTaskCompletionAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/tasks");
  }

  const taskId = String(formData.get("taskId") ?? "");
  const mode = String(formData.get("mode") ?? "complete");

  if (!taskId) {
    return;
  }

  const existingTask = await getTaskById(taskId, currentUser.id, { includeArchived: true });

  if (!existingTask) {
    return;
  }

  try {
    await setTaskCompletion(taskId, currentUser.id, mode !== "reopen");
  } catch {
    return;
  }

  await revalidateTaskSurfaces({
    ownerId: currentUser.id,
    taskId,
    previousProjectSlug: existingTask.project?.slug,
  });
}

export async function archiveTaskAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/tasks");
  }

  const taskId = String(formData.get("taskId") ?? "").trim();

  if (!taskId) {
    return;
  }

  const existingTask = await getTaskById(taskId, currentUser.id, { includeArchived: true });

  if (!existingTask) {
    return;
  }

  await setTaskArchived(taskId, currentUser.id, true);
  await revalidateTaskSurfaces({
    ownerId: currentUser.id,
    taskId,
    previousProjectSlug: existingTask.project?.slug,
  });
}

export async function addTaskCommentAction(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/tasks");
  }

  const taskId = String(formData.get("taskId") ?? "").trim();

  if (!taskId) {
    return {
      status: "error",
      message: "Task id is required.",
    };
  }

  const existingTask = await getTaskById(taskId, currentUser.id, { includeArchived: true });

  if (!existingTask) {
    return {
      status: "error",
      message: "Task not found.",
    };
  }

  const parsed = createTaskCommentInputSchema.safeParse({
    bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the comment and try again.",
    };
  }

  try {
    await createTaskCommentRecord({
      taskId,
      ownerId: currentUser.id,
      authorId: currentUser.id,
      bodyMarkdown: parsed.data.bodyMarkdown,
    });
    await revalidateTaskSurfaces({
      ownerId: currentUser.id,
      taskId,
      previousProjectSlug: existingTask.project?.slug,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Comment could not be saved.",
    };
  }

  return {
    status: "success",
    message: "Comment added.",
  };
}

export async function moveTaskAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/tasks");
  }

  const taskId = String(formData.get("taskId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();

  if (!taskId || (direction !== "up" && direction !== "down")) {
    return;
  }

  const existingTask = await getTaskById(taskId, currentUser.id, { includeArchived: true });

  if (!existingTask) {
    return;
  }

  await moveTaskRecord(taskId, currentUser.id, direction);
  await revalidateTaskSurfaces({
    ownerId: currentUser.id,
    taskId,
    previousProjectSlug: existingTask.project?.slug,
  });
}
