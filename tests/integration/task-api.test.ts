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
  taskLabels: typeof import("../../app/api/task-labels/route");
  taskComments: typeof import("../../app/api/tasks/[id]/comments/route");
  taskProjects: typeof import("../../app/api/task-projects/route");
  taskSections: typeof import("../../app/api/task-sections/route");
  tasks: typeof import("../../app/api/tasks/route");
  taskById: typeof import("../../app/api/tasks/[id]/route");
  taskComplete: typeof import("../../app/api/tasks/[id]/complete/route");
  taskReopen: typeof import("../../app/api/tasks/[id]/reopen/route");
  taskArchive: typeof import("../../app/api/tasks/[id]/archive/route");
};

const routeModulesPromise: Promise<RouteModules> = Promise.all([
  import("../../app/api/task-labels/route"),
  import("../../app/api/tasks/[id]/comments/route"),
  import("../../app/api/task-projects/route"),
  import("../../app/api/task-sections/route"),
  import("../../app/api/tasks/route"),
  import("../../app/api/tasks/[id]/route"),
  import("../../app/api/tasks/[id]/complete/route"),
  import("../../app/api/tasks/[id]/reopen/route"),
  import("../../app/api/tasks/[id]/archive/route"),
]).then(
  ([
    taskLabels,
    taskComments,
    taskProjects,
    taskSections,
    tasks,
    taskById,
    taskComplete,
    taskReopen,
    taskArchive,
  ]) => ({
    taskLabels,
    taskComments,
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

  await prisma.tag.deleteMany({
    where: {
      slug: {
        startsWith: runId,
      },
      taskLinks: {
        none: {},
      },
    },
  });
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
  const labelPlatform = `${runId}-platform`;
  const labelApi = `${runId}-api`;
  const labelOps = `${runId}-ops`;
  const labelChild = `${runId}-child-step`;
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
      scheduledFor: "2026-03-16",
      dueOn: "2026-03-17",
      deadlineOn: "2026-03-18",
      durationMinutes: 90,
      projectId,
      sectionId,
      labels: [labelPlatform, labelApi],
      sourceType: "integration-test",
      sourceKey,
    }),
  );

  assert.equal(createTaskResponse.status, 201);
  const createTaskBody = await parseJson<{
    created: boolean;
    task: {
      id: string;
      title: string;
      scheduledFor: string | null;
      deadlineAt: string | null;
      durationMinutes: number | null;
      labels: Array<{ name: string }>;
    };
  }>(createTaskResponse);
  assert.equal(createTaskBody.created, true);
  const taskId = createTaskBody.task.id;
  assert.match(getString(createTaskBody.task.scheduledFor), /^2026-03-16T/);
  assert.match(getString(createTaskBody.task.deadlineAt), /^2026-03-18T/);
  assert.equal(createTaskBody.task.durationMinutes, 90);
  assert.deepEqual(
    createTaskBody.task.labels.map((label) => label.name).sort(),
    [labelApi, labelPlatform].sort(),
  );

  const createSubtaskResponse = await routes.tasks.POST(
    makeJsonRequest("/api/tasks", "POST", {
      title: "Integration route flow subtask",
      labels: `${labelChild}, ${labelApi}`,
      parentTaskId: taskId,
    }),
  );

  assert.equal(createSubtaskResponse.status, 201);
  const createSubtaskBody = await parseJson<{
    task: {
      id: string;
      sortOrder: number | null;
      parentTaskId: string | null;
      project: { id: string } | null;
      section: { id: string } | null;
      parentTask: { id: string; title: string } | null;
      labels: Array<{ name: string }>;
    };
  }>(createSubtaskResponse);
  const subtaskId = createSubtaskBody.task.id;
  assert.equal(createSubtaskBody.task.parentTaskId, taskId);
  assert.equal(createSubtaskBody.task.project?.id, projectId);
  assert.equal(createSubtaskBody.task.section?.id, sectionId);
  assert.equal(createSubtaskBody.task.parentTask?.id, taskId);
  assert.equal(createSubtaskBody.task.parentTask?.title, "Integration route flow task");
  assert.deepEqual(
    createSubtaskBody.task.labels.map((label) => label.name).sort(),
    [labelApi, labelChild].sort(),
  );
  assert.equal(createSubtaskBody.task.sortOrder, 0);

  const createSecondSubtaskResponse = await routes.tasks.POST(
    makeJsonRequest("/api/tasks", "POST", {
      title: "Integration route flow second subtask",
      parentTaskId: taskId,
    }),
  );
  assert.equal(createSecondSubtaskResponse.status, 201);
  const createSecondSubtaskBody = await parseJson<{
    task: {
      id: string;
      sortOrder: number | null;
      parentTaskId: string | null;
    };
  }>(createSecondSubtaskResponse);
  const secondSubtaskId = createSecondSubtaskBody.task.id;
  assert.equal(createSecondSubtaskBody.task.parentTaskId, taskId);
  assert.equal(createSecondSubtaskBody.task.sortOrder, 1);

  const replayTaskResponse = await routes.tasks.POST(
    makeJsonRequest("/api/tasks", "POST", {
      title: "Integration route flow task updated",
      description: "Upserted by the integration route flow test.",
      priority: "CRITICAL",
      projectId,
      sectionId,
      labels: [labelPlatform, labelApi, labelOps],
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

  const labelFilterResponse = await routes.tasks.GET(
    makeAuthedGet(`/api/tasks?projectId=${projectId}&label=${encodeURIComponent(labelOps)}`),
  );
  assert.equal(labelFilterResponse.status, 200);
  const labelFilterBody = await parseJson<{ tasks: Array<{ id: string }> }>(labelFilterResponse);
  assert.equal(labelFilterBody.tasks.length, 1);
  assert.equal(labelFilterBody.tasks[0]?.id, taskId);

  const childTaskFilterResponse = await routes.tasks.GET(
    makeAuthedGet(`/api/tasks?parentTaskId=${taskId}`),
  );
  assert.equal(childTaskFilterResponse.status, 200);
  const childTaskFilterBody = await parseJson<{
    tasks: Array<{ id: string; parentTaskId: string | null; sortOrder: number | null }>;
  }>(childTaskFilterResponse);
  assert.equal(childTaskFilterBody.tasks.length, 2);
  assert.equal(childTaskFilterBody.tasks[0]?.id, subtaskId);
  assert.equal(childTaskFilterBody.tasks[0]?.parentTaskId, taskId);
  assert.equal(childTaskFilterBody.tasks[1]?.id, secondSubtaskId);

  const reorderSecondSubtaskResponse = await routes.taskById.PATCH(
    makeJsonRequest(`/api/tasks/${secondSubtaskId}`, "PATCH", {
      sortOrder: 0,
    }),
    taskContext(secondSubtaskId),
  );
  assert.equal(reorderSecondSubtaskResponse.status, 200);

  const reorderFirstSubtaskResponse = await routes.taskById.PATCH(
    makeJsonRequest(`/api/tasks/${subtaskId}`, "PATCH", {
      sortOrder: 1,
    }),
    taskContext(subtaskId),
  );
  assert.equal(reorderFirstSubtaskResponse.status, 200);

  const reorderedChildTaskResponse = await routes.tasks.GET(
    makeAuthedGet(`/api/tasks?parentTaskId=${taskId}`),
  );
  assert.equal(reorderedChildTaskResponse.status, 200);
  const reorderedChildTaskBody = await parseJson<{
    tasks: Array<{ id: string; sortOrder: number | null }>;
  }>(reorderedChildTaskResponse);
  assert.deepEqual(
    reorderedChildTaskBody.tasks.map((childTask) => childTask.id),
    [secondSubtaskId, subtaskId],
  );
  assert.deepEqual(
    reorderedChildTaskBody.tasks.map((childTask) => childTask.sortOrder),
    [0, 1],
  );

  const labelListResponse = await routes.taskLabels.GET(
    makeAuthedGet(`/api/task-labels?q=${encodeURIComponent(labelApi)}`),
  );
  assert.equal(labelListResponse.status, 200);
  const labelListBody = await parseJson<{ labels: Array<{ name: string }> }>(labelListResponse);
  assert.ok(labelListBody.labels.some((label) => label.name === labelApi));

  const createCommentResponse = await routes.taskComments.POST(
    makeJsonRequest(`/api/tasks/${taskId}/comments`, "POST", {
      bodyMarkdown: "Integration comment added through the comment route.",
    }),
    taskContext(taskId),
  );
  assert.equal(createCommentResponse.status, 201);
  const createCommentBody = await parseJson<{
    comment: { id: string; bodyMarkdown: string; author: { email: string } };
  }>(createCommentResponse);
  assert.equal(createCommentBody.comment.bodyMarkdown, "Integration comment added through the comment route.");
  assert.equal(createCommentBody.comment.author.email, process.env.AUTH_EMAIL);

  const listCommentsResponse = await routes.taskComments.GET(
    makeAuthedGet(`/api/tasks/${taskId}/comments`),
    taskContext(taskId),
  );
  assert.equal(listCommentsResponse.status, 200);
  const listCommentsBody = await parseJson<{
    comments: Array<{ id: string; bodyMarkdown: string }>;
  }>(listCommentsResponse);
  assert.equal(listCommentsBody.comments.length, 1);
  assert.equal(listCommentsBody.comments[0]?.id, createCommentBody.comment.id);

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
  const getTaskByIdBody = await parseJson<{
    task: {
      id: string;
      title: string;
      commentCount: number;
      comments: Array<{ id: string }>;
    };
  }>(getTaskByIdResponse);
  assert.equal(getTaskByIdBody.task.id, taskId);
  assert.equal(getTaskByIdBody.task.commentCount, 1);
  assert.equal(getTaskByIdBody.task.comments.length, 1);

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
  assert.equal(includeArchivedProjectTasksBody.tasks.length, 3);
  assert.ok(includeArchivedProjectTasksBody.tasks.some((task) => task.id === taskId));
  assert.ok(includeArchivedProjectTasksBody.tasks.some((task) => task.id === subtaskId));
  assert.ok(includeArchivedProjectTasksBody.tasks.some((task) => task.id === secondSubtaskId));

  const prisma = await getPrisma();
  const auditEvents = await prisma.taskAuditEvent.findMany({
    where: {
      taskId,
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
    auditEvents.map((event) => event.action).sort(),
    ["ARCHIVE", "COMPLETE", "CREATE", "REOPEN", "UPDATE", "UPSERT_UPDATE"],
  );
  assert.deepEqual(
    auditEvents.map((event) => event.requestMethod).sort(),
    ["PATCH", "POST", "POST", "POST", "POST", "POST"],
  );
  assert.deepEqual(
    auditEvents.map((event) => event.requestPath).sort(),
    [
      "/api/tasks",
      "/api/tasks",
      `/api/tasks/${taskId}`,
      `/api/tasks/${taskId}/complete`,
      `/api/tasks/${taskId}/reopen`,
      `/api/tasks/${taskId}/archive`,
    ].sort(),
  );
  assert.ok(auditEvents.every((event) => event.authType === "INTERNAL_TOKEN"));
  assert.ok(auditEvents.every((event) => event.actorEmail === process.env.AUTH_EMAIL));
  assert.ok(auditEvents.every((event) => event.sourceType === "integration-test"));
  assert.ok(auditEvents.every((event) => event.sourceKey === sourceKey));

  const createEvent = auditEvents.find((event) => event.action === "CREATE");
  const archiveEvent = auditEvents.find((event) => event.action === "ARCHIVE");
  const createPayload = createEvent?.requestPayloadJson as { title?: string } | null;
  assert.equal(createPayload?.title, "Integration route flow task");

  const archivedSnapshot = archiveEvent?.taskSnapshotJson as { archivedAt?: string | null } | null;
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

test("recurring task completion creates the next occurrence", async (t) => {
  const routes = await routeModulesPromise;
  const runId = `it-recur-${Date.now()}`;
  const projectIds: string[] = [];

  await cleanupIntegrationArtifacts({ runId, projectIds });
  t.after(async () => {
    await cleanupIntegrationArtifacts({ runId, projectIds });
  });

  const sourceKey = `${runId}-task`;
  const createTaskResponse = await routes.tasks.POST(
    makeJsonRequest("/api/tasks", "POST", {
      title: "Recurring integration task",
      description: "Created for recurrence coverage.",
      priority: "MEDIUM",
      scheduledFor: "2026-03-13",
      dueOn: "2026-03-15",
      deadlineOn: "2026-03-16",
      durationMinutes: 45,
      recurrenceRule: "WEEKLY",
      sourceType: "integration-test",
      sourceKey,
    }),
  );

  assert.equal(createTaskResponse.status, 201);
  const createTaskBody = await parseJson<{ task: { id: string } }>(createTaskResponse);
  const taskId = createTaskBody.task.id;

  const completeTaskResponse = await routes.taskComplete.POST(
    makeRequest(`/api/tasks/${taskId}/complete`, {
      method: "POST",
      headers: authHeaders(),
    }),
    taskContext(taskId),
  );
  assert.equal(completeTaskResponse.status, 200);
  const completeTaskBody = await parseJson<{
    task: { id: string; status: string; sourceType: string | null; sourceKey: string | null };
    nextTask: {
      id: string;
      status: string;
      scheduledFor: string | null;
      dueAt: string | null;
      deadlineAt: string | null;
      durationMinutes: number | null;
      recurrenceRule: string | null;
      sourceType: string | null;
      sourceKey: string | null;
    } | null;
  }>(completeTaskResponse);

  assert.equal(completeTaskBody.task.id, taskId);
  assert.equal(completeTaskBody.task.status, "DONE");
  assert.equal(completeTaskBody.task.sourceType, null);
  assert.equal(completeTaskBody.task.sourceKey, null);
  assert.ok(completeTaskBody.nextTask);
  assert.equal(completeTaskBody.nextTask?.status, "TODO");
  assert.equal(completeTaskBody.nextTask?.recurrenceRule, "WEEKLY");
  assert.equal(completeTaskBody.nextTask?.durationMinutes, 45);
  assert.equal(completeTaskBody.nextTask?.sourceType, "integration-test");
  assert.equal(completeTaskBody.nextTask?.sourceKey, sourceKey);
  assert.match(getString(completeTaskBody.nextTask?.scheduledFor), /^2026-03-20T/);
  assert.match(getString(completeTaskBody.nextTask?.dueAt), /^2026-03-22T/);
  assert.match(getString(completeTaskBody.nextTask?.deadlineAt), /^2026-03-23T/);

  const sourceLookupResponse = await routes.tasks.GET(
    makeAuthedGet(`/api/tasks?sourceType=integration-test&sourceKey=${sourceKey}`),
  );
  assert.equal(sourceLookupResponse.status, 200);
  const sourceLookupBody = await parseJson<{ tasks: Array<{ id: string }> }>(sourceLookupResponse);
  assert.equal(sourceLookupBody.tasks.length, 1);
  assert.equal(sourceLookupBody.tasks[0]?.id, completeTaskBody.nextTask?.id);

  const reopenTaskResponse = await routes.taskReopen.POST(
    makeRequest(`/api/tasks/${taskId}/reopen`, {
      method: "POST",
      headers: authHeaders(),
    }),
    taskContext(taskId),
  );
  assert.equal(reopenTaskResponse.status, 400);
  const reopenTaskBody = await parseJson<{ error: string }>(reopenTaskResponse);
  assert.match(reopenTaskBody.error, /Cannot reopen a recurring task/);

  const prisma = await getPrisma();
  const auditEvents = await prisma.taskAuditEvent.findMany({
    where: {
      OR: [
        {
          taskId,
        },
        {
          taskId: completeTaskBody.nextTask?.id ?? "",
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      action: true,
      sourceType: true,
      sourceKey: true,
    },
  });

  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["CREATE", "COMPLETE"],
  );
  assert.ok(auditEvents.every((event) => event.sourceType === "integration-test"));
  assert.ok(auditEvents.every((event) => event.sourceKey === sourceKey));
});
