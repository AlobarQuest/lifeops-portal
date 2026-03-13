"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/current-user";
import {
  createTaskRecord,
  getTaskById,
  setTaskArchived,
  setTaskCompletion,
  updateTaskRecord,
} from "@/lib/tasks";
import {
  createTaskInputSchema,
  updateTaskInputSchema,
} from "@/lib/task-validators";

export type TaskActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

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
    priority: String(formData.get("priority") ?? ""),
    status: String(formData.get("status") ?? "INBOX"),
    dueOn: String(formData.get("dueOn") ?? ""),
    projectId: String(formData.get("projectId") ?? ""),
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
    dueOn: String(formData.get("dueOn") ?? ""),
    projectId: String(formData.get("projectId") ?? ""),
    sectionId: String(formData.get("sectionId") ?? ""),
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

  await setTaskCompletion(taskId, currentUser.id, mode !== "reopen");
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
