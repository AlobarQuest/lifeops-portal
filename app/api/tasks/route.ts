import { NextResponse } from "next/server";
import { TaskStatus } from "@prisma/client";
import type { NextRequest } from "next/server";

import { getApiUser } from "@/lib/current-user";
import {
  createTaskRecord,
  getTaskById,
  getTaskCounts,
  listTasks,
  setTaskCompletion,
  serializeTask,
  updateTaskRecord,
} from "@/lib/tasks";
import {
  createTaskInputSchema,
  taskListFilterSchema,
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

export async function GET(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const parsed = taskListFilterSchema.safeParse({
    view: request.nextUrl.searchParams.get("view") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
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

  const taskId = request.nextUrl.searchParams.get("id");

  if (taskId) {
    const task = await getTaskById(taskId, currentUser.id);

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

  return NextResponse.json({
    tasks: tasks.map(serializeTask),
    counts,
  });
}

export async function POST(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null);

  const parsed = createTaskInputSchema.safeParse({
    title: body?.title,
    description: body?.description,
    priority: body?.priority,
    status: body?.status ?? TaskStatus.INBOX,
    dueOn: body?.dueOn,
    projectId: body?.projectId,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid task payload.",
      },
      { status: 400 },
    );
  }

  const task = await createTaskRecord({
    ownerId: currentUser.id,
    ...parsed.data,
  });
  const createdTask = await getTaskById(task.id, currentUser.id);

  return NextResponse.json(
    {
      task: createdTask ? serializeTask(createdTask) : { id: task.id },
    },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null);
  const taskId = String(body?.id ?? "").trim();

  if (!taskId) {
    return NextResponse.json(
      { error: "Task id is required." },
      { status: 400 },
    );
  }

  if (body?.mode === "complete" || body?.mode === "reopen") {
    try {
      await setTaskCompletion(taskId, body.mode === "complete");
    } catch {
      return NextResponse.json(
        { error: "Task not found." },
        { status: 404 },
      );
    }

    const task = await getTaskById(taskId, currentUser.id);

    return NextResponse.json({
      task: task ? serializeTask(task) : { id: taskId },
    });
  }

  const parsed = updateTaskInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid task payload.",
      },
      { status: 400 },
    );
  }

  try {
    await updateTaskRecord(taskId, parsed.data);
  } catch {
    return NextResponse.json(
      { error: "Task not found." },
      { status: 404 },
    );
  }

  const task = await getTaskById(taskId, currentUser.id);

  return NextResponse.json({
    task: task ? serializeTask(task) : { id: taskId },
  });
}
