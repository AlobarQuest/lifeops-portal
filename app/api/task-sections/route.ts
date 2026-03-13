import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getApiUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SectionRequestBody = Record<string, unknown>;

function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 },
  );
}

function readBodyValue(body: SectionRequestBody | null, keys: string[]) {
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

export async function GET(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { taskSectionFilterSchema } = await import("@/lib/task-section-validators");
  const parsed = taskSectionFilterSchema.safeParse({
    id: readSearchParam(request, ["id"]),
    projectId: readSearchParam(request, ["projectId", "project_id"]),
    includeArchived: readSearchParam(request, ["includeArchived", "include_archived"]),
    limit: readSearchParam(request, ["limit"]),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid section query." },
      { status: 400 },
    );
  }

  if (parsed.data.id) {
    const { getTaskSectionById, serializeTaskSection } = await import("@/lib/task-sections");
    const section = await getTaskSectionById(parsed.data.id, currentUser.id);

    if (!section) {
      return NextResponse.json(
        { error: "Section not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      section: serializeTaskSection(section),
    });
  }

  const { listTaskSectionsForApi, serializeTaskSection } = await import("@/lib/task-sections");
  const sections = await listTaskSectionsForApi({
    ownerId: currentUser.id,
    projectId: parsed.data.projectId,
    includeArchived: parsed.data.includeArchived,
    limit: parsed.data.limit ?? 100,
  });

  return NextResponse.json({
    sections: sections.map(serializeTaskSection),
  });
}

export async function POST(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null) as SectionRequestBody | null;
  const { createTaskSectionInputSchema } = await import("@/lib/task-section-validators");
  const parsed = createTaskSectionInputSchema.safeParse({
    projectId: readBodyValue(body, ["projectId", "project_id"]),
    name: readBodyValue(body, ["name"]),
    sortOrder: readBodyValue(body, ["sortOrder", "sort_order"]),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid section payload." },
      { status: 400 },
    );
  }

  try {
    const { createTaskSectionRecord, serializeTaskSection } = await import("@/lib/task-sections");
    const section = await createTaskSectionRecord({
      ownerId: currentUser.id,
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
    });

    return NextResponse.json(
      {
        section: section ? serializeTaskSection(section) : null,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Section could not be saved." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null) as SectionRequestBody | null;
  const sectionId = String(readBodyValue(body, ["id"]) ?? "").trim();

  if (!sectionId) {
    return NextResponse.json(
      { error: "Section id is required." },
      { status: 400 },
    );
  }

  const { updateTaskSectionInputSchema } = await import("@/lib/task-section-validators");
  const parsed = updateTaskSectionInputSchema.safeParse({
    name: readBodyValue(body, ["name"]),
    sortOrder: readBodyValue(body, ["sortOrder", "sort_order"]),
    archived: readBodyValue(body, ["archived", "isArchived", "is_archived"]),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid section payload." },
      { status: 400 },
    );
  }

  try {
    const { serializeTaskSection, updateTaskSectionRecord } = await import("@/lib/task-sections");
    const section = await updateTaskSectionRecord({
      sectionId,
      ownerId: currentUser.id,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
      archived: parsed.data.archived,
    });

    return NextResponse.json({
      section: section ? serializeTaskSection(section) : { id: sectionId },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Section could not be saved." },
      { status: error instanceof Error && error.message === "Section not found." ? 404 : 400 },
    );
  }
}
