import { NextResponse } from "next/server";
import { TaskAuditAction } from "@prisma/client";
import type { NextRequest } from "next/server";

import { getApiAccessContext } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { createTaskAuditEvent } from "@/lib/task-audit";
import {
  getTaskById,
  serializeTask,
  setTaskArchived,
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

  let task;

  try {
    task = await prisma.$transaction(async (tx) => {
      await setTaskArchived(taskId, currentUser.id, true, tx);
      const updatedTask = await getTaskById(taskId, currentUser.id, {
        includeArchived: true,
        db: tx,
      });

      if (!updatedTask) {
        throw new Error("Task not found.");
      }

      await createTaskAuditEvent({
        action: TaskAuditAction.ARCHIVE,
        accessContext,
        db: tx,
        ownerId: currentUser.id,
        request,
        task: updatedTask,
      });

      return updatedTask;
    });
  } catch {
    return NextResponse.json(
      { error: "Task not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    task: task ? serializeTask(task) : { id: taskId },
  });
}
