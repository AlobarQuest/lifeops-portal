export const navItems = [
  { href: "/", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/projects", label: "Projects" },
  { href: "/ideas", label: "Ideas" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/resources", label: "Resources" },
  { href: "/reviews", label: "Reviews" },
  { href: "/settings", label: "Settings" },
];

export const dashboardMetrics = [
  { label: "Today", value: "7", tone: "sunrise" },
  { label: "Blocked", value: "2", tone: "ember" },
  { label: "Active Projects", value: "5", tone: "atlas" },
  { label: "Fresh Knowledge", value: "14", tone: "mint" },
];

export const projects = [
  {
    slug: "lifeops-portal",
    name: "LifeOps Portal MVP",
    role: "Developer",
    status: "Active",
    summary: "Build the command center that unifies work, planning, and knowledge.",
    nextAction: "Scaffold the production app and ship the first Coolify deployment.",
    blocker: "Need initial schema and authentication baseline finalized.",
  },
  {
    slug: "realtor-operations-refresh",
    name: "Realtor Operations Refresh",
    role: "Realtor",
    status: "Planned",
    summary: "Restructure listing, contact, and follow-up workflows into reusable playbooks.",
    nextAction: "Capture the current intake and follow-up process in knowledge items.",
    blocker: "Waiting on a complete workflow inventory.",
  },
  {
    slug: "adjuster-playbook",
    name: "Adjuster Playbook",
    role: "Adjuster",
    status: "Blocked",
    summary: "Convert field knowledge and claim response patterns into SOP-driven execution.",
    nextAction: "Review existing notes and classify them by claim stage.",
    blocker: "Source notes still live across multiple tools.",
  },
];

export const tasks = [
  {
    title: "Create Docker-first application scaffold",
    project: "LifeOps Portal MVP",
    due: "Today",
    status: "In Progress",
    priority: "Critical",
  },
  {
    title: "Draft Prisma schema from object model",
    project: "LifeOps Portal MVP",
    due: "Today",
    status: "Todo",
    priority: "High",
  },
  {
    title: "Set up weekly review screen inventory",
    project: "LifeOps Portal MVP",
    due: "This week",
    status: "Todo",
    priority: "Medium",
  },
  {
    title: "Capture open role-specific SOPs",
    project: "Adjuster Playbook",
    due: "Overdue",
    status: "Blocked",
    priority: "High",
  },
];

export const knowledgeItems = [
  {
    title: "MVP Boundary",
    type: "Definition",
    summary: "Dashboard, tasks, projects, intake, knowledge, search, and resources are the version 1 line.",
  },
  {
    title: "Deployment Shape",
    type: "Decision",
    summary: "One Dockerfile-based Coolify application plus a separate PostgreSQL resource.",
  },
  {
    title: "Role Model",
    type: "Reference",
    summary: "Developer, Realtor, Adjuster, Venture, Executive, and Knowledge remain the initial lenses.",
  },
];

export const resources = [
  {
    title: "GitHub Repository",
    type: "Repo",
    summary: "Primary source repository for LifeOpsPortal.",
    url: "https://github.com/AlobarQuest/lifeops-portal",
  },
  {
    title: "Coolify Server",
    type: "Service",
    summary: "Deployment control plane hosted at coolify-1.devonwatkins.com.",
    url: "https://coolify-1.devonwatkins.com",
  },
  {
    title: "Portal Domain",
    type: "Link",
    summary: "Production application address for the MVP.",
    url: "https://portal.devonwatkins.com",
  },
];

export const reviews = [
  "2 blocked tasks have no resolution owner yet.",
  "1 active project has not been reviewed in the last seven days.",
  "3 idea captures are ready for promote-or-park decisions.",
];

