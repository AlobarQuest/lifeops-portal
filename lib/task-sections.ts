import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type TaskSectionDbClient = Prisma.TransactionClient | typeof prisma;

const taskSectionApiSelect = {
  id: true,
  name: true,
  sortOrder: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      slug: true,
      name: true,
    },
  },
  _count: {
    select: {
      tasks: true,
    },
  },
} satisfies Prisma.TaskSectionSelect;

export type TaskSectionApiItem = Prisma.TaskSectionGetPayload<{
  select: typeof taskSectionApiSelect;
}>;

function buildTaskSectionWhere({
  ownerId,
  projectId,
  includeArchived,
}: {
  ownerId: string;
  projectId?: string;
  includeArchived?: boolean;
}): Prisma.TaskSectionWhereInput {
  const where: Prisma.TaskSectionWhereInput = {
    project: {
      ownerId,
    },
  };

  if (projectId) {
    where.projectId = projectId;
  }

  if (!includeArchived) {
    where.archivedAt = null;
  }

  return where;
}

async function assertOwnedProject(projectId: string, ownerId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}

async function getNextSortOrder(projectId: string) {
  const section = await prisma.taskSection.findFirst({
    where: {
      projectId,
    },
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });

  return (section?.sortOrder ?? -1) + 1;
}

export function serializeTaskSection(section: TaskSectionApiItem) {
  return {
    id: section.id,
    name: section.name,
    sortOrder: section.sortOrder,
    archivedAt: section.archivedAt?.toISOString() ?? null,
    project: {
      id: section.project.id,
      slug: section.project.slug,
      name: section.project.name,
    },
    counts: {
      tasks: section._count.tasks,
    },
    createdAt: section.createdAt.toISOString(),
    updatedAt: section.updatedAt.toISOString(),
  };
}

export async function listTaskSectionsForApi({
  ownerId,
  projectId,
  includeArchived,
  limit,
}: {
  ownerId: string;
  projectId?: string;
  includeArchived?: boolean;
  limit?: number;
}) {
  return prisma.taskSection.findMany({
    where: buildTaskSectionWhere({
      ownerId,
      projectId,
      includeArchived,
    }),
    select: taskSectionApiSelect,
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
    take: limit,
  });
}

export async function getTaskSectionById(sectionId: string, ownerId: string) {
  return prisma.taskSection.findFirst({
    where: {
      id: sectionId,
      project: {
        ownerId,
      },
    },
    select: taskSectionApiSelect,
  });
}

export async function getOwnedTaskSectionContext(
  sectionId: string,
  ownerId: string,
  db: TaskSectionDbClient = prisma,
) {
  return db.taskSection.findFirst({
    where: {
      id: sectionId,
      project: {
        ownerId,
      },
    },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      archivedAt: true,
      project: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });
}

export async function createTaskSectionRecord({
  ownerId,
  projectId,
  name,
  sortOrder,
}: {
  ownerId: string;
  projectId: string;
  name: string;
  sortOrder?: number;
}) {
  await assertOwnedProject(projectId, ownerId);

  const section = await prisma.taskSection.create({
    data: {
      projectId,
      name,
      sortOrder: sortOrder ?? (await getNextSortOrder(projectId)),
    },
    select: {
      id: true,
    },
  });

  return getTaskSectionById(section.id, ownerId);
}

export async function updateTaskSectionRecord({
  sectionId,
  ownerId,
  name,
  sortOrder,
  archived,
}: {
  sectionId: string;
  ownerId: string;
  name?: string;
  sortOrder?: number;
  archived?: boolean;
}) {
  const existingSection = await getTaskSectionById(sectionId, ownerId);

  if (!existingSection) {
    throw new Error("Section not found.");
  }

  await prisma.taskSection.update({
    where: {
      id: sectionId,
    },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
    },
  });

  return getTaskSectionById(sectionId, ownerId);
}
