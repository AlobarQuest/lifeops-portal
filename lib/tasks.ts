import {
  PriorityLevel,
  Prisma,
  TaskStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { parseDueOn, type TaskView } from "@/lib/task-validators";

const taskListInclude = {
  project: {
    select: {
      id: true,
      slug: true,
      name: true,
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
  status,
}: {
  ownerId?: string;
  view: TaskView;
  projectId?: string;
  status?: TaskStatus;
}): Prisma.TaskWhereInput {
  const { start, end } = getTodayBounds();
  const where: Prisma.TaskWhereInput = ownerId ? { ownerId } : {};

  if (projectId) {
    where.projectId = projectId;
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
        where.status = {
          in: [TaskStatus.INBOX, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        };
        break;
    }
  }

  return where;
}

export async function listTasks({
  ownerId,
  view = "all",
  projectId,
  status,
  limit,
}: {
  ownerId?: string;
  view?: TaskView;
  projectId?: string;
  status?: TaskStatus;
  limit?: number;
}) {
  return prisma.task.findMany({
    where: buildTaskWhere({ ownerId, view, projectId, status }),
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
  const baseWhere = ownerId ? { ownerId } : {};

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

export async function getTaskById(taskId: string, ownerId?: string) {
  return prisma.task.findFirst({
    where: {
      id: taskId,
      ...(ownerId ? { ownerId } : {}),
    },
    include: taskListInclude,
  });
}

export async function createTaskRecord({
  ownerId,
  title,
  description,
  priority,
  status,
  dueOn,
  projectId,
}: {
  ownerId: string;
  title: string;
  description?: string;
  priority: PriorityLevel;
  status: TaskStatus;
  dueOn?: string;
  projectId?: string;
}) {
  return prisma.task.create({
    data: {
      ownerId,
      title,
      description,
      priority,
      status,
      dueAt: parseDueOn(dueOn),
      projectId,
    },
  });
}

export async function updateTaskRecord(
  taskId: string,
  data: {
    title?: string;
    description?: string;
    priority?: PriorityLevel;
    status?: TaskStatus;
    dueOn?: string;
    projectId?: string;
    blockedReason?: string;
  },
) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.status !== undefined
        ? {
            status: data.status,
            completedAt: data.status === TaskStatus.DONE ? new Date() : null,
          }
        : {}),
      ...(data.dueOn !== undefined ? { dueAt: parseDueOn(data.dueOn) ?? null } : {}),
      ...(data.projectId !== undefined ? { projectId: data.projectId ?? null } : {}),
      ...(data.blockedReason !== undefined ? { blockedReason: data.blockedReason } : {}),
    },
  });
}

export async function setTaskCompletion(taskId: string, isComplete: boolean) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      status: isComplete ? TaskStatus.DONE : TaskStatus.TODO,
      completedAt: isComplete ? new Date() : null,
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
    blockedReason: task.blockedReason,
    project: task.project
      ? {
          id: task.project.id,
          slug: task.project.slug,
          name: task.project.name,
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
