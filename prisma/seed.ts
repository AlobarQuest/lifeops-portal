import { PrismaPg } from "@prisma/adapter-pg";
import {
  PriorityLevel,
  ProjectStatus,
  PrismaClient,
  TaskStatus,
} from "@prisma/client";

import { hashPassword } from "../lib/password";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const roles = [
  { slug: "developer", name: "Developer", description: "Software delivery, repos, systems, and technical work.", sortOrder: 1 },
  { slug: "realtor", name: "Realtor", description: "Listings, contacts, showings, and deal flow.", sortOrder: 2 },
  { slug: "adjuster", name: "Adjuster", description: "Claims, inspections, estimates, and field operations.", sortOrder: 3 },
  { slug: "venture", name: "Venture", description: "New bets, experiments, and strategic initiatives.", sortOrder: 4 },
  { slug: "executive", name: "Executive", description: "Cross-role visibility, prioritization, and planning.", sortOrder: 5 },
  { slug: "knowledge", name: "Knowledge", description: "Definitions, SOPs, lessons, and durable notes.", sortOrder: 6 },
];

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL ?? process.env.AUTH_EMAIL ?? "devon.watkins@gmail.com";
  const ownerPassword = process.env.AUTH_PASSWORD;
  const passwordHash = ownerPassword ? hashPassword(ownerPassword) : undefined;
  const passwordUpdatedAt = passwordHash ? new Date() : undefined;

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      displayName: "Devon Watkins",
      isOwner: true,
      ...(passwordHash
        ? {
            passwordHash,
            passwordUpdatedAt,
          }
        : {}),
    },
    create: {
      email: ownerEmail,
      displayName: "Devon Watkins",
      isOwner: true,
      passwordHash,
      passwordUpdatedAt,
    },
  });

  for (const role of roles) {
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: role,
      create: role,
    });
  }

  const developerRole = await prisma.role.findUnique({
    where: { slug: "developer" },
  });

  if (!developerRole) {
    return;
  }

  const lifeOpsProject = await prisma.project.upsert({
    where: { slug: "lifeops-portal" },
    update: {},
    create: {
      slug: "lifeops-portal",
      name: "LifeOps Portal MVP",
      summary: "Build the internal control room that replaces fragmented planning and execution tools.",
      description: "First-party dashboard, task system, and knowledge base for Devon-owned operations.",
      status: ProjectStatus.ACTIVE,
      ownerId: owner.id,
      primaryRoleId: developerRole.id,
      priority: PriorityLevel.CRITICAL,
      isActive: true,
    },
  });

  const taskCount = await prisma.task.count();

  if (taskCount === 0) {
    await prisma.task.createMany({
      data: [
        {
          ownerId: owner.id,
          projectId: lifeOpsProject.id,
          roleId: developerRole.id,
          title: "Replace placeholder task page with live task queries",
          description: "Back the /tasks page with Prisma data, real filters, and a capture flow.",
          status: TaskStatus.IN_PROGRESS,
          priority: PriorityLevel.CRITICAL,
          dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        },
        {
          ownerId: owner.id,
          projectId: lifeOpsProject.id,
          roleId: developerRole.id,
          title: "Stand up the first task API routes",
          description: "Expose LifeOps tasks through API endpoints so other internal apps can converge on one task layer.",
          status: TaskStatus.TODO,
          priority: PriorityLevel.HIGH,
          dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
        },
        {
          ownerId: owner.id,
          title: "Import current Todoist workload into LifeOps task planning",
          description: "Use Todoist as a migration source only and stop treating it as the long-term system of record.",
          status: TaskStatus.INBOX,
          priority: PriorityLevel.MEDIUM,
        },
      ],
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
