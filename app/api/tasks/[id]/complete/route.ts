import { NextResponse } from "next/server";
import { TaskAuditAction } from "@prisma/client";
import type { NextRequest } from "next/server";

import { getApiAccessContext } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { createTaskAuditEvent } from "@/lib/task-audit";
import {
  getTaskById,
  serializeTask,
  setTaskCompletion,
} from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

async function resolveTaskId(params: TaskRouteContext["params"]) {
  const { id } = await params;
  return id.trim();
}

export async function POST(request: NextRequest, context: TaskRouteContext) {
  const accessContext = await getApiAccessContext(request);
  const currentUser = accessContext.user;

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const taskId = await resolveTaskId(context.params);

  let result: {
    task: Awaited<ReturnType<typeof getTaskById>>;
    nextTask: Awaited<ReturnType<typeof getTaskById>> | null;
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      const completionResult = await setTaskCompletion(taskId, currentUser.id, true, tx);
      const updatedTask = await getTaskById(taskId, currentUser.id, {
        includeArchived: true,
        db: tx,
      });

      if (!updatedTask) {
        throw new Error("Task not found.");
      }

      await createTaskAuditEvent({
        action: TaskAuditAction.COMPLETE,
        accessContext,
        db: tx,
        ownerId: currentUser.id,
        request,
        requestBody:
          completionResult.nextTask?.sourceType && completionResult.nextTask?.sourceKey
            ? {
                sourceType: completionResult.nextTask.sourceType,
                sourceKey: completionResult.nextTask.sourceKey,
              }
            : undefined,
        task: updatedTask,
      });

      const nextTask = completionResult.nextTask
        ? await getTaskById(completionResult.nextTask.id, currentUser.id, {
            includeArchived: true,
            db: tx,
          })
        : null;

      return {
        task: updatedTask,
        nextTask,
      };
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task not found." },
      { status: error instanceof Error && error.message !== "Task not found." ? 400 : 404 },
    );
  }

  return NextResponse.json({
    task: result.task ? serializeTask(result.task) : { id: taskId },
    nextTask: result.nextTask ? serializeTask(result.nextTask) : null,
  });
}
