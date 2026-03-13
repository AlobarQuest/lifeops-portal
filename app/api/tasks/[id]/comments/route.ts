import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  getApiAccessContext,
  getApiUser,
} from "@/lib/current-user";
import {
  createTaskCommentRecord,
  listTaskComments,
  serializeTaskComment,
} from "@/lib/tasks";
import { createTaskCommentInputSchema } from "@/lib/task-validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TaskCommentRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type TaskCommentRequestBody = Record<string, unknown>;

function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 },
  );
}

function readBodyValue(body: TaskCommentRequestBody | null, keys: string[]) {
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

async function resolveTaskId(params: TaskCommentRouteContext["params"]) {
  const { id } = await params;
  return id.trim();
}

export async function GET(request: NextRequest, context: TaskCommentRouteContext) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const taskId = await resolveTaskId(context.params);

  try {
    const comments = await listTaskComments(taskId, currentUser.id);

    return NextResponse.json({
      comments: comments.map(serializeTaskComment),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task not found." },
      { status: error instanceof Error && error.message !== "Task not found." ? 400 : 404 },
    );
  }
}

export async function POST(request: NextRequest, context: TaskCommentRouteContext) {
  const accessContext = await getApiAccessContext(request);
  const currentUser = accessContext.user;

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const taskId = await resolveTaskId(context.params);
  const body = await request.json().catch(() => null) as TaskCommentRequestBody | null;
  const parsed = createTaskCommentInputSchema.safeParse({
    bodyMarkdown: readBodyValue(body, ["bodyMarkdown", "body_markdown", "body", "comment"]),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid task comment payload." },
      { status: 400 },
    );
  }

  try {
    const comment = await createTaskCommentRecord({
      taskId,
      ownerId: currentUser.id,
      authorId: currentUser.id,
      bodyMarkdown: parsed.data.bodyMarkdown,
    });

    return NextResponse.json(
      {
        comment: serializeTaskComment(comment),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task comment could not be saved." },
      { status: error instanceof Error && error.message !== "Task not found." ? 400 : 404 },
    );
  }
}
