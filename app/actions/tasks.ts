"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/current-user";
import { createTaskRecord, setTaskCompletion } from "@/lib/tasks";
import { createTaskInputSchema } from "@/lib/task-validators";

export type TaskActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

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

  await createTaskRecord({
    ownerId: currentUser.id,
    ...parsed.data,
  });

  revalidatePath("/");
  revalidatePath("/tasks");

  return {
    status: "success",
    message: "Task captured.",
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

  await setTaskCompletion(taskId, mode !== "reopen");

  revalidatePath("/");
  revalidatePath("/tasks");
}
