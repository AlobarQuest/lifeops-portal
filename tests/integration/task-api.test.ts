import assert from "node:assert/strict";
import { after, test } from "node:test";

import { NextRequest } from "next/server";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/lifeops_portal";
process.env.AUTH_EMAIL ??= "devon.watkins@gmail.com";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.INTERNAL_API_TOKEN ??= "test-internal-token";
(process.env as Record<string, string | undefined>).NODE_ENV ??= "test";

type JsonRecord = Record<string, unknown>;
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

type RouteModules = {
  taskProjects: typeof import("../../app/api/task-projects/route");
  taskSections: typeof import("../../app/api/task-sections/route");
  tasks: typeof import("../../app/api/tasks/route");
  taskById: typeof import("../../app/api/tasks/[id]/route");
  taskComplete: typeof import("../../app/api/tasks/[id]/complete/route");
  taskReopen: typeof import("../../app/api/tasks/[id]/reopen/route");
  taskArchive: typeof import("../../app/api/tasks/[id]/archive/route");
};

const routeModulesPromise: Promise<RouteModules> = Promise.all([
  import("../../app/api/task-projects/route"),
  import("../../app/api/task-sections/route"),
  import("../../app/api/tasks/route"),
  import("../../app/api/tasks/[id]/route"),
  import("../../app/api/tasks/[id]/complete/route"),
  import("../../app/api/tasks/[id]/reopen/route"),
  import("../../app/api/tasks/[id]/archive/route"),
]).then(
  ([
    taskProjects,
    taskSections,
    tasks,
    taskById,
    taskComplete,
    taskReopen,
    taskArchive,
  ]) => ({
    taskProjects,
    taskSections,
    tasks,
    taskById,
    taskComplete,
    taskReopen,
    taskArchive,
  }),
);

async function getPrisma() {
  const { prisma } = await import("../../lib/db");
  return prisma;
}

after(async () => {
  const prisma = await getPrisma();
  await prisma.$disconnect();
});

function authHeaders(extraHeaders?: HeadersInit) {
  return new Headers({
    authorization: `Bearer ${process.env.INTERNAL_API_TOKEN}`,
    ...(extraHeaders ? Object.fromEntries(new Headers(extraHeaders).entries()) : {}),
  });
}

function makeRequest(path: string, init?: NextRequestInit) {
  return new NextRequest(`http://localhost${path}`, init);
}

function makeJsonRequest(path: string, method: string, body?: JsonRecord, authorized = true) {
  const headers = new Headers({
    "content-type": "application/json",
  });

  if (authorized) {
    headers.set("authorization", `Bearer ${process.env.INTERNAL_API_TOKEN}`);
  }

  return makeRequest(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeAuthedGet(path: string) {
  return makeRequest(path, {
    headers: authHeaders(),
  });
}

function taskContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

async function parseJson<T>(response: Response) {
  return response.json() as Promise<T>;
}

async function cleanupIntegrationArtifacts({
  runId,
  projectIds,
}: {
  runId: string;
  projectIds: string[];
}) {
  const prisma = await getPrisma();

  await prisma.taskAuditEvent.deleteMany({
    where: {
      owner: {
        email: process.env.AUTH_EMAIL,
      },
      sourceType: "integration-test",
      sourceKey: {
        startsWith: runId,
      },
    },
  });

  await prisma.task.deleteMany({
    where: {
      owner: {
        email: process.env.AUTH_EMAIL,
      },
      sourceType: "integration-test",
      sourceKey: {
        startsWith: runId,
      },
    },
  });

  if (projectIds.length > 0) {
    await prisma.task.deleteMany({
      where: {
        projectId: {
          in: projectIds,
        },
      },
    });

    await prisma.taskSection.deleteMany({
      where: {
        projectId: {
          in: projectIds,
        },
      },
    });

    await prisma.project.deleteMany({
      where: {
        id: {
          in: projectIds,
        },
      },
    });
  }
}

function getString(value: unknown): string {
  assert.equal(typeof value, "string");
  return value as string;
}

test("task routes reject unauthenticated requests", async () => {
  const { tasks } = await routeModulesPromise;

  const response = await tasks.GET(makeRequest("/api/tasks"));
  assert.equal(response.status, 401);
  assert.deepEqual(await parseJson<{ error: string }>(response), {
    error: "Unauthorized",
  });
});

test("task platform routes support project, section, task, and archive flows", async (t) => {
  const routes = await routeModulesPromise;
  const runId = `it-flow-${Date.now()}`;
  const projectIds: string[] = [];

  await cleanupIntegrationArtifacts({ runId, projectIds });
  t.after(async () => {
    await cleanupIntegrationArtifacts({ runId, projectIds });
  });

  const createProjectResponse = await routes.taskProjects.POST(
    makeJsonRequest("/api/task-projects", "POST", {
      name: `Integration Flow Project ${runId}`,
      summary: "Exercise the task platform integration flow end to end.",
      description: "Created by the integration test harness for route coverage.",
    }),
  );

  assert.equal(createProjectResponse.status, 201);
  const createProjectBody = await parseJson<{ project: { id: string; slug: string } }>(createProjectResponse);
  const projectId = createProjectBody.project.id;
  const projectSlug = createProjectBody.project.slug;
  projectIds.push(projectId);

  const fetchProjectResponse = await routes.taskProjects.GET(
    makeAuthedGet(`/api/task-projects?slug=${projectSlug}`),
  );
  assert.equal(fetchProjectResponse.status, 200);
  const fetchProjectBody = await parseJson<{ project: { id: string; slug: string } }>(fetchProjectResponse);
  assert.equal(fetchProjectBody.project.id, projectId);
  assert.equal(fetchProjectBody.project.slug, projectSlug);

  const createSectionResponse = await routes.taskSections.POST(
    makeJsonRequest("/api/task-sections", "POST", {
      projectId,
      name: "Integration Lane",
      sortOrder: 7,
    }),
  );

  assert.equal(createSectionResponse.status, 201);
  const createSectionBody = await parseJson<{ section: { id: string; name: string } }>(createSectionResponse);
  const sectionId = createSectionBody.section.id;
  assert.equal(createSectionBody.section.name, "Integration Lane");

  const listSectionsResponse = await routes.taskSections.GET(
    makeAuthedGet(`/api/task-sections?projectId=${projectId}`),
  );
  assert.equal(listSectionsResponse.status, 200);
  const listSectionsBody = await parseJson<{ sections: Array<{ id: string }> }>(listSectionsResponse);
  assert.ok(listSectionsBody.sections.some((section) => section.id === sectionId));

  const sourceKey = `${runId}-task`;
  const createTaskResponse = await routes.tasks.POST(
    makeJsonRequest("/api/tasks", "POST", {
      title: "Integration route flow task",
      description: "Created by the integration route flow test.",
      priority: "HIGH",
      projectId,
      sectionId,
      sourceType: "integration-test",
      sourceKey,
    }),
  );

  assert.equal(createTaskResponse.status, 201);
  const createTaskBody = await parseJson<{ created: boolean; task: { id: string; title: string } }>(createTaskResponse);
  assert.equal(createTaskBody.created, true);
  const taskId = createTaskBody.task.id;

  const replayTaskResponse = await routes.tasks.POST(
    makeJsonRequest("/api/tasks", "POST", {
      title: "Integration route flow task updated",
      description: "Upserted by the integration route flow test.",
      priority: "CRITICAL",
      projectId,
      sectionId,
      sourceType: "integration-test",
      sourceKey,
    }),
  );

  assert.equal(replayTaskResponse.status, 200);
  const replayTaskBody = await parseJson<{ created: boolean; task: { id: string; title: string; priority: string } }>(
    replayTaskResponse,
  );
  assert.equal(replayTaskBody.created, false);
  assert.equal(replayTaskBody.task.id, taskId);
  assert.equal(replayTaskBody.task.title, "Integration route flow task updated");
  assert.equal(replayTaskBody.task.priority, "CRITICAL");

  const filteredTasksResponse = await routes.tasks.GET(
    makeAuthedGet(
      `/api/tasks?projectId=${projectId}&sectionId=${sectionId}&sourceType=integration-test&sourceKey=${sourceKey}`,
    ),
  );
  assert.equal(filteredTasksResponse.status, 200);
  const filteredTasksBody = await parseJson<{ tasks: Array<{ id: string; title: string }> }>(filteredTasksResponse);
  assert.equal(filteredTasksBody.tasks.length, 1);
  assert.equal(filteredTasksBody.tasks[0]?.id, taskId);

  const getTaskByIdResponse = await routes.taskById.GET(
    makeAuthedGet(`/api/tasks/${taskId}`),
    taskContext(taskId),
  );
  assert.equal(getTaskByIdResponse.status, 200);
  const getTaskByIdBody = await parseJson<{ task: { id: string; title: string } }>(getTaskByIdResponse);
  assert.equal(getTaskByIdBody.task.id, taskId);

  const patchTaskByIdResponse = await routes.taskById.PATCH(
    makeJsonRequest(`/api/tasks/${taskId}`, "PATCH", {
      status: "BLOCKED",
      blockedReason: "Waiting on route integration assertions",
    }),
    taskContext(taskId),
  );
  assert.equal(patchTaskByIdResponse.status, 200);
  const patchTaskByIdBody = await parseJson<{ task: { status: string; blockedReason: string | null } }>(patchTaskByIdResponse);
  assert.equal(patchTaskByIdBody.task.status, "BLOCKED");
  assert.equal(patchTaskByIdBody.task.blockedReason, "Waiting on route integration assertions");

  const completeTaskResponse = await routes.taskComplete.POST(
    makeRequest(`/api/tasks/${taskId}/complete`, {
      method: "POST",
      headers: authHeaders(),
    }),
    taskContext(taskId),
  );
  assert.equal(completeTaskResponse.status, 200);
  const completeTaskBody = await parseJson<{ task: { status: string } }>(completeTaskResponse);
  assert.equal(completeTaskBody.task.status, "DONE");

  const reopenTaskResponse = await routes.taskReopen.POST(
    makeRequest(`/api/tasks/${taskId}/reopen`, {
      method: "POST",
      headers: authHeaders(),
    }),
    taskContext(taskId),
  );
  assert.equal(reopenTaskResponse.status, 200);
  const reopenTaskBody = await parseJson<{ task: { status: string } }>(reopenTaskResponse);
  assert.equal(reopenTaskBody.task.status, "TODO");

  const archiveTaskResponse = await routes.taskArchive.POST(
    makeRequest(`/api/tasks/${taskId}/archive`, {
      method: "POST",
      headers: authHeaders(),
    }),
    taskContext(taskId),
  );
  assert.equal(archiveTaskResponse.status, 200);
  const archiveTaskBody = await parseJson<{ task: { archivedAt: string | null } }>(archiveTaskResponse);
  assert.match(getString(archiveTaskBody.task.archivedAt), /^\d{4}-\d{2}-\d{2}T/);

  const projectTasksDefaultResponse = await routes.tasks.GET(
    makeAuthedGet(`/api/tasks?projectId=${projectId}`),
  );
  assert.equal(projectTasksDefaultResponse.status, 200);
  const projectTasksDefaultBody = await parseJson<{ tasks: Array<unknown> }>(projectTasksDefaultResponse);
  assert.equal(projectTasksDefaultBody.tasks.length, 0);

  const sourceLookupAfterArchiveResponse = await routes.tasks.GET(
    makeAuthedGet(`/api/tasks?sourceType=integration-test&sourceKey=${sourceKey}`),
  );
  assert.equal(sourceLookupAfterArchiveResponse.status, 200);
  const sourceLookupAfterArchiveBody = await parseJson<{ tasks: Array<{ id: string; archivedAt: string | null }> }>(
    sourceLookupAfterArchiveResponse,
  );
  assert.equal(sourceLookupAfterArchiveBody.tasks.length, 1);
  assert.equal(sourceLookupAfterArchiveBody.tasks[0]?.id, taskId);
  const archivedLookupValue = sourceLookupAfterArchiveBody.tasks[0]?.archivedAt;
  assert.match(getString(archivedLookupValue), /^\d{4}-\d{2}-\d{2}T/);

  const includeArchivedProjectTasksResponse = await routes.tasks.GET(
    makeAuthedGet(`/api/tasks?projectId=${projectId}&includeArchived=true`),
  );
  assert.equal(includeArchivedProjectTasksResponse.status, 200);
  const includeArchivedProjectTasksBody = await parseJson<{ tasks: Array<{ id: string }> }>(
    includeArchivedProjectTasksResponse,
  );
  assert.equal(includeArchivedProjectTasksBody.tasks.length, 1);
  assert.equal(includeArchivedProjectTasksBody.tasks[0]?.id, taskId);

  const prisma = await getPrisma();
  const auditEvents = await prisma.taskAuditEvent.findMany({
    where: {
      taskId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      action: true,
      authType: true,
      actorEmail: true,
      requestMethod: true,
      requestPath: true,
      sourceType: true,
      sourceKey: true,
      requestPayloadJson: true,
      taskSnapshotJson: true,
    },
  });

  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["CREATE", "UPSERT_UPDATE", "UPDATE", "COMPLETE", "REOPEN", "ARCHIVE"],
  );
  assert.deepEqual(
    auditEvents.map((event) => event.requestMethod),
    ["POST", "POST", "PATCH", "POST", "POST", "POST"],
  );
  assert.deepEqual(
    auditEvents.map((event) => event.requestPath),
    [
      "/api/tasks",
      "/api/tasks",
      `/api/tasks/${taskId}`,
      `/api/tasks/${taskId}/complete`,
      `/api/tasks/${taskId}/reopen`,
      `/api/tasks/${taskId}/archive`,
    ],
  );
  assert.ok(auditEvents.every((event) => event.authType === "INTERNAL_TOKEN"));
  assert.ok(auditEvents.every((event) => event.actorEmail === process.env.AUTH_EMAIL));
  assert.ok(auditEvents.every((event) => event.sourceType === "integration-test"));
  assert.ok(auditEvents.every((event) => event.sourceKey === sourceKey));

  const createPayload = auditEvents[0]?.requestPayloadJson as { title?: string } | null;
  assert.equal(createPayload?.title, "Integration route flow task");

  const archivedSnapshot = auditEvents.at(-1)?.taskSnapshotJson as { archivedAt?: string | null } | null;
  assert.match(getString(archivedSnapshot?.archivedAt), /^\d{4}-\d{2}-\d{2}T/);
});

test("source-aware task upsert revives archived tasks", async (t) => {
  const routes = await routeModulesPromise;
  const runId = `it-revive-${Date.now()}`;
  const projectIds: string[] = [];

  await cleanupIntegrationArtifacts({ runId, projectIds });
  t.after(async () => {
    await cleanupIntegrationArtifacts({ runId, projectIds });
  });

  const sourceKey = `${runId}-task`;
  const createTaskResponse = await routes.tasks.POST(
    makeJsonRequest("/api/tasks", "POST", {
      title: "Revival integration task",
      description: "Created for revive coverage.",
      priority: "MEDIUM",
      sourceType: "integration-test",
      sourceKey,
    }),
  );

  assert.equal(createTaskResponse.status, 201);
  const createTaskBody = await parseJson<{ task: { id: string } }>(createTaskResponse);
  const taskId = createTaskBody.task.id;

  const archiveTaskResponse = await routes.taskArchive.POST(
    makeRequest(`/api/tasks/${taskId}/archive`, {
      method: "POST",
      headers: authHeaders(),
    }),
    taskContext(taskId),
  );
  assert.equal(archiveTaskResponse.status, 200);

  const reviveTaskResponse = await routes.tasks.POST(
    makeJsonRequest("/api/tasks", "POST", {
      title: "Revived integration task",
      description: "Updated while reviving an archived task.",
      priority: "HIGH",
      sourceType: "integration-test",
      sourceKey,
    }),
  );

  assert.equal(reviveTaskResponse.status, 200);
  const reviveTaskBody = await parseJson<{
    created: boolean;
    task: { id: string; title: string; archivedAt: string | null; priority: string };
  }>(reviveTaskResponse);
  assert.equal(reviveTaskBody.created, false);
  assert.equal(reviveTaskBody.task.id, taskId);
  assert.equal(reviveTaskBody.task.title, "Revived integration task");
  assert.equal(reviveTaskBody.task.archivedAt, null);
  assert.equal(reviveTaskBody.task.priority, "HIGH");

  const revivedLookupResponse = await routes.tasks.GET(
    makeAuthedGet(`/api/tasks?sourceType=integration-test&sourceKey=${sourceKey}`),
  );
  assert.equal(revivedLookupResponse.status, 200);
  const revivedLookupBody = await parseJson<{ tasks: Array<{ id: string; archivedAt: string | null }> }>(
    revivedLookupResponse,
  );
  assert.equal(revivedLookupBody.tasks.length, 1);
  assert.equal(revivedLookupBody.tasks[0]?.id, taskId);
  const revivedArchivedValue = revivedLookupBody.tasks[0]?.archivedAt;
  assert.equal(revivedArchivedValue, null);

  const prisma = await getPrisma();
  const auditEvents = await prisma.taskAuditEvent.findMany({
    where: {
      taskId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      action: true,
      taskSnapshotJson: true,
    },
  });

  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["CREATE", "ARCHIVE", "UPSERT_UPDATE"],
  );

  const revivedSnapshot = auditEvents.at(-1)?.taskSnapshotJson as {
    archivedAt?: string | null;
    priority?: string;
    title?: string;
  } | null;
  assert.equal(revivedSnapshot?.archivedAt, null);
  assert.equal(revivedSnapshot?.priority, "HIGH");
  assert.equal(revivedSnapshot?.title, "Revived integration task");
});
