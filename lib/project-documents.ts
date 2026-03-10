import { ProjectDocumentType } from "@prisma/client";

type ProjectSeedContext = {
  name: string;
  summary: string;
  description?: string | null;
};

export const projectDocumentDefinitions = [
  {
    type: ProjectDocumentType.PROJECT_CHARTER,
    slug: "project-charter",
    title: "Project Charter",
    description: "Why this project exists, what success looks like, and the boundaries that matter.",
  },
  {
    type: ProjectDocumentType.PRODUCT_BRIEF,
    slug: "product-brief",
    title: "Product Brief",
    description: "The operator-facing summary of the problem, target outcome, and expected behavior.",
  },
  {
    type: ProjectDocumentType.SCOPE_BACKLOG,
    slug: "scope-backlog",
    title: "Scope / Backlog",
    description: "Current scope, near-term backlog, and what is intentionally not in this phase.",
  },
  {
    type: ProjectDocumentType.REQUIREMENTS_USER_STORIES,
    slug: "requirements-user-stories",
    title: "Requirements / User Stories",
    description: "Concrete requirements and user-story language that can drive implementation.",
  },
  {
    type: ProjectDocumentType.ARCHITECTURE_OVERVIEW,
    slug: "architecture-overview",
    title: "Architecture Overview",
    description: "High-level system shape, components, and interfaces that matter for build decisions.",
  },
  {
    type: ProjectDocumentType.DATA_MODEL,
    slug: "data-model",
    title: "Data Model",
    description: "Core objects, relationships, and persistence decisions for this project.",
  },
  {
    type: ProjectDocumentType.DECISION_LOG,
    slug: "decision-log",
    title: "Decision Log",
    description: "Record of meaningful choices, tradeoffs, and reversals.",
  },
  {
    type: ProjectDocumentType.TASK_BOARD,
    slug: "task-board",
    title: "Task Board",
    description: "Execution-oriented notes that pair with the live project task list shown on this page.",
  },
  {
    type: ProjectDocumentType.TEST_CHECKLIST,
    slug: "test-checklist",
    title: "Test Checklist",
    description: "Manual and automated checks that determine whether the current slice is ready.",
  },
  {
    type: ProjectDocumentType.DEPLOYMENT_NOTES,
    slug: "deployment-notes",
    title: "Deployment Notes",
    description: "Operational notes, dependencies, environment details, and rollout reminders.",
  },
  {
    type: ProjectDocumentType.AI_COLLABORATION_RULES,
    slug: "ai-collaboration-rules",
    title: "AI Collaboration Rules",
    description: "Project-specific instructions for AI-assisted work, review, and editing.",
  },
  {
    type: ProjectDocumentType.PROJECT_CONTEXT_PACK,
    slug: "project-context-pack",
    title: "Project Context Pack",
    description: "The compact handoff bundle that lets work resume quickly in a later session.",
  },
] as const;

const definitionByType = new Map<ProjectDocumentType, (typeof projectDocumentDefinitions)[number]>(
  projectDocumentDefinitions.map((definition) => [definition.type, definition]),
);
const definitionBySlug = new Map<string, (typeof projectDocumentDefinitions)[number]>(
  projectDocumentDefinitions.map((definition) => [definition.slug, definition]),
);

export function getProjectDocumentDefinition(type: ProjectDocumentType) {
  return definitionByType.get(type);
}

export function getProjectDocumentTypeFromSlug(slug?: string | null) {
  if (!slug) {
    return projectDocumentDefinitions[0].type;
  }

  return definitionBySlug.get(slug)?.type ?? projectDocumentDefinitions[0].type;
}

export function getProjectDocumentSlug(type: ProjectDocumentType) {
  return getProjectDocumentDefinition(type)?.slug ?? projectDocumentDefinitions[0].slug;
}

function buildProjectCharterTemplate(project: ProjectSeedContext) {
  return `# ${project.name}

## Mission
- Why this project exists:
- What operator problem it solves:

## Success Definition
- Primary outcome:
- Clear win condition:
- Failure condition:

## Boundaries
- In scope:
- Out of scope:
- Constraints:
`;
}

function buildGenericTemplate(project: ProjectSeedContext, heading: string, prompts: string[]) {
  return `# ${heading}

Project: ${project.name}
Summary: ${project.summary}

${prompts.map((prompt) => `## ${prompt}\n- `).join("\n\n")}
`;
}

export function buildProjectDocumentTemplate(project: ProjectSeedContext, type: ProjectDocumentType) {
  switch (type) {
    case ProjectDocumentType.PROJECT_CHARTER:
      return buildProjectCharterTemplate(project);
    case ProjectDocumentType.PRODUCT_BRIEF:
      return buildGenericTemplate(project, "Product Brief", [
        "Problem",
        "Target operator",
        "Desired outcome",
        "Primary workflow",
      ]);
    case ProjectDocumentType.SCOPE_BACKLOG:
      return buildGenericTemplate(project, "Scope / Backlog", [
        "Current scope",
        "Next slice",
        "Deferred items",
      ]);
    case ProjectDocumentType.REQUIREMENTS_USER_STORIES:
      return buildGenericTemplate(project, "Requirements / User Stories", [
        "Requirements",
        "User stories",
        "Open questions",
      ]);
    case ProjectDocumentType.ARCHITECTURE_OVERVIEW:
      return buildGenericTemplate(project, "Architecture Overview", [
        "System shape",
        "Key dependencies",
        "Interfaces",
      ]);
    case ProjectDocumentType.DATA_MODEL:
      return buildGenericTemplate(project, "Data Model", [
        "Core entities",
        "Important relationships",
        "Persistence notes",
      ]);
    case ProjectDocumentType.DECISION_LOG:
      return buildGenericTemplate(project, "Decision Log", [
        "Decision",
        "Reasoning",
        "Follow-up",
      ]);
    case ProjectDocumentType.TASK_BOARD:
      return buildGenericTemplate(project, "Task Board", [
        "Current lanes",
        "Execution notes",
        "Coordination notes",
      ]);
    case ProjectDocumentType.TEST_CHECKLIST:
      return buildGenericTemplate(project, "Test Checklist", [
        "Happy path checks",
        "Failure mode checks",
        "Release gate",
      ]);
    case ProjectDocumentType.DEPLOYMENT_NOTES:
      return buildGenericTemplate(project, "Deployment Notes", [
        "Environment requirements",
        "Deploy steps",
        "Rollback notes",
      ]);
    case ProjectDocumentType.AI_COLLABORATION_RULES:
      return buildGenericTemplate(project, "AI Collaboration Rules", [
        "Working rules",
        "Review expectations",
        "Unsafe assumptions to avoid",
      ]);
    case ProjectDocumentType.PROJECT_CONTEXT_PACK:
      return buildGenericTemplate(project, "Project Context Pack", [
        "Current state",
        "Important references",
        "Fast restart notes",
      ]);
    default:
      return `# ${project.name}\n\n- Add the first working notes for this document.\n`;
  }
}
