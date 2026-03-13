import { PrismaPg } from "@prisma/adapter-pg";
import {
  PriorityLevel,
  ProjectStatus,
  PrismaClient,
  TaskStatus,
} from "@prisma/client";

import {
  buildProjectDocumentTemplate,
  projectDocumentDefinitions,
} from "../lib/project-documents";
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

  const roleRecords = await prisma.role.findMany({
    where: {
      slug: {
        in: ["developer", "realtor", "adjuster"],
      },
    },
  });
  const rolesBySlug = new Map(roleRecords.map((role) => [role.slug, role]));

  if (!rolesBySlug.get("developer")) {
    return;
  }

  const projectSeeds = [
    {
      slug: "lifeops-portal",
      name: "LifeOps Portal MVP",
      summary: "Build the internal control room that replaces fragmented planning and execution tools.",
      description: "First-party dashboard, task system, and knowledge base for Devon-owned operations.",
      status: ProjectStatus.ACTIVE,
      priority: PriorityLevel.CRITICAL,
      primaryRoleSlug: "developer",
    },
    {
      slug: "realtor-operations-refresh",
      name: "Realtor Operations Refresh",
      summary: "Restructure listing, contact, and follow-up workflows into reusable playbooks.",
      description: "Turn the current realtor operating model into repeatable systems, docs, and checkpoints.",
      status: ProjectStatus.PLANNED,
      priority: PriorityLevel.HIGH,
      primaryRoleSlug: "realtor",
    },
    {
      slug: "adjuster-playbook",
      name: "Adjuster Playbook",
      summary: "Convert field knowledge and claim response patterns into SOP-driven execution.",
      description: "Capture the working adjuster playbook and move it into durable, structured execution documents.",
      status: ProjectStatus.BLOCKED,
      priority: PriorityLevel.HIGH,
      primaryRoleSlug: "adjuster",
    },
  ] as const;

  const seededProjects = [];

  for (const projectSeed of projectSeeds) {
    const primaryRole = rolesBySlug.get(projectSeed.primaryRoleSlug);

    const project = await prisma.project.upsert({
      where: { slug: projectSeed.slug },
      update: {
        name: projectSeed.name,
        summary: projectSeed.summary,
        description: projectSeed.description,
        status: projectSeed.status,
        ownerId: owner.id,
        primaryRoleId: primaryRole?.id,
        priority: projectSeed.priority,
        isActive: true,
      },
      create: {
        slug: projectSeed.slug,
        name: projectSeed.name,
        summary: projectSeed.summary,
        description: projectSeed.description,
        status: projectSeed.status,
        ownerId: owner.id,
        primaryRoleId: primaryRole?.id,
        priority: projectSeed.priority,
        isActive: true,
      },
    });

    seededProjects.push(project);

    for (const definition of projectDocumentDefinitions) {
      await prisma.projectDocument.upsert({
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
      });
    }
  }

  const lifeOpsProject = seededProjects.find((project) => project.slug === "lifeops-portal");
  const realtorProject = seededProjects.find((project) => project.slug === "realtor-operations-refresh");
  const adjusterProject = seededProjects.find((project) => project.slug === "adjuster-playbook");
  const developerRole = rolesBySlug.get("developer");
  const realtorRole = rolesBySlug.get("realtor");
  const adjusterRole = rolesBySlug.get("adjuster");
  const seededSectionsByKey = new Map<string, { id: string; projectId: string; name: string }>();

  for (const sectionSeed of [
    lifeOpsProject
      ? { projectId: lifeOpsProject.id, name: "Platform", sortOrder: 0 }
      : null,
    lifeOpsProject
      ? { projectId: lifeOpsProject.id, name: "Integrations", sortOrder: 1 }
      : null,
    realtorProject
      ? { projectId: realtorProject.id, name: "Pipeline", sortOrder: 0 }
      : null,
    adjusterProject
      ? { projectId: adjusterProject.id, name: "Playbook Buildout", sortOrder: 0 }
      : null,
  ]) {
    if (!sectionSeed) {
      continue;
    }

    const section = await prisma.taskSection.upsert({
      where: {
        projectId_name: {
          projectId: sectionSeed.projectId,
          name: sectionSeed.name,
        },
      },
      update: {
        sortOrder: sectionSeed.sortOrder,
        archivedAt: null,
      },
      create: sectionSeed,
      select: {
        id: true,
        projectId: true,
        name: true,
      },
    });

    seededSectionsByKey.set(`${section.projectId}:${section.name}`, section);
  }

  const taskCount = await prisma.task.count();

  if (taskCount === 0 && lifeOpsProject && developerRole) {
    await prisma.task.createMany({
      data: [
        {
          ownerId: owner.id,
          projectId: lifeOpsProject.id,
          sectionId: seededSectionsByKey.get(`${lifeOpsProject.id}:Platform`)?.id,
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
          sectionId: seededSectionsByKey.get(`${lifeOpsProject.id}:Integrations`)?.id,
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
        ...(realtorProject && realtorRole
          ? [
              {
                ownerId: owner.id,
                projectId: realtorProject.id,
                sectionId: seededSectionsByKey.get(`${realtorProject.id}:Pipeline`)?.id,
                roleId: realtorRole.id,
                title: "Document the current listing-to-close workflow",
                description: "Capture the real-world process and move it into the new project document pack.",
                status: TaskStatus.TODO,
                priority: PriorityLevel.HIGH,
              },
            ]
          : []),
        ...(adjusterProject && adjusterRole
          ? [
              {
                ownerId: owner.id,
                projectId: adjusterProject.id,
                sectionId: seededSectionsByKey.get(`${adjusterProject.id}:Playbook Buildout`)?.id,
                roleId: adjusterRole.id,
                title: "Inventory field notes for the adjuster playbook",
                description: "Pull scattered notes into one documented operating flow inside the project workspace.",
                status: TaskStatus.BLOCKED,
                priority: PriorityLevel.HIGH,
                blockedReason: "Source notes still live across multiple tools.",
              },
            ]
          : []),
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
