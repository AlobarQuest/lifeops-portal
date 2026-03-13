import "dotenv/config";

type ApiErrorResponse = {
  error?: string;
};

type TaskProject = {
  id: string;
  slug: string;
  name: string;
};

type TaskSection = {
  id: string;
  name: string;
};

type TaskRecord = {
  id: string;
  title: string;
  priority: string;
  status: string;
  archivedAt: string | null;
  project: TaskProject | null;
  section: TaskSection | null;
};

const baseUrl = (process.env.LIFEOPS_API_BASE_URL ?? process.env.APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const token = process.env.LIFEOPS_API_TOKEN ?? process.env.INTERNAL_API_TOKEN ?? "";
const projectName = process.env.LIFEOPS_SMOKE_PROJECT_NAME ?? "External API Smoke Check";
const projectSummary = "Reserved workspace for bearer-token task API verification.";
const projectDescription = "Managed by scripts/task-api-smoke.ts for external caller verification.";
const sectionName = process.env.LIFEOPS_SMOKE_SECTION_NAME ?? "API Intake";
const sourceType = process.env.LIFEOPS_SMOKE_SOURCE_TYPE ?? "smoke-script";
const sourceKey = process.env.LIFEOPS_SMOKE_SOURCE_KEY ?? "external-api-smoke";

if (!token) {
  console.error("Missing LIFEOPS_API_TOKEN or INTERNAL_API_TOKEN.");
  process.exit(1);
}

function buildPath(path: string, searchParams?: URLSearchParams) {
  if (!searchParams || Array.from(searchParams.keys()).length === 0) {
    return path;
  }

  return `${path}?${searchParams.toString()}`;
}

async function apiRequest<T>(path: string, init?: { body?: unknown; method?: string }) {
  const method = init?.method ?? "GET";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const responseText = await response.text();
  const responseJson = responseText.length > 0
    ? JSON.parse(responseText) as T & ApiErrorResponse
    : {} as T & ApiErrorResponse;

  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${responseJson.error ?? responseText}`);
  }

  return responseJson as T;
}

async function getOrCreateProject() {
  const lookup = await apiRequest<{ projects: TaskProject[] }>(
    buildPath("/api/task-projects", new URLSearchParams({
      q: projectName,
      limit: "20",
    })),
  );
  const existingProject = lookup.projects.find((project) => project.name === projectName);

  if (existingProject) {
    console.log(`Using existing project ${existingProject.slug}`);
    return existingProject;
  }

  const created = await apiRequest<{ project: TaskProject }>("/api/task-projects", {
    method: "POST",
    body: {
      name: projectName,
      summary: projectSummary,
      description: projectDescription,
    },
  });

  console.log(`Created project ${created.project.slug}`);
  return created.project;
}

async function getOrCreateSection(projectId: string) {
  const lookup = await apiRequest<{ sections: Array<TaskSection & { project: { id: string } }> }>(
    buildPath("/api/task-sections", new URLSearchParams({
      projectId,
      limit: "100",
    })),
  );
  const existingSection = lookup.sections.find((section) => section.name === sectionName);

  if (existingSection) {
    console.log(`Using existing section ${existingSection.name}`);
    return existingSection;
  }

  const created = await apiRequest<{ section: TaskSection }>("/api/task-sections", {
    method: "POST",
    body: {
      projectId,
      name: sectionName,
      sortOrder: 0,
    },
  });

  console.log(`Created section ${created.section.name}`);
  return created.section;
}

async function getTaskBySource() {
  const taskLookup = await apiRequest<{ tasks: TaskRecord[] }>(
    buildPath("/api/tasks", new URLSearchParams({
      sourceType,
      sourceKey,
    })),
  );

  if (taskLookup.tasks.length !== 1) {
    throw new Error(`Expected one task for ${sourceType}/${sourceKey}, found ${taskLookup.tasks.length}.`);
  }

  return taskLookup.tasks[0];
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Source: ${sourceType}/${sourceKey}`);

  const project = await getOrCreateProject();
  const section = await getOrCreateSection(project.id);

  const firstUpsert = await apiRequest<{ created: boolean; task: TaskRecord }>("/api/tasks", {
    method: "POST",
    body: {
      title: "External API smoke task",
      description: "Initial task state created by scripts/task-api-smoke.ts.",
      priority: "MEDIUM",
      projectId: project.id,
      sectionId: section.id,
      sourceType,
      sourceKey,
    },
  });

  console.log(`${firstUpsert.created ? "Created" : "Reused"} task ${firstUpsert.task.id}`);

  const secondUpsert = await apiRequest<{ created: boolean; task: TaskRecord }>("/api/tasks", {
    method: "POST",
    body: {
      title: "External API smoke task verified",
      description: "Updated by scripts/task-api-smoke.ts during the idempotent replay step.",
      priority: "HIGH",
      projectId: project.id,
      sectionId: section.id,
      sourceType,
      sourceKey,
    },
  });

  if (secondUpsert.created) {
    throw new Error("Expected idempotent replay to return created=false.");
  }

  const verifiedTask = await getTaskBySource();

  if (verifiedTask.title !== "External API smoke task verified") {
    throw new Error(`Unexpected task title after replay: ${verifiedTask.title}`);
  }

  const completed = await apiRequest<{ task: TaskRecord }>(`/api/tasks/${verifiedTask.id}/complete`, {
    method: "POST",
  });

  if (completed.task.status !== "DONE") {
    throw new Error(`Expected DONE status after completion, received ${completed.task.status}.`);
  }

  const archived = await apiRequest<{ task: TaskRecord }>(`/api/tasks/${verifiedTask.id}/archive`, {
    method: "POST",
  });

  if (!archived.task.archivedAt) {
    throw new Error("Expected archivedAt to be set after archive.");
  }

  const archivedLookup = await getTaskBySource();

  if (!archivedLookup.archivedAt) {
    throw new Error("Expected archived source lookup to return the archived task.");
  }

  console.log("Task API smoke test passed.");
  console.log(JSON.stringify({
    project,
    section,
    task: {
      id: archivedLookup.id,
      title: archivedLookup.title,
      status: archivedLookup.status,
      archivedAt: archivedLookup.archivedAt,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
