import {
  PriorityLevel,
  Prisma,
  ProjectDocumentType,
  ProjectStatus,
  TaskStatus,
} from "@prisma/client";

import {
  buildProjectDocumentTemplate,
  projectDocumentDefinitions,
} from "@/lib/project-documents";
import { prisma } from "@/lib/db";
import {
  formatTaskDueLabel,
  getTaskPriorityLabel,
  getTaskStatusLabel,
} from "@/lib/tasks";

const projectListSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  status: true,
  priority: true,
  updatedAt: true,
  primaryRole: {
    select: {
      name: true,
      slug: true,
    },
  },
  _count: {
    select: {
      tasks: true,
      documents: true,
    },
  },
} satisfies Prisma.ProjectSelect;

const projectWorkspaceSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  description: true,
  status: true,
  priority: true,
  targetStartAt: true,
  targetEndAt: true,
  lastReviewedAt: true,
  updatedAt: true,
  primaryRole: {
    select: {
      id: true,
      slug: true,
      name: true,
    },
  },
  documents: {
    select: {
      id: true,
      type: true,
      bodyMarkdown: true,
      updatedAt: true,
    },
  },
  tasks: {
    where: {
      status: {
        in: [TaskStatus.INBOX, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE],
      },
    },
    orderBy: [
      {
        dueAt: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueAt: true,
      blockedReason: true,
    },
  },
} satisfies Prisma.ProjectSelect;

type ProjectSeedContext = {
  id: string;
  name: string;
  summary: string;
  description?: string | null;
};

export type ProjectListItem = Prisma.ProjectGetPayload<{
  select: typeof projectListSelect;
}>;

export type ProjectWorkspace = Prisma.ProjectGetPayload<{
  select: typeof projectWorkspaceSelect;
}>;

export type ProjectRoleOption = {
  id: string;
  slug: string;
  name: string;
};

export function formatProjectStatusLabel(status: ProjectStatus) {
  switch (status) {
    case ProjectStatus.ON_HOLD:
      return "On hold";
    default:
      return status
        .toLowerCase()
        .split("_")
        .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
        .join(" ");
  }
}

export function formatProjectPriorityLabel(priority: PriorityLevel) {
  return priority
    .toLowerCase()
    .split("_")
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

export async function listProjectRoles(): Promise<ProjectRoleOption[]> {
  return prisma.role.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export function slugifyProjectName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function createUniqueProjectSlug(name: string) {
  const baseSlug = slugifyProjectName(name) || "project";
  let candidate = baseSlug;
  let suffix = 2;

  // Keep slug generation deterministic and collision-safe for the small v1 workload.
  while (
    await prisma.project.findUnique({
      where: {
        slug: candidate,
      },
      select: {
        id: true,
      },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function ensureProjectDocumentSet(project: ProjectSeedContext) {
  await Promise.all(
    projectDocumentDefinitions.map((definition) =>
      prisma.projectDocument.upsert({
        where: {
          projectId_type: {
            projectId: project.id,
            type: definition.type,
          },
        },
        update: {},
        create: {
          projectId: project.id,
          type: definition.type,
          bodyMarkdown: buildProjectDocumentTemplate(project, definition.type),
        },
      }),
    ),
  );
}

function sortProjectDocuments<T extends { type: ProjectDocumentType }>(documents: T[]) {
  const order = new Map(projectDocumentDefinitions.map((definition, index) => [definition.type, index]));

  return [...documents].sort((left, right) => {
    return (order.get(left.type) ?? 0) - (order.get(right.type) ?? 0);
  });
}

function formatProjectTask(task: ProjectWorkspace["tasks"][number]) {
  return {
    ...task,
    statusLabel: getTaskStatusLabel(task.status),
    priorityLabel: getTaskPriorityLabel(task.priority),
    dueLabel: formatTaskDueLabel(task.dueAt),
  };
}

export async function listProjects(ownerId: string) {
  return prisma.project.findMany({
    where: {
      ownerId,
    },
    select: projectListSelect,
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export async function getProjectWorkspaceBySlug(slug: string, ownerId: string) {
  const project = await prisma.project.findFirst({
    where: {
      slug,
      ownerId,
    },
    select: {
      id: true,
      name: true,
      summary: true,
      description: true,
    },
  });

  if (!project) {
    return null;
  }

  await ensureProjectDocumentSet(project);

  const workspace = await prisma.project.findFirst({
    where: {
      id: project.id,
      ownerId,
    },
    select: projectWorkspaceSelect,
  });

  if (!workspace) {
    return null;
  }

  return {
    ...workspace,
    documents: sortProjectDocuments(workspace.documents),
    tasks: workspace.tasks.map(formatProjectTask),
  };
}

export async function updateProjectDocumentRecord({
  projectId,
  type,
  bodyMarkdown,
}: {
  projectId: string;
  type: ProjectDocumentType;
  bodyMarkdown: string;
}) {
  return prisma.projectDocument.update({
    where: {
      projectId_type: {
        projectId,
        type,
      },
    },
    data: {
      bodyMarkdown,
    },
  });
}

export async function createProjectRecord({
  ownerId,
  name,
  summary,
  description,
  status,
  priority,
  primaryRoleId,
  targetStartAt,
  targetEndAt,
}: {
  ownerId: string;
  name: string;
  summary: string;
  description?: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  primaryRoleId?: string;
  targetStartAt?: Date;
  targetEndAt?: Date;
}) {
  const slug = await createUniqueProjectSlug(name);

  const project = await prisma.project.create({
    data: {
      ownerId,
      slug,
      name,
      summary,
      description,
      status,
      priority,
      primaryRoleId,
      targetStartAt,
      targetEndAt,
      isActive: status !== ProjectStatus.ARCHIVED,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      description: true,
    },
  });

  await ensureProjectDocumentSet(project);

  return project;
}

export async function updateProjectRecord({
  projectId,
  ownerId,
  name,
  summary,
  description,
  status,
  priority,
  primaryRoleId,
  targetStartAt,
  targetEndAt,
}: {
  projectId: string;
  ownerId: string;
  name: string;
  summary: string;
  description?: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  primaryRoleId?: string;
  targetStartAt?: Date;
  targetEndAt?: Date;
}) {
  const existingProject = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!existingProject) {
    return null;
  }

  return prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      name,
      summary,
      description,
      status,
      priority,
      primaryRoleId,
      targetStartAt,
      targetEndAt,
      isActive: status !== ProjectStatus.ARCHIVED,
      lastReviewedAt: new Date(),
    },
    select: {
      slug: true,
    },
  });
}

export async function deleteProjectRecord({
  projectId,
  ownerId,
}: {
  projectId: string;
  ownerId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existingProject = await tx.project.findFirst({
      where: {
        id: projectId,
        ownerId,
      },
      select: {
        id: true,
      },
    });

    if (!existingProject) {
      return null;
    }

    await tx.task.updateMany({
      where: {
        projectId,
        ownerId,
      },
      data: {
        projectId: null,
      },
    });

    await tx.decision.updateMany({
      where: {
        projectId,
        ownerId,
      },
      data: {
        projectId: null,
      },
    });

    await tx.idea.updateMany({
      where: {
        convertedProjectId: projectId,
      },
      data: {
        convertedProjectId: null,
      },
    });

    await tx.project.delete({
      where: {
        id: projectId,
      },
    });

    return existingProject;
  });
}
