import {
  PriorityLevel,
  Prisma,
  TaskStatus,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { parseDueOn, type TaskView } from "@/lib/task-validators";
import { getOwnedTaskSectionContext } from "@/lib/task-sections";

const taskListInclude = {
  project: {
    select: {
      id: true,
      slug: true,
      name: true,
    },
  },
  section: {
    select: {
      id: true,
      name: true,
      sortOrder: true,
      projectId: true,
    },
  },
  role: {
    select: {
      id: true,
      slug: true,
      name: true,
    },
  },
} satisfies Prisma.TaskInclude;

export type TaskListItem = Prisma.TaskGetPayload<{
  include: typeof taskListInclude;
}>;
type TaskDbClient = PrismaClient | Prisma.TransactionClient;

type TaskMutableFields = {
  title?: string;
  description?: string | null;
  priority?: PriorityLevel;
  status?: TaskStatus;
  dueOn?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  blockedReason?: string | null;
};

type TaskCreateInput = TaskMutableFields & {
  ownerId: string;
  title: string;
  priority: PriorityLevel;
  status: TaskStatus;
  description?: string;
  dueOn?: string;
  projectId?: string;
  sectionId?: string;
  sourceType?: string;
  sourceKey?: string;
};

export function getTaskStatusLabel(status: TaskStatus) {
  switch (status) {
    case TaskStatus.INBOX:
      return "Inbox";
    case TaskStatus.TODO:
      return "Next";
    case TaskStatus.IN_PROGRESS:
      return "In progress";
    case TaskStatus.BLOCKED:
      return "Blocked";
    case TaskStatus.DONE:
      return "Done";
    case TaskStatus.CANCELED:
      return "Canceled";
    default:
      return status;
  }
}

export function getTaskPriorityLabel(priority: PriorityLevel) {
  switch (priority) {
    case PriorityLevel.CRITICAL:
      return "Critical";
    case PriorityLevel.HIGH:
      return "High";
    case PriorityLevel.MEDIUM:
      return "Medium";
    case PriorityLevel.LOW:
      return "Low";
    default:
      return priority;
  }
}

export function formatTaskDueLabel(dueAt: Date | null) {
  if (!dueAt) {
    return "No due date";
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDueDate = new Date(dueAt.getFullYear(), dueAt.getMonth(), dueAt.getDate());

  if (startOfDueDate.getTime() < startOfToday.getTime()) {
    return "Overdue";
  }

  if (startOfDueDate.getTime() === startOfToday.getTime()) {
    return "Today";
  }

  if (startOfDueDate.getTime() === startOfTomorrow.getTime()) {
    return "Tomorrow";
  }

  return dueAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getTaskViewLabel(view: TaskView) {
  switch (view) {
    case "all":
      return "All";
    case "inbox":
      return "Inbox";
    case "today":
      return "Today";
    case "overdue":
      return "Overdue";
    case "blocked":
      return "Blocked";
    case "completed":
      return "Completed";
    default:
      return view;
  }
}

function getTodayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function buildTaskWhere({
  ownerId,
  view,
  projectId,
  sectionId,
  status,
  sourceType,
  sourceKey,
  includeArchived,
}: {
  ownerId?: string;
  view: TaskView;
  projectId?: string;
  sectionId?: string;
  status?: TaskStatus;
  sourceType?: string;
  sourceKey?: string;
  includeArchived?: boolean;
}): Prisma.TaskWhereInput {
  const { start, end } = getTodayBounds();
  const where: Prisma.TaskWhereInput = ownerId ? { ownerId } : {};

  if (!includeArchived && !sourceType && !sourceKey) {
    where.archivedAt = null;
  }

  if (projectId) {
    where.projectId = projectId;
  }

  if (sectionId) {
    where.sectionId = sectionId;
  }

  if (sourceType) {
    where.sourceType = sourceType;
  }

  if (sourceKey) {
    where.sourceKey = sourceKey;
  }

  if (status) {
    where.status = status;
  } else {
    switch (view) {
      case "inbox":
        where.status = TaskStatus.INBOX;
        break;
      case "today":
        where.status = {
          in: [TaskStatus.INBOX, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        };
        where.dueAt = {
          gte: start,
          lt: end,
        };
        break;
      case "overdue":
        where.status = {
          in: [TaskStatus.INBOX, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        };
        where.dueAt = {
          lt: start,
        };
        break;
      case "blocked":
        where.status = TaskStatus.BLOCKED;
        break;
      case "completed":
        where.status = TaskStatus.DONE;
        break;
      case "all":
      default:
        if (!sourceType && !sourceKey) {
          where.status = {
            in: [TaskStatus.INBOX, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
          };
        }
        break;
    }
  }

  return where;
}

export async function listTasks({
  ownerId,
  view = "all",
  projectId,
  sectionId,
  status,
  limit,
  sourceType,
  sourceKey,
  includeArchived,
}: {
  ownerId?: string;
  view?: TaskView;
  projectId?: string;
  sectionId?: string;
  status?: TaskStatus;
  limit?: number;
  sourceType?: string;
  sourceKey?: string;
  includeArchived?: boolean;
}) {
  return prisma.task.findMany({
    where: buildTaskWhere({ ownerId, view, projectId, sectionId, status, sourceType, sourceKey, includeArchived }),
    include: taskListInclude,
    orderBy: [
      {
        dueAt: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
    take: limit,
  });
}

export async function getTaskCounts(ownerId?: string) {
  const { start, end } = getTodayBounds();
  const baseWhere = {
    ...(ownerId ? { ownerId } : {}),
    archivedAt: null,
  };

  const [all, inbox, today, overdue, blocked, completed] = await Promise.all([
    prisma.task.count({
      where: {
        ...baseWhere,
        status: {
          in: [TaskStatus.INBOX, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        },
      },
    }),
    prisma.task.count({
      where: {
        ...baseWhere,
        status: TaskStatus.INBOX,
      },
    }),
    prisma.task.count({
      where: {
        ...baseWhere,
        status: {
          in: [TaskStatus.INBOX, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        },
        dueAt: {
          gte: start,
          lt: end,
        },
      },
    }),
    prisma.task.count({
      where: {
        ...baseWhere,
        status: {
          in: [TaskStatus.INBOX, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        },
        dueAt: {
          lt: start,
        },
      },
    }),
    prisma.task.count({
      where: {
        ...baseWhere,
        status: TaskStatus.BLOCKED,
      },
    }),
    prisma.task.count({
      where: {
        ...baseWhere,
        status: TaskStatus.DONE,
      },
    }),
  ]);

  return {
    all,
    inbox,
    today,
    overdue,
    blocked,
    completed,
  };
}

export async function listTaskProjects() {
  return prisma.project.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getTaskById(
  taskId: string,
  ownerId?: string,
  options?: { includeArchived?: boolean; db?: TaskDbClient },
) {
  const db = options?.db ?? prisma;

  return db.task.findFirst({
    where: {
      id: taskId,
      ...(ownerId ? { ownerId } : {}),
      ...(!options?.includeArchived ? { archivedAt: null } : {}),
    },
    include: taskListInclude,
  });
}

export async function getTaskBySource({
  ownerId,
  sourceType,
  sourceKey,
  includeArchived,
  db,
}: {
  ownerId: string;
  sourceType: string;
  sourceKey: string;
  includeArchived?: boolean;
  db?: TaskDbClient;
}) {
  const client = db ?? prisma;

  return client.task.findFirst({
    where: {
      ownerId,
      sourceType,
      sourceKey,
      ...(!includeArchived ? { archivedAt: null } : {}),
    },
    include: taskListInclude,
  });
}

function buildTaskCreateData({
  ownerId,
  title,
  description,
  priority,
  status,
  dueOn,
  projectId,
  sectionId,
  sourceType,
  sourceKey,
}: TaskCreateInput): Prisma.TaskUncheckedCreateInput {
  return {
    ownerId,
    title,
    description,
    priority,
    status,
    dueAt: parseDueOn(dueOn),
    projectId,
    sectionId,
    sourceType,
    sourceKey,
  };
}

function buildTaskUpdateData(data: TaskMutableFields): Prisma.TaskUncheckedUpdateInput {
  return {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.priority !== undefined ? { priority: data.priority } : {}),
    ...(data.status !== undefined
      ? {
          status: data.status,
          completedAt: data.status === TaskStatus.DONE ? new Date() : null,
        }
      : {}),
    ...(data.dueOn !== undefined ? { dueAt: data.dueOn ? parseDueOn(data.dueOn) : null } : {}),
    ...(data.projectId !== undefined ? { projectId: data.projectId ?? null } : {}),
    ...(data.sectionId !== undefined ? { sectionId: data.sectionId ?? null } : {}),
    ...(data.blockedReason !== undefined ? { blockedReason: data.blockedReason ?? null } : {}),
  };
}

async function assertOwnedProject(projectId: string, ownerId: string, db: TaskDbClient = prisma) {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      ownerId,
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}

async function resolveTaskRelationIds({
  ownerId,
  projectId,
  sectionId,
}: {
  ownerId: string;
  projectId?: string | null;
  sectionId?: string | null;
}, db: TaskDbClient = prisma) {
  let resolvedProjectId = projectId;
  let resolvedSectionId = sectionId;

  if (resolvedSectionId) {
    const section = await getOwnedTaskSectionContext(resolvedSectionId, ownerId, db);

    if (!section || section.archivedAt) {
      throw new Error("Section not found.");
    }

    if (resolvedProjectId && section.project.id !== resolvedProjectId) {
      throw new Error("Section does not belong to the selected project.");
    }

    resolvedProjectId = section.project.id;
  }

  if (resolvedProjectId) {
    await assertOwnedProject(resolvedProjectId, ownerId, db);
  }

  if (resolvedProjectId === null) {
    resolvedSectionId = null;
  }

  return {
    projectId: resolvedProjectId,
    sectionId: resolvedSectionId,
  };
}

async function assertOwnedTask(taskId: string, ownerId: string, db: TaskDbClient = prisma) {
  const task = await db.task.findFirst({
    where: {
      id: taskId,
      ownerId,
    },
    select: {
      id: true,
      projectId: true,
      sectionId: true,
    },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  return task;
}

export async function createTaskRecord({
  ownerId,
  title,
  description,
  priority,
  status,
  dueOn,
  projectId,
  sectionId,
  sourceType,
  sourceKey,
}: TaskCreateInput, db: TaskDbClient = prisma) {
  const relationIds = await resolveTaskRelationIds({
    ownerId,
    projectId,
    sectionId,
  }, db);

  return db.task.create({
    data: buildTaskCreateData({
      ownerId,
      title,
      description,
      priority,
      status,
      dueOn,
      projectId: relationIds.projectId ?? undefined,
      sectionId: relationIds.sectionId ?? undefined,
      sourceType,
      sourceKey,
    }),
    include: taskListInclude,
  });
}

export async function createOrUpsertTaskRecord(input: TaskCreateInput) {
  return createOrUpsertTaskRecordWithDb(input, prisma);
}

export async function createOrUpsertTaskRecordWithDb(input: TaskCreateInput, db: TaskDbClient) {
  if (input.sourceType && input.sourceKey) {
    const existingTask = await getTaskBySource({
      ownerId: input.ownerId,
      sourceType: input.sourceType,
      sourceKey: input.sourceKey,
      includeArchived: true,
      db,
    });

    if (existingTask) {
      await updateTaskRecord(existingTask.id, input.ownerId, {
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        dueOn: input.dueOn,
        projectId: input.projectId,
        sectionId: input.sectionId,
      }, db);
      if (existingTask.archivedAt) {
        await setTaskArchived(existingTask.id, input.ownerId, false, db);
      }

      const task = await getTaskById(existingTask.id, input.ownerId, { includeArchived: true, db });

      return {
        task: task ?? existingTask,
        created: false,
      };
    }
  }

  const task = await createTaskRecord(input, db);

  return {
    task,
    created: true,
  };
}

export async function updateTaskRecord(
  taskId: string,
  ownerId: string,
  data: TaskMutableFields,
  db: TaskDbClient = prisma,
) {
  const existingTask = await assertOwnedTask(taskId, ownerId, db);
  const shouldResolveRelations = data.projectId !== undefined || data.sectionId !== undefined;
  let relationData: Pick<TaskMutableFields, "projectId" | "sectionId"> = {};

  if (shouldResolveRelations) {
    const targetProjectId = data.projectId !== undefined ? data.projectId : existingTask.projectId;
    let targetSectionId = data.sectionId !== undefined ? data.sectionId : existingTask.sectionId;

    if (data.projectId !== undefined && data.sectionId === undefined && data.projectId !== existingTask.projectId) {
      targetSectionId = null;
    }

    const resolvedRelations = await resolveTaskRelationIds({
      ownerId,
      projectId: targetProjectId,
      sectionId: targetSectionId,
    }, db);

    relationData = {
      projectId: resolvedRelations.projectId ?? null,
      sectionId: resolvedRelations.sectionId ?? null,
    };
  }

  return db.task.update({
    where: { id: taskId },
    data: buildTaskUpdateData({
      ...data,
      ...relationData,
    }),
  });
}

export async function setTaskCompletion(
  taskId: string,
  ownerId: string,
  isComplete: boolean,
  db: TaskDbClient = prisma,
) {
  await assertOwnedTask(taskId, ownerId, db);

  return db.task.update({
    where: { id: taskId },
    data: {
      status: isComplete ? TaskStatus.DONE : TaskStatus.TODO,
      completedAt: isComplete ? new Date() : null,
    },
  });
}

export async function setTaskArchived(
  taskId: string,
  ownerId: string,
  isArchived: boolean,
  db: TaskDbClient = prisma,
) {
  await assertOwnedTask(taskId, ownerId, db);

  return db.task.update({
    where: { id: taskId },
    data: {
      archivedAt: isArchived ? new Date() : null,
    },
  });
}

export function serializeTask(task: TaskListItem) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    statusLabel: getTaskStatusLabel(task.status),
    priority: task.priority,
    priorityLabel: getTaskPriorityLabel(task.priority),
    dueAt: task.dueAt?.toISOString() ?? null,
    dueLabel: formatTaskDueLabel(task.dueAt),
    archivedAt: task.archivedAt?.toISOString() ?? null,
    blockedReason: task.blockedReason,
    sourceType: task.sourceType,
    sourceKey: task.sourceKey,
    project: task.project
      ? {
          id: task.project.id,
          slug: task.project.slug,
          name: task.project.name,
        }
      : null,
    section: task.section
      ? {
          id: task.section.id,
          name: task.section.name,
          sortOrder: task.section.sortOrder,
          projectId: task.section.projectId,
        }
      : null,
    role: task.role
      ? {
          id: task.role.id,
          slug: task.role.slug,
          name: task.role.name,
        }
      : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
