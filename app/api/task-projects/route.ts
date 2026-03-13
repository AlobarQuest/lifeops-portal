import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getApiUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProjectRequestBody = Record<string, unknown>;

function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 },
  );
}

function readBodyValue(body: ProjectRequestBody | null, keys: string[]) {
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

function parseDateInput(value?: string) {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00`);
}

export async function GET(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { taskProjectFilterSchema } = await import("@/lib/project-validators");
  const parsed = taskProjectFilterSchema.safeParse({
    id: readSearchParam(request, ["id"]),
    slug: readSearchParam(request, ["slug"]),
    q: readSearchParam(request, ["q", "query", "search"]),
    status: readSearchParam(request, ["status"]),
    includeArchived: readSearchParam(request, ["includeArchived", "include_archived"]),
    limit: readSearchParam(request, ["limit"]),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid project query." },
      { status: 400 },
    );
  }

  if (parsed.data.id) {
    const { getTaskProjectById, serializeTaskProject } = await import("@/lib/task-projects");
    const project = await getTaskProjectById(parsed.data.id, currentUser.id);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      project: serializeTaskProject(project),
    });
  }

  if (parsed.data.slug) {
    const { getTaskProjectBySlug, serializeTaskProject } = await import("@/lib/task-projects");
    const project = await getTaskProjectBySlug(parsed.data.slug, currentUser.id);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      project: serializeTaskProject(project),
    });
  }

  const { listTaskProjectsForApi, serializeTaskProject } = await import("@/lib/task-projects");
  const projects = await listTaskProjectsForApi({
    ownerId: currentUser.id,
    query: parsed.data.q,
    status: parsed.data.status,
    includeArchived: parsed.data.includeArchived,
    limit: parsed.data.limit ?? 50,
  });

  return NextResponse.json({
    projects: projects.map(serializeTaskProject),
  });
}

export async function POST(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null) as ProjectRequestBody | null;
  const { createTaskProjectInputSchema } = await import("@/lib/project-validators");
  const parsed = createTaskProjectInputSchema.safeParse({
    name: readBodyValue(body, ["name"]),
    summary: readBodyValue(body, ["summary"]),
    description: readBodyValue(body, ["description"]),
    status: readBodyValue(body, ["status"]),
    priority: readBodyValue(body, ["priority"]),
    primaryRoleId: readBodyValue(body, ["primaryRoleId", "primary_role_id"]),
    targetStartOn: readBodyValue(body, ["targetStartOn", "target_start_on"]),
    targetEndOn: readBodyValue(body, ["targetEndOn", "target_end_on"]),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid project payload." },
      { status: 400 },
    );
  }

  try {
    const { createTaskProjectRecord, serializeTaskProject } = await import("@/lib/task-projects");
    const project = await createTaskProjectRecord({
      ownerId: currentUser.id,
      name: parsed.data.name,
      summary: parsed.data.summary,
      description: parsed.data.description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      primaryRoleId: parsed.data.primaryRoleId,
      targetStartAt: parseDateInput(parsed.data.targetStartOn),
      targetEndAt: parseDateInput(parsed.data.targetEndOn),
    });
    return NextResponse.json(
      {
        project: project ? serializeTaskProject(project) : null,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Project could not be saved." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const currentUser = await getApiUser(request);

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null) as ProjectRequestBody | null;
  const projectId = String(readBodyValue(body, ["id"]) ?? "").trim();

  if (!projectId) {
    return NextResponse.json(
      { error: "Project id is required." },
      { status: 400 },
    );
  }

  const { getTaskProjectById } = await import("@/lib/task-projects");
  const existingProject = await getTaskProjectById(projectId, currentUser.id);

  if (!existingProject) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 },
    );
  }

  const { updateTaskProjectInputSchema } = await import("@/lib/project-validators");
  const parsed = updateTaskProjectInputSchema.safeParse({
    name: readBodyValue(body, ["name"]),
    summary: readBodyValue(body, ["summary"]),
    description: readBodyValue(body, ["description"]),
    status: readBodyValue(body, ["status"]),
    priority: readBodyValue(body, ["priority"]),
    primaryRoleId: readBodyValue(body, ["primaryRoleId", "primary_role_id"]),
    targetStartOn: readBodyValue(body, ["targetStartOn", "target_start_on"]),
    targetEndOn: readBodyValue(body, ["targetEndOn", "target_end_on"]),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid project payload." },
      { status: 400 },
    );
  }

  if (Object.values(parsed.data).every((value) => value === undefined)) {
    return NextResponse.json(
      { error: "Provide at least one project field to update." },
      { status: 400 },
    );
  }

  try {
    const { serializeTaskProject, updateTaskProjectRecord } = await import("@/lib/task-projects");
    const project = await updateTaskProjectRecord({
      projectId: existingProject.id,
      ownerId: currentUser.id,
      name: parsed.data.name ?? existingProject.name,
      summary: parsed.data.summary ?? existingProject.summary,
      description: parsed.data.description ?? existingProject.description ?? undefined,
      status: parsed.data.status ?? existingProject.status,
      priority: parsed.data.priority ?? existingProject.priority,
      primaryRoleId: parsed.data.primaryRoleId ?? existingProject.primaryRole?.id,
      targetStartAt:
        parsed.data.targetStartOn !== undefined
          ? parseDateInput(parsed.data.targetStartOn)
          : existingProject.targetStartAt ?? undefined,
      targetEndAt:
        parsed.data.targetEndOn !== undefined
          ? parseDateInput(parsed.data.targetEndOn)
          : existingProject.targetEndAt ?? undefined,
    });

    return NextResponse.json({
      project: project ? serializeTaskProject(project) : { id: existingProject.id },
    });
  } catch {
    return NextResponse.json(
      { error: "Project could not be saved." },
      { status: 400 },
    );
  }
}
