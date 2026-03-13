import {
  PriorityLevel,
  ProjectStatus,
  type Prisma,
} from "@prisma/client";

import {
  buildProjectDocumentTemplate,
  projectDocumentDefinitions,
} from "@/lib/project-documents";
import { prisma } from "@/lib/db";

const taskProjectApiSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  description: true,
  status: true,
  priority: true,
  isActive: true,
  targetStartAt: true,
  targetEndAt: true,
  lastReviewedAt: true,
  createdAt: true,
  updatedAt: true,
  primaryRole: {
    select: {
      id: true,
      slug: true,
      name: true,
    },
  },
  _count: {
    select: {
      tasks: true,
      documents: true,
    },
  },
} satisfies Prisma.ProjectSelect;

type ProjectSeedContext = {
  id: string;
  name: string;
  summary: string;
  description?: string | null;
};

export type TaskProjectApiItem = Prisma.ProjectGetPayload<{
  select: typeof taskProjectApiSelect;
}>;

export function formatTaskProjectStatusLabel(status: ProjectStatus) {
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

export function formatTaskProjectPriorityLabel(priority: PriorityLevel) {
  return priority
    .toLowerCase()
    .split("_")
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

function slugifyProjectName(name: string) {
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

async function ensureProjectDocumentSet(project: ProjectSeedContext) {
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

function buildTaskProjectWhere({
  ownerId,
  status,
  slug,
  query,
  includeArchived,
}: {
  ownerId: string;
  status?: ProjectStatus;
  slug?: string;
  query?: string;
  includeArchived?: boolean;
}): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {
    ownerId,
  };

  if (slug) {
    where.slug = slug;
  }

  if (status) {
    where.status = status;
  } else if (!includeArchived) {
    where.status = {
      not: ProjectStatus.ARCHIVED,
    };
  }

  if (query) {
    where.OR = [
      {
        name: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        summary: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        slug: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: query,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
}

export function serializeTaskProject(project: TaskProjectApiItem) {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    summary: project.summary,
    description: project.description,
    status: project.status,
    statusLabel: formatTaskProjectStatusLabel(project.status),
    priority: project.priority,
    priorityLabel: formatTaskProjectPriorityLabel(project.priority),
    isActive: project.isActive,
    targetStartAt: project.targetStartAt?.toISOString() ?? null,
    targetEndAt: project.targetEndAt?.toISOString() ?? null,
    lastReviewedAt: project.lastReviewedAt?.toISOString() ?? null,
    primaryRole: project.primaryRole
      ? {
          id: project.primaryRole.id,
          slug: project.primaryRole.slug,
          name: project.primaryRole.name,
        }
      : null,
    counts: {
      tasks: project._count.tasks,
      documents: project._count.documents,
    },
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function listTaskProjectsForApi({
  ownerId,
  status,
  slug,
  query,
  includeArchived,
  limit,
}: {
  ownerId: string;
  status?: ProjectStatus;
  slug?: string;
  query?: string;
  includeArchived?: boolean;
  limit?: number;
}) {
  return prisma.project.findMany({
    where: buildTaskProjectWhere({
      ownerId,
      status,
      slug,
      query,
      includeArchived,
    }),
    select: taskProjectApiSelect,
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        name: "asc",
      },
    ],
    take: limit,
  });
}

export async function getTaskProjectById(projectId: string, ownerId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId,
    },
    select: taskProjectApiSelect,
  });
}

export async function getTaskProjectBySlug(slug: string, ownerId: string) {
  return prisma.project.findFirst({
    where: buildTaskProjectWhere({
      ownerId,
      slug,
      includeArchived: true,
    }),
    select: taskProjectApiSelect,
  });
}

export async function createTaskProjectRecord({
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
      name: true,
      summary: true,
      description: true,
    },
  });

  await ensureProjectDocumentSet(project);

  return getTaskProjectById(project.id, ownerId);
}

export async function updateTaskProjectRecord({
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
  await prisma.project.update({
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
  });

  return getTaskProjectById(projectId, ownerId);
}
