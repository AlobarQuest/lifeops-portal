import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type TaskLabelDbClient = Prisma.TransactionClient | typeof prisma;

export function slugifyTaskLabelName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function normalizeTaskLabelNames(labelNames: string[]) {
  const deduped = new Map<string, string>();

  for (const labelName of labelNames) {
    const trimmed = labelName.trim();

    if (!trimmed) {
      continue;
    }

    const normalizedKey = trimmed.toLowerCase();

    if (!deduped.has(normalizedKey)) {
      deduped.set(normalizedKey, trimmed);
    }
  }

  return Array.from(deduped.values());
}

export async function ensureTaskLabels(labelNames: string[], db: TaskLabelDbClient = prisma) {
  const normalizedNames = normalizeTaskLabelNames(labelNames);

  if (normalizedNames.length === 0) {
    return [];
  }

  const labels = [];

  for (const labelName of normalizedNames) {
    const slug = slugifyTaskLabelName(labelName) || "label";
    const label = await db.tag.upsert({
      where: {
        slug,
      },
      update: {
        name: labelName,
      },
      create: {
        slug,
        name: labelName,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        color: true,
      },
    });

    labels.push(label);
  }

  return labels;
}

export async function syncTaskLabels({
  taskId,
  labelNames,
  db = prisma,
}: {
  taskId: string;
  labelNames: string[];
  db?: TaskLabelDbClient;
}) {
  const labels = await ensureTaskLabels(labelNames, db);

  await db.taskTag.deleteMany({
    where: {
      taskId,
    },
  });

  if (labels.length > 0) {
    await db.taskTag.createMany({
      data: labels.map((label) => ({
        taskId,
        tagId: label.id,
      })),
    });
  }

  return labels;
}

export async function listTaskLabelsForOwner({
  ownerId,
  limit,
  query,
}: {
  ownerId: string;
  limit?: number;
  query?: string;
}) {
  return prisma.tag.findMany({
    where: {
      ...(query
        ? {
            OR: [
              {
                name: {
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
            ],
          }
        : {}),
      taskLinks: {
        some: {
          task: {
            ownerId,
          },
        },
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      color: true,
      _count: {
        select: {
          taskLinks: true,
        },
      },
    },
    orderBy: [
      {
        name: "asc",
      },
    ],
    take: limit,
  });
}

export async function getTaskLabelById(labelId: string, ownerId: string) {
  return prisma.tag.findFirst({
    where: {
      id: labelId,
      taskLinks: {
        some: {
          task: {
            ownerId,
          },
        },
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      color: true,
      _count: {
        select: {
          taskLinks: true,
        },
      },
    },
  });
}
