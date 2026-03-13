import { NextResponse } from "next/server";
import {
  TaskAuditAction,
  TaskStatus,
} from "@prisma/client";
import type { NextRequest } from "next/server";

import {
  getApiAccessContext,
  getApiUser,
} from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { createTaskAuditEvent } from "@/lib/task-audit";
import {
  createOrUpsertTaskRecordWithDb,
  getTaskById,
  getTaskBySource,
  getTaskCounts,
  listTasks,
  setTaskCompletion,
  serializeTask,
  updateTaskRecord,
} from "@/lib/tasks";
import {
  createTaskInputSchema,
  taskListFilterSchema,
  taskSourceReferenceSchema,
  updateTaskInputSchema,
} from "@/lib/task-validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 },
  );
}

type TaskRequestBody = Record<string, unknown>;

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

function readSearchParam(request: NextRequest, keys: string[]) {
  for (const key of keys) {
    const value = request.nextUrl.searchParams.get(key);

    if (value !== null) {
      return value;
    }
  }

  return undefined;
}

function normalizeTaskSourceReference(body: TaskRequestBody | null) {
  return {
    sourceType: readBodyValue(body, ["sourceType", "source_type", "externalSource", "external_source"]),
    sourceKey: readBodyValue(body, ["sourceKey", "source_key", "externalKey", "external_key"]),
  };
}

export async function GET(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const taskId = readSearchParam(request, ["id"]);

  if (taskId) {
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

  const parsed = taskListFilterSchema.safeParse({
    view: readSearchParam(request, ["view"]),
    status: readSearchParam(request, ["status"]),
    projectId: readSearchParam(request, ["projectId", "project_id"]),
    sectionId: readSearchParam(request, ["sectionId", "section_id"]),
    sourceType: readSearchParam(request, ["sourceType", "source_type", "externalSource", "external_source"]),
    sourceKey: readSearchParam(request, ["sourceKey", "source_key", "externalKey", "external_key"]),
    includeArchived: readSearchParam(request, ["includeArchived", "include_archived"]),
    limit: readSearchParam(request, ["limit"]),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid task query.",
      },
      { status: 400 },
    );
  }

  const [tasks, counts] = await Promise.all([
    listTasks({ ...parsed.data, ownerId: currentUser.id }),
    getTaskCounts(currentUser.id),
  ]);

  return NextResponse.json({
    tasks: tasks.map(serializeTask),
    counts,
  });
}

export async function POST(request: NextRequest) {
  const accessContext = await getApiAccessContext(request);
  const currentUser = accessContext.user;

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null) as TaskRequestBody | null;

  const parsed = createTaskInputSchema.safeParse({
    title: readBodyValue(body, ["title"]),
    description: readBodyValue(body, ["description"]),
    priority: readBodyValue(body, ["priority"]),
    status: readBodyValue(body, ["status"]) ?? TaskStatus.INBOX,
    dueOn: readBodyValue(body, ["dueOn", "due_on"]),
    projectId: readBodyValue(body, ["projectId", "project_id"]),
    sectionId: readBodyValue(body, ["sectionId", "section_id"]),
    ...normalizeTaskSourceReference(body),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid task payload.",
      },
      { status: 400 },
    );
  }

  let result;

  try {
    result = await prisma.$transaction(async (tx) => {
      const writeResult = await createOrUpsertTaskRecordWithDb({
        ownerId: currentUser.id,
        ...parsed.data,
      }, tx);
      const task = await getTaskById(writeResult.task.id, currentUser.id, {
        includeArchived: true,
        db: tx,
      });
      const resolvedTask = task ?? writeResult.task;

      await createTaskAuditEvent({
        action: writeResult.created ? TaskAuditAction.CREATE : TaskAuditAction.UPSERT_UPDATE,
        accessContext,
        db: tx,
        ownerId: currentUser.id,
        request,
        requestBody: body,
        task: resolvedTask,
      });

      return {
        created: writeResult.created,
        task: resolvedTask,
      };
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Task could not be saved.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      created: result.created,
      task: serializeTask(result.task),
    },
    { status: result.created ? 201 : 200 },
  );
}

export async function PATCH(request: NextRequest) {
  const accessContext = await getApiAccessContext(request);
  const currentUser = accessContext.user;

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null) as TaskRequestBody | null;
  const taskId = String(readBodyValue(body, ["id"]) ?? "").trim();
  const sourceReference = taskSourceReferenceSchema.safeParse(normalizeTaskSourceReference(body));

  if (!sourceReference.success) {
    return NextResponse.json(
      { error: sourceReference.error.issues[0]?.message ?? "Invalid task source reference." },
      { status: 400 },
    );
  }

  const targetTask =
    taskId.length > 0
      ? await getTaskById(taskId, currentUser.id)
      : sourceReference.data.sourceType && sourceReference.data.sourceKey
        ? await getTaskBySource({
            ownerId: currentUser.id,
            sourceType: sourceReference.data.sourceType,
            sourceKey: sourceReference.data.sourceKey,
            includeArchived: true,
          })
        : null;

  if (!targetTask) {
    if (!taskId && !sourceReference.data.sourceType && !sourceReference.data.sourceKey) {
      return NextResponse.json(
        { error: "Task id or sourceType/sourceKey is required." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Task not found." },
      { status: 404 },
    );
  }

  const mode = String(readBodyValue(body, ["mode"]) ?? "").trim();

  if (mode === "complete" || mode === "reopen") {
    let task;

    try {
      task = await prisma.$transaction(async (tx) => {
        await setTaskCompletion(targetTask.id, currentUser.id, mode === "complete", tx);
        const updatedTask = await getTaskById(targetTask.id, currentUser.id, {
          includeArchived: true,
          db: tx,
        });

        if (!updatedTask) {
          throw new Error("Task not found.");
        }

        await createTaskAuditEvent({
          action: mode === "complete" ? TaskAuditAction.COMPLETE : TaskAuditAction.REOPEN,
          accessContext,
          db: tx,
          ownerId: currentUser.id,
          request,
          requestBody: body,
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
      task: task ? serializeTask(task) : { id: targetTask.id },
    });
  }

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
      {
        error: parsed.error.issues[0]?.message ?? "Invalid task payload.",
      },
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
      await updateTaskRecord(targetTask.id, currentUser.id, parsed.data, tx);
      const updatedTask = await getTaskById(targetTask.id, currentUser.id, {
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
    task: task ? serializeTask(task) : { id: targetTask.id },
  });
}
