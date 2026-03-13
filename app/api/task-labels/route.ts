import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getApiUser } from "@/lib/current-user";
import {
  getTaskLabelById,
  listTaskLabelsForOwner,
} from "@/lib/task-labels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 },
  );
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

function parseLimit(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const labelId = readSearchParam(request, ["id", "labelId", "label_id"]);

  if (labelId) {
    const label = await getTaskLabelById(labelId, currentUser.id);

    if (!label) {
      return NextResponse.json(
        { error: "Label not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      label: {
        id: label.id,
        slug: label.slug,
        name: label.name,
        color: label.color,
        taskCount: label._count.taskLinks,
      },
    });
  }

  const limit = parseLimit(readSearchParam(request, ["limit"]));

  if (limit === null) {
    return NextResponse.json(
      { error: "Use a limit between 1 and 100." },
      { status: 400 },
    );
  }

  const query = readSearchParam(request, ["q", "query", "search"]);
  const labels = await listTaskLabelsForOwner({
    ownerId: currentUser.id,
    limit: limit ?? 50,
    query,
  });

  return NextResponse.json({
    labels: labels.map((label) => ({
      id: label.id,
      slug: label.slug,
      name: label.name,
      color: label.color,
      taskCount: label._count.taskLinks,
    })),
  });
}
