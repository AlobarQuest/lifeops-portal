import {
  PriorityLevel,
  Prisma,
  TaskRecurrenceRule,
  TaskStatus,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  slugifyTaskLabelName,
  syncTaskLabels,
} from "@/lib/task-labels";
import {
  parseTaskDate,
  type TaskView,
} from "@/lib/task-validators";
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
  parentTask: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
  recurrencePreviousTask: {
    select: {
      id: true,
      title: true,
      completedAt: true,
    },
  },
  comments: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      bodyMarkdown: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  },
  tags: {
    select: {
      tag: {
        select: {
          id: true,
          slug: true,
          name: true,
          color: true,
        },
      },
    },
  },
} satisfies Prisma.TaskInclude;

export type TaskListItem = Prisma.TaskGetPayload<{
  include: typeof taskListInclude;
}>;
type TaskDbClient = PrismaClient | Prisma.TransactionClient;
export type TaskCommentItem = TaskListItem["comments"][number];

type TaskMutableFields = {
  title?: string;
  description?: string | null;
  priority?: PriorityLevel;
  status?: TaskStatus;
  scheduledFor?: string | null;
  dueOn?: string | null;
  deadlineOn?: string | null;
  durationMinutes?: number | null;
  recurrenceRule?: TaskRecurrenceRule | null;
  sortOrder?: number | null;
  projectId?: string | null;
  sectionId?: string | null;
  parentTaskId?: string | null;
  labels?: string[];
  blockedReason?: string | null;
};

type TaskCreateInput = TaskMutableFields & {
  ownerId: string;
  title: string;
  priority: PriorityLevel;
  status: TaskStatus;
  description?: string;
  scheduledFor?: string;
  dueOn?: string;
  deadlineOn?: string;
  durationMinutes?: number;
  recurrenceRule?: TaskRecurrenceRule;
  sortOrder?: number;
  projectId?: string;
  sectionId?: string;
  parentTaskId?: string;
  labels?: string[];
  recurrencePreviousTaskId?: string;
  sourceType?: string;
  sourceKey?: string;
};

const activeTaskStatuses = [
  TaskStatus.INBOX,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
];

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

function formatTaskCalendarDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatTaskDateLabel(date: Date | null) {
  if (!date) {
    return "No date";
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (startOfDate.getTime() === startOfToday.getTime()) {
    return "Today";
  }

  if (startOfDate.getTime() === startOfTomorrow.getTime()) {
    return "Tomorrow";
  }

  return formatTaskCalendarDate(date);
}

export function formatTaskDueLabel(dueAt: Date | null) {
  if (!dueAt) {
    return "No due date";
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDueDate = new Date(dueAt.getFullYear(), dueAt.getMonth(), dueAt.getDate());

  if (startOfDueDate.getTime() < startOfToday.getTime()) {
    return "Overdue";
  }

  return formatTaskDateLabel(dueAt);
}

export function formatTaskScheduledLabel(scheduledFor: Date | null) {
  if (!scheduledFor) {
    return "Unscheduled";
  }

  return formatTaskDateLabel(scheduledFor);
}

export function formatTaskDeadlineLabel(deadlineAt: Date | null) {
  if (!deadlineAt) {
    return "No deadline";
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDeadline = new Date(deadlineAt.getFullYear(), deadlineAt.getMonth(), deadlineAt.getDate());

  if (startOfDeadline.getTime() < startOfToday.getTime()) {
    return "Overdue";
  }

  return formatTaskDateLabel(deadlineAt);
}

export function formatTaskDurationLabel(durationMinutes: number | null | undefined) {
  if (!durationMinutes || durationMinutes <= 0) {
    return "No estimate";
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function getTaskRecurrenceLabel(recurrenceRule: TaskRecurrenceRule | null | undefined) {
  switch (recurrenceRule) {
    case TaskRecurrenceRule.DAILY:
      return "Daily";
    case TaskRecurrenceRule.WEEKDAYS:
      return "Weekdays";
    case TaskRecurrenceRule.WEEKLY:
      return "Weekly";
    case TaskRecurrenceRule.MONTHLY:
      return "Monthly";
    default:
      return "Not recurring";
  }
}

export function formatTaskDateInputValue(date: Date | null | undefined) {
  if (!date) {
    return undefined;
  }

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function getNextWeekday(date: Date) {
  let nextDate = addDays(date, 1);

  while (nextDate.getUTCDay() === 0 || nextDate.getUTCDay() === 6) {
    nextDate = addDays(nextDate, 1);
  }

  return nextDate;
}

function getNextRecurringDate(date: Date, recurrenceRule: TaskRecurrenceRule) {
  switch (recurrenceRule) {
    case TaskRecurrenceRule.DAILY:
      return addDays(date, 1);
    case TaskRecurrenceRule.WEEKDAYS:
      return getNextWeekday(date);
    case TaskRecurrenceRule.WEEKLY:
      return addDays(date, 7);
    case TaskRecurrenceRule.MONTHLY: {
      const nextDate = new Date(date);
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
      return nextDate;
    }
    default:
      return date;
  }
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
  recurrenceRule,
  recurring,
  projectId,
  sectionId,
  parentTaskId,
  label,
  labelId,
  status,
  sourceType,
  sourceKey,
  includeArchived,
}: {
  ownerId?: string;
  view: TaskView;
  recurrenceRule?: TaskRecurrenceRule;
  recurring?: boolean;
  projectId?: string;
  sectionId?: string;
  parentTaskId?: string;
  label?: string;
  labelId?: string;
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

  if (recurrenceRule) {
    where.recurrenceRule = recurrenceRule;
  } else if (typeof recurring === "boolean") {
    where.recurrenceRule = recurring ? { not: null } : null;
  }

  if (projectId) {
    where.projectId = projectId;
  }

  if (sectionId) {
    where.sectionId = sectionId;
  }

  if (parentTaskId) {
    where.parentTaskId = parentTaskId;
  }

  if (labelId) {
    where.tags = {
      some: {
        tagId: labelId,
      },
    };
  } else if (label) {
    const normalizedLabel = label.trim();
    const normalizedSlug = slugifyTaskLabelName(normalizedLabel);

    where.tags = {
      some: {
        tag: {
          OR: [
            {
              name: {
                equals: normalizedLabel,
                mode: "insensitive",
              },
            },
            ...(normalizedSlug
              ? [
                  {
                    slug: normalizedSlug,
                  },
                ]
              : []),
          ],
        },
      },
    };
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
          in: activeTaskStatuses,
        };
        where.OR = [
          {
            scheduledFor: {
              gte: start,
              lt: end,
            },
          },
          {
            dueAt: {
              gte: start,
              lt: end,
            },
          },
          {
            deadlineAt: {
              gte: start,
              lt: end,
            },
          },
        ];
        break;
      case "overdue":
        where.status = {
          in: activeTaskStatuses,
        };
        where.OR = [
          {
            dueAt: {
              lt: start,
            },
          },
          {
            deadlineAt: {
              lt: start,
            },
          },
        ];
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
            in: activeTaskStatuses,
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
  recurrenceRule,
  recurring,
  projectId,
  sectionId,
  parentTaskId,
  label,
  labelId,
  status,
  limit,
  sourceType,
  sourceKey,
  includeArchived,
}: {
  ownerId?: string;
  view?: TaskView;
  recurrenceRule?: TaskRecurrenceRule;
  recurring?: boolean;
  projectId?: string;
  sectionId?: string;
  parentTaskId?: string;
  label?: string;
  labelId?: string;
  status?: TaskStatus;
  limit?: number;
  sourceType?: string;
  sourceKey?: string;
  includeArchived?: boolean;
}) {
  return prisma.task.findMany({
    where: buildTaskWhere({
      ownerId,
      view,
      recurrenceRule,
      recurring,
      projectId,
      sectionId,
      parentTaskId,
      label,
      labelId,
      status,
      sourceType,
      sourceKey,
      includeArchived,
    }),
    include: taskListInclude,
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        scheduledFor: "asc",
      },
      {
        dueAt: "asc",
      },
      {
        deadlineAt: "asc",
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
          in: activeTaskStatuses,
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
          in: activeTaskStatuses,
        },
        OR: [
          {
            scheduledFor: {
              gte: start,
              lt: end,
            },
          },
          {
            dueAt: {
              gte: start,
              lt: end,
            },
          },
          {
            deadlineAt: {
              gte: start,
              lt: end,
            },
          },
        ],
      },
    }),
    prisma.task.count({
      where: {
        ...baseWhere,
        status: {
          in: activeTaskStatuses,
        },
        OR: [
          {
            dueAt: {
              lt: start,
            },
          },
          {
            deadlineAt: {
              lt: start,
            },
          },
        ],
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
  scheduledFor,
  dueOn,
  deadlineOn,
  durationMinutes,
  recurrenceRule,
  sortOrder,
  projectId,
  sectionId,
  parentTaskId,
  recurrencePreviousTaskId,
  sourceType,
  sourceKey,
}: TaskCreateInput): Prisma.TaskUncheckedCreateInput {
  return {
    ownerId,
    title,
    description,
    priority,
    status,
    scheduledFor: parseTaskDate(scheduledFor),
    dueAt: parseTaskDate(dueOn),
    deadlineAt: parseTaskDate(deadlineOn),
    durationMinutes,
    recurrenceRule,
    sortOrder,
    parentTaskId,
    recurrencePreviousTaskId,
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
    ...(data.scheduledFor !== undefined
      ? {
          scheduledFor: data.scheduledFor ? parseTaskDate(data.scheduledFor) : null,
        }
      : {}),
    ...(data.dueOn !== undefined ? { dueAt: data.dueOn ? parseTaskDate(data.dueOn) : null } : {}),
    ...(data.deadlineOn !== undefined
      ? {
          deadlineAt: data.deadlineOn ? parseTaskDate(data.deadlineOn) : null,
        }
      : {}),
    ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes ?? null } : {}),
    ...(data.recurrenceRule !== undefined ? { recurrenceRule: data.recurrenceRule ?? null } : {}),
    ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder ?? null } : {}),
    ...(data.parentTaskId !== undefined ? { parentTaskId: data.parentTaskId ?? null } : {}),
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
      title: true,
      description: true,
      ownerId: true,
      status: true,
      priority: true,
      parentTaskId: true,
      recurrencePreviousTaskId: true,
      projectId: true,
      sectionId: true,
      scheduledFor: true,
      dueAt: true,
      deadlineAt: true,
      durationMinutes: true,
      recurrenceRule: true,
      sortOrder: true,
      sourceType: true,
      sourceKey: true,
      archivedAt: true,
      createdAt: true,
    },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  return task;
}

function buildTaskSiblingWhere({
  ownerId,
  parentTaskId,
  projectId,
  sectionId,
  excludeTaskId,
  includeArchived = false,
}: {
  ownerId: string;
  parentTaskId?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  excludeTaskId?: string;
  includeArchived?: boolean;
}): Prisma.TaskWhereInput {
  return {
    ownerId,
    parentTaskId: parentTaskId ?? null,
    projectId: projectId ?? null,
    sectionId: sectionId ?? null,
    ...(excludeTaskId
      ? {
          id: {
            not: excludeTaskId,
          },
        }
      : {}),
    ...(!includeArchived
      ? {
          archivedAt: null,
        }
      : {}),
  };
}

async function getNextTaskSortOrder({
  ownerId,
  parentTaskId,
  projectId,
  sectionId,
  excludeTaskId,
  db = prisma,
}: {
  ownerId: string;
  parentTaskId?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  excludeTaskId?: string;
  db?: TaskDbClient;
}) {
  const sibling = await db.task.findFirst({
    where: buildTaskSiblingWhere({
      ownerId,
      parentTaskId,
      projectId,
      sectionId,
      excludeTaskId,
    }),
    orderBy: [
      {
        sortOrder: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      sortOrder: true,
    },
  });

  return (sibling?.sortOrder ?? -1) + 1;
}

async function loadSiblingTasksForOrdering({
  ownerId,
  parentTaskId,
  projectId,
  sectionId,
  db = prisma,
}: {
  ownerId: string;
  parentTaskId?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  db?: TaskDbClient;
}) {
  return db.task.findMany({
    where: buildTaskSiblingWhere({
      ownerId,
      parentTaskId,
      projectId,
      sectionId,
    }),
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      id: true,
      sortOrder: true,
      createdAt: true,
    },
  });
}

async function applyTaskOrder({
  orderedTaskIds,
  db = prisma,
}: {
  orderedTaskIds: string[];
  db?: TaskDbClient;
}) {
  await Promise.all(
    orderedTaskIds.map((id, index) =>
      db.task.update({
        where: { id },
        data: {
          sortOrder: index,
        },
      }),
    ),
  );
}

function validateTaskScheduling({
  parentTaskId,
  scheduledFor,
  dueOn,
  deadlineOn,
  recurrenceRule,
}: {
  parentTaskId?: string | null;
  scheduledFor?: string | null;
  dueOn?: string | null;
  deadlineOn?: string | null;
  recurrenceRule?: TaskRecurrenceRule | null;
}) {
  if (recurrenceRule && parentTaskId) {
    throw new Error("Recurring subtasks are not supported yet.");
  }

  if (recurrenceRule && !scheduledFor && !dueOn && !deadlineOn) {
    throw new Error("Recurring tasks need a scheduled, due, or deadline date.");
  }

  if (scheduledFor && dueOn && scheduledFor > dueOn) {
    throw new Error("Scheduled date cannot be after the due date.");
  }

  if (scheduledFor && deadlineOn && scheduledFor > deadlineOn) {
    throw new Error("Scheduled date cannot be after the deadline.");
  }

  if (dueOn && deadlineOn && dueOn > deadlineOn) {
    throw new Error("Due date cannot be after the deadline.");
  }
}

function getNextRecurringSchedule(task: {
  scheduledFor: Date | null;
  dueAt: Date | null;
  deadlineAt: Date | null;
  recurrenceRule: TaskRecurrenceRule;
}) {
  const anchorDate = task.scheduledFor ?? task.dueAt ?? task.deadlineAt;

  if (!anchorDate) {
    throw new Error("Recurring tasks need a scheduled, due, or deadline date.");
  }

  const nextAnchorDate = getNextRecurringDate(anchorDate, task.recurrenceRule);
  const offsetFromAnchor = (date: Date | null) =>
    date ? date.getTime() - anchorDate.getTime() : null;

  return {
    scheduledFor: task.scheduledFor
      ? new Date(nextAnchorDate.getTime() + (offsetFromAnchor(task.scheduledFor) ?? 0))
      : null,
    dueAt: task.dueAt
      ? new Date(nextAnchorDate.getTime() + (offsetFromAnchor(task.dueAt) ?? 0))
      : null,
    deadlineAt: task.deadlineAt
      ? new Date(nextAnchorDate.getTime() + (offsetFromAnchor(task.deadlineAt) ?? 0))
      : null,
  };
}

export function serializeTaskComment(comment: TaskCommentItem) {
  return {
    id: comment.id,
    bodyMarkdown: comment.bodyMarkdown,
    author: {
      id: comment.author.id,
      displayName: comment.author.displayName,
      email: comment.author.email,
    },
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

async function assertValidParentTask({
  currentTaskId,
  ownerId,
  parentTaskId,
  db,
}: {
  currentTaskId?: string;
  ownerId: string;
  parentTaskId: string;
  db?: TaskDbClient;
}) {
  if (currentTaskId && currentTaskId === parentTaskId) {
    throw new Error("A task cannot be its own parent.");
  }

  const client = db ?? prisma;
  const parentTask = await assertOwnedTask(parentTaskId, ownerId, client);

  if (parentTask.archivedAt) {
    throw new Error("Parent task not found.");
  }

  let ancestorId = parentTask.parentTaskId;

  while (ancestorId) {
    if (currentTaskId && ancestorId === currentTaskId) {
      throw new Error("A task cannot be nested under one of its descendants.");
    }

    const ancestorTask = await assertOwnedTask(ancestorId, ownerId, client);
    ancestorId = ancestorTask.parentTaskId;
  }

  return parentTask;
}

async function collectDescendantTaskIds(taskId: string, ownerId: string, db: TaskDbClient = prisma) {
  const descendantIds: string[] = [];
  let frontier = [taskId];

  while (frontier.length > 0) {
    const childTasks = await db.task.findMany({
      where: {
        ownerId,
        parentTaskId: {
          in: frontier,
        },
      },
      select: {
        id: true,
      },
    });

    frontier = childTasks.map((task) => task.id);
    descendantIds.push(...frontier);
  }

  return descendantIds;
}

async function syncDescendantTaskRelations({
  taskId,
  ownerId,
  projectId,
  sectionId,
  db = prisma,
}: {
  taskId: string;
  ownerId: string;
  projectId: string | null;
  sectionId: string | null;
  db?: TaskDbClient;
}) {
  const descendantIds = await collectDescendantTaskIds(taskId, ownerId, db);

  if (descendantIds.length === 0) {
    return;
  }

  await db.task.updateMany({
    where: {
      id: {
        in: descendantIds,
      },
      ownerId,
    },
    data: {
      projectId,
      sectionId,
    },
  });
}

async function syncDescendantTaskArchivedState({
  taskId,
  ownerId,
  isArchived,
  db = prisma,
}: {
  taskId: string;
  ownerId: string;
  isArchived: boolean;
  db?: TaskDbClient;
}) {
  const descendantIds = await collectDescendantTaskIds(taskId, ownerId, db);

  if (descendantIds.length === 0) {
    return;
  }

  await db.task.updateMany({
    where: {
      id: {
        in: descendantIds,
      },
      ownerId,
    },
    data: {
      archivedAt: isArchived ? new Date() : null,
    },
  });
}

async function resolveTaskStructure({
  currentTaskId,
  ownerId,
  projectId,
  sectionId,
  parentTaskId,
  existingTask,
}: {
  currentTaskId?: string;
  ownerId: string;
  projectId?: string | null;
  sectionId?: string | null;
  parentTaskId?: string | null;
  existingTask?: Awaited<ReturnType<typeof assertOwnedTask>>;
}, db: TaskDbClient = prisma) {
  if (parentTaskId !== undefined) {
    if (parentTaskId === null) {
      const resolvedRelations = await resolveTaskRelationIds({
        ownerId,
        projectId: projectId !== undefined ? projectId : existingTask?.projectId,
        sectionId: sectionId !== undefined ? sectionId : existingTask?.sectionId,
      }, db);

      return {
        parentTaskId: null,
        projectId: resolvedRelations.projectId ?? null,
        sectionId: resolvedRelations.sectionId ?? null,
      };
    }

    const parentTask = await assertValidParentTask({
      currentTaskId,
      ownerId,
      parentTaskId,
      db,
    });

    if (projectId !== undefined && projectId !== (parentTask.projectId ?? null)) {
      throw new Error("Subtasks inherit the project from their parent task.");
    }

    if (sectionId !== undefined && sectionId !== (parentTask.sectionId ?? null)) {
      throw new Error("Subtasks inherit the section from their parent task.");
    }

    return {
      parentTaskId: parentTask.id,
      projectId: parentTask.projectId ?? null,
      sectionId: parentTask.sectionId ?? null,
    };
  }

  if (existingTask?.parentTaskId && (projectId !== undefined || sectionId !== undefined)) {
    throw new Error("Subtasks inherit project and section from their parent task.");
  }

  const resolvedRelations = await resolveTaskRelationIds({
    ownerId,
    projectId,
    sectionId,
  }, db);

  return {
    parentTaskId: existingTask?.parentTaskId ?? null,
    projectId: resolvedRelations.projectId ?? null,
    sectionId: resolvedRelations.sectionId ?? null,
  };
}

export async function createTaskRecord({
  ownerId,
  title,
  description,
  priority,
  status,
  scheduledFor,
  dueOn,
  deadlineOn,
  durationMinutes,
  recurrenceRule,
  sortOrder,
  projectId,
  sectionId,
  parentTaskId,
  labels,
  recurrencePreviousTaskId,
  sourceType,
  sourceKey,
}: TaskCreateInput, db: TaskDbClient = prisma) {
  const structure = await resolveTaskStructure({
    ownerId,
    projectId,
    sectionId,
    parentTaskId,
  }, db);

  validateTaskScheduling({
    parentTaskId: structure.parentTaskId ?? null,
    scheduledFor,
    dueOn,
    deadlineOn,
    recurrenceRule,
  });

  const resolvedSortOrder = sortOrder ?? await getNextTaskSortOrder({
    ownerId,
    parentTaskId: structure.parentTaskId ?? null,
    projectId: structure.projectId ?? null,
    sectionId: structure.sectionId ?? null,
    db,
  });

  const createdTask = await db.task.create({
    data: buildTaskCreateData({
      ownerId,
      title,
      description,
      priority,
      status,
      scheduledFor,
      dueOn,
      deadlineOn,
      durationMinutes,
      recurrenceRule,
      sortOrder: resolvedSortOrder,
      projectId: structure.projectId ?? undefined,
      sectionId: structure.sectionId ?? undefined,
      parentTaskId: structure.parentTaskId ?? undefined,
      recurrencePreviousTaskId,
      sourceType,
      sourceKey,
    }),
    include: taskListInclude,
  });

  if (labels !== undefined) {
    await syncTaskLabels({
      taskId: createdTask.id,
      labelNames: labels,
      db,
    });
  }

  return (await getTaskById(createdTask.id, ownerId, { includeArchived: true, db })) ?? createdTask;
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
        scheduledFor: input.scheduledFor,
        dueOn: input.dueOn,
        deadlineOn: input.deadlineOn,
        durationMinutes: input.durationMinutes,
        recurrenceRule: input.recurrenceRule,
        sortOrder: input.sortOrder,
        projectId: input.projectId,
        sectionId: input.sectionId,
        parentTaskId: input.parentTaskId,
        labels: input.labels,
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
  const shouldResolveStructure =
    data.projectId !== undefined || data.sectionId !== undefined || data.parentTaskId !== undefined;
  let structureData: Pick<TaskMutableFields, "projectId" | "sectionId" | "parentTaskId"> = {};

  if (shouldResolveStructure) {
    const targetProjectId = data.projectId !== undefined ? data.projectId : existingTask.projectId;
    let targetSectionId = data.sectionId !== undefined ? data.sectionId : existingTask.sectionId;

    if (data.projectId !== undefined && data.sectionId === undefined && data.projectId !== existingTask.projectId) {
      targetSectionId = null;
    }

    const resolvedStructure = await resolveTaskStructure({
      currentTaskId: taskId,
      ownerId,
      projectId: targetProjectId,
      sectionId: targetSectionId,
      parentTaskId: data.parentTaskId,
      existingTask,
    }, db);

    structureData = {
      projectId: resolvedStructure.projectId ?? null,
      sectionId: resolvedStructure.sectionId ?? null,
      parentTaskId: resolvedStructure.parentTaskId ?? null,
    };
  }

  const resolvedParentTaskId =
    structureData.parentTaskId !== undefined ? structureData.parentTaskId : existingTask.parentTaskId;

  validateTaskScheduling({
    parentTaskId: resolvedParentTaskId,
    scheduledFor:
      data.scheduledFor !== undefined
        ? data.scheduledFor
        : formatTaskDateInputValue(existingTask.scheduledFor) ?? null,
    dueOn:
      data.dueOn !== undefined
        ? data.dueOn
        : formatTaskDateInputValue(existingTask.dueAt) ?? null,
    deadlineOn:
      data.deadlineOn !== undefined
        ? data.deadlineOn
        : formatTaskDateInputValue(existingTask.deadlineAt) ?? null,
    recurrenceRule:
      data.recurrenceRule !== undefined ? data.recurrenceRule : existingTask.recurrenceRule,
  });

  const hasSiblingContextChanged =
    (structureData.projectId !== undefined && structureData.projectId !== existingTask.projectId) ||
    (structureData.sectionId !== undefined && structureData.sectionId !== existingTask.sectionId) ||
    (structureData.parentTaskId !== undefined && structureData.parentTaskId !== existingTask.parentTaskId);

  const resolvedSortOrder =
    data.sortOrder !== undefined
      ? data.sortOrder
      : hasSiblingContextChanged
        ? await getNextTaskSortOrder({
            ownerId,
            parentTaskId: resolvedParentTaskId,
            projectId: structureData.projectId !== undefined ? structureData.projectId : existingTask.projectId,
            sectionId: structureData.sectionId !== undefined ? structureData.sectionId : existingTask.sectionId,
            excludeTaskId: taskId,
            db,
          })
        : undefined;

  const updatedTask = await db.task.update({
    where: { id: taskId },
    data: buildTaskUpdateData({
      ...data,
      ...(resolvedSortOrder !== undefined ? { sortOrder: resolvedSortOrder } : {}),
      ...structureData,
    }),
  });

  if (data.labels !== undefined) {
    await syncTaskLabels({
      taskId,
      labelNames: data.labels,
      db,
    });
  }

  const shouldSyncDescendants =
    (structureData.projectId !== undefined && structureData.projectId !== existingTask.projectId) ||
    (structureData.sectionId !== undefined && structureData.sectionId !== existingTask.sectionId);

  if (shouldSyncDescendants) {
    await syncDescendantTaskRelations({
      taskId,
      ownerId,
      projectId: structureData.projectId ?? null,
      sectionId: structureData.sectionId ?? null,
      db,
    });
  }

  return updatedTask;
}

export async function listTaskComments(
  taskId: string,
  ownerId: string,
  db: TaskDbClient = prisma,
) {
  await assertOwnedTask(taskId, ownerId, db);

  return db.taskComment.findMany({
    where: {
      taskId,
      task: {
        ownerId,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      bodyMarkdown: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
}

export async function createTaskCommentRecord({
  taskId,
  ownerId,
  authorId,
  bodyMarkdown,
}: {
  taskId: string;
  ownerId: string;
  authorId: string;
  bodyMarkdown: string;
}, db: TaskDbClient = prisma) {
  await assertOwnedTask(taskId, ownerId, db);

  return db.taskComment.create({
    data: {
      taskId,
      authorId,
      bodyMarkdown,
    },
    select: {
      id: true,
      bodyMarkdown: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
}

export async function moveTaskRecord(
  taskId: string,
  ownerId: string,
  direction: "up" | "down",
  db: TaskDbClient = prisma,
) {
  const task = await assertOwnedTask(taskId, ownerId, db);
  const siblings = await loadSiblingTasksForOrdering({
    ownerId,
    parentTaskId: task.parentTaskId,
    projectId: task.projectId,
    sectionId: task.sectionId,
    db,
  });

  const currentIndex = siblings.findIndex((sibling) => sibling.id === taskId);

  if (currentIndex === -1) {
    throw new Error("Task not found.");
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return getTaskById(taskId, ownerId, { includeArchived: true, db });
  }

  const reorderedTaskIds = siblings.map((sibling) => sibling.id);
  const [movedTaskId] = reorderedTaskIds.splice(currentIndex, 1);

  if (!movedTaskId) {
    throw new Error("Task not found.");
  }

  reorderedTaskIds.splice(targetIndex, 0, movedTaskId);

  await applyTaskOrder({
    orderedTaskIds: reorderedTaskIds,
    db,
  });

  return getTaskById(taskId, ownerId, { includeArchived: true, db });
}

export async function setTaskCompletion(
  taskId: string,
  ownerId: string,
  isComplete: boolean,
  db: TaskDbClient = prisma,
) {
  const ownedTask = await assertOwnedTask(taskId, ownerId, db);
  const task = await getTaskById(taskId, ownerId, {
    includeArchived: true,
    db,
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  if (!isComplete) {
    if (task.recurrenceRule) {
      const generatedNextTask = await db.task.findFirst({
        where: {
          recurrencePreviousTaskId: taskId,
          archivedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (generatedNextTask) {
        throw new Error("Cannot reopen a recurring task after the next occurrence has been generated.");
      }
    }

    const reopenedTask = await db.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.TODO,
        completedAt: null,
      },
    });

    return {
      task: reopenedTask,
      nextTask: null,
    };
  }

  if (!task.recurrenceRule) {
    const completedTask = await db.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.DONE,
        completedAt: new Date(),
      },
    });

    return {
      task: completedTask,
      nextTask: null,
    };
  }

  const recurrenceRule = ownedTask.recurrenceRule;

  if (!recurrenceRule) {
    throw new Error("Recurring task rule missing.");
  }

  const existingNextTask = await db.task.findFirst({
    where: {
      recurrencePreviousTaskId: taskId,
      archivedAt: null,
    },
    include: taskListInclude,
  });

  if (existingNextTask) {
    if (task.status !== TaskStatus.DONE) {
      throw new Error("Next recurring task already exists.");
    }

    return {
      task,
      nextTask: existingNextTask,
    };
  }

  const nextSchedule = getNextRecurringSchedule({
    scheduledFor: ownedTask.scheduledFor,
    dueAt: ownedTask.dueAt,
    deadlineAt: ownedTask.deadlineAt,
    recurrenceRule,
  });

  const completedTask = await db.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.DONE,
      completedAt: new Date(),
      ...(ownedTask.sourceType || ownedTask.sourceKey
        ? {
            sourceType: null,
            sourceKey: null,
          }
        : {}),
    },
  });

  const nextTask = await createTaskRecord({
    ownerId: ownedTask.ownerId,
    title: ownedTask.title,
    description: ownedTask.description ?? undefined,
    priority: ownedTask.priority,
    status: TaskStatus.TODO,
    scheduledFor: formatTaskDateInputValue(nextSchedule.scheduledFor),
    dueOn: formatTaskDateInputValue(nextSchedule.dueAt),
    deadlineOn: formatTaskDateInputValue(nextSchedule.deadlineAt),
    durationMinutes: ownedTask.durationMinutes ?? undefined,
    recurrenceRule,
    sortOrder: ownedTask.sortOrder ?? undefined,
    projectId: ownedTask.projectId ?? undefined,
    sectionId: ownedTask.sectionId ?? undefined,
    labels: task.tags.map((taskTag) => taskTag.tag.name),
    recurrencePreviousTaskId: ownedTask.id,
    sourceType: ownedTask.sourceType ?? undefined,
    sourceKey: ownedTask.sourceKey ?? undefined,
  }, db);

  return {
    task: completedTask,
    nextTask,
  };
}

export async function setTaskArchived(
  taskId: string,
  ownerId: string,
  isArchived: boolean,
  db: TaskDbClient = prisma,
) {
  await assertOwnedTask(taskId, ownerId, db);
  const updatedTask = await db.task.update({
    where: { id: taskId },
    data: {
      archivedAt: isArchived ? new Date() : null,
    },
  });

  await syncDescendantTaskArchivedState({
    taskId,
    ownerId,
    isArchived,
    db,
  });

  return updatedTask;
}

export function serializeTask(task: TaskListItem) {
  return {
    id: task.id,
    sortOrder: task.sortOrder,
    parentTaskId: task.parentTaskId,
    recurrencePreviousTaskId: task.recurrencePreviousTaskId,
    title: task.title,
    description: task.description,
    status: task.status,
    statusLabel: getTaskStatusLabel(task.status),
    priority: task.priority,
    priorityLabel: getTaskPriorityLabel(task.priority),
    scheduledFor: task.scheduledFor?.toISOString() ?? null,
    scheduledLabel: formatTaskScheduledLabel(task.scheduledFor),
    dueAt: task.dueAt?.toISOString() ?? null,
    dueLabel: formatTaskDueLabel(task.dueAt),
    deadlineAt: task.deadlineAt?.toISOString() ?? null,
    deadlineLabel: formatTaskDeadlineLabel(task.deadlineAt),
    durationMinutes: task.durationMinutes,
    durationLabel: formatTaskDurationLabel(task.durationMinutes),
    recurrenceRule: task.recurrenceRule,
    recurrenceLabel: getTaskRecurrenceLabel(task.recurrenceRule),
    archivedAt: task.archivedAt?.toISOString() ?? null,
    blockedReason: task.blockedReason,
    sourceType: task.sourceType,
    sourceKey: task.sourceKey,
    comments: task.comments.map(serializeTaskComment),
    commentCount: task.comments.length,
    labels: task.tags.map((taskTag) => ({
      id: taskTag.tag.id,
      slug: taskTag.tag.slug,
      name: taskTag.tag.name,
      color: taskTag.tag.color,
    })),
    parentTask: task.parentTask
      ? {
          id: task.parentTask.id,
          title: task.parentTask.title,
          status: task.parentTask.status,
          statusLabel: getTaskStatusLabel(task.parentTask.status),
        }
      : null,
    recurrencePreviousTask: task.recurrencePreviousTask
      ? {
          id: task.recurrencePreviousTask.id,
          title: task.recurrencePreviousTask.title,
          completedAt: task.recurrencePreviousTask.completedAt?.toISOString() ?? null,
        }
      : null,
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
