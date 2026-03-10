import {
  Prisma,
  ProjectDocumentType,
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
