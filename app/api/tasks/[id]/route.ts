import { NextResponse } from "next/server";
import { TaskAuditAction } from "@prisma/client";
import type { NextRequest } from "next/server";

import {
  getApiAccessContext,
  getApiUser,
} from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { createTaskAuditEvent } from "@/lib/task-audit";
import {
  getTaskById,
  serializeTask,
  updateTaskRecord,
} from "@/lib/tasks";
import { updateTaskInputSchema } from "@/lib/task-validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TaskRequestBody = Record<string, unknown>;
type TaskRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 },
  );
}

function readBodyValue(body: TaskRequestBody | null, keys: string[]) {
  if (!body) {
    return undefined;
  }

  for (const key of keys) {
    if (body[key] !== undefined) {
      return body[key];
    }
  }

  return undefined;
}

async function resolveTaskId(params: TaskRouteContext["params"]) {
  const { id } = await params;
  return id.trim();
}

export async function GET(request: NextRequest, context: TaskRouteContext) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const taskId = await resolveTaskId(context.params);
  const task = await getTaskById(taskId, currentUser.id, { includeArchived: true });

  if (!task) {
    return NextResponse.json(
      { error: "Task not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    task: serializeTask(task),
  });
}

export async function PATCH(request: NextRequest, context: TaskRouteContext) {
  const accessContext = await getApiAccessContext(request);
  const currentUser = accessContext.user;

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const taskId = await resolveTaskId(context.params);
  const body = await request.json().catch(() => null) as TaskRequestBody | null;
  const parsed = updateTaskInputSchema.safeParse({
    title: readBodyValue(body, ["title"]),
    description: readBodyValue(body, ["description"]),
    priority: readBodyValue(body, ["priority"]),
    status: readBodyValue(body, ["status"]),
    dueOn: readBodyValue(body, ["dueOn", "due_on"]),
    projectId: readBodyValue(body, ["projectId", "project_id"]),
    sectionId: readBodyValue(body, ["sectionId", "section_id"]),
    blockedReason: readBodyValue(body, ["blockedReason", "blocked_reason"]),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid task payload." },
      { status: 400 },
    );
  }

  if (Object.values(parsed.data).every((value) => value === undefined)) {
    return NextResponse.json(
      { error: "Provide at least one task field to update." },
      { status: 400 },
    );
  }

  let task;

  try {
    task = await prisma.$transaction(async (tx) => {
      await updateTaskRecord(taskId, currentUser.id, parsed.data, tx);
      const updatedTask = await getTaskById(taskId, currentUser.id, {
        includeArchived: true,
        db: tx,
      });

      if (!updatedTask) {
        throw new Error("Task not found.");
      }

      await createTaskAuditEvent({
        action: TaskAuditAction.UPDATE,
        accessContext,
        db: tx,
        ownerId: currentUser.id,
        request,
        requestBody: body,
        task: updatedTask,
      });

      return updatedTask;
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task not found." },
      { status: error instanceof Error && error.message !== "Task not found." ? 400 : 404 },
    );
  }

  return NextResponse.json({
    task: task ? serializeTask(task) : { id: taskId },
  });
}
