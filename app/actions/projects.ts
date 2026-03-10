"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import {
  createProjectRecord,
  deleteProjectRecord,
  ensureProjectDocumentSet,
  updateProjectDocumentRecord,
  updateProjectRecord,
} from "@/lib/projects";
import {
  createProjectInputSchema,
  deleteProjectInputSchema,
  updateProjectDocumentInputSchema,
  updateProjectInputSchema,
} from "@/lib/project-validators";

function parseDateInput(value?: string) {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00`);
}

export type ProjectDocumentActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

export type ProjectFormActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function createProjectAction(
  _previousState: ProjectFormActionState,
  formData: FormData,
): Promise<ProjectFormActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/projects");
  }

  const parsed = createProjectInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    description: String(formData.get("description") ?? ""),
    status: String(formData.get("status") ?? "DRAFT"),
    priority: String(formData.get("priority") ?? "MEDIUM"),
    primaryRoleId: String(formData.get("primaryRoleId") ?? ""),
    targetStartOn: String(formData.get("targetStartOn") ?? ""),
    targetEndOn: String(formData.get("targetEndOn") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the project fields and try again.",
    };
  }

  const project = await createProjectRecord({
    ownerId: currentUser.id,
    name: parsed.data.name,
    summary: parsed.data.summary,
    description: parsed.data.description,
    status: parsed.data.status,
    priority: parsed.data.priority,
    primaryRoleId: parsed.data.primaryRoleId,
    targetStartAt: parseDateInput(parsed.data.targetStartOn),
    targetEndAt: parseDateInput(parsed.data.targetEndOn),
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.slug}`);
}

export async function updateProjectAction(
  _previousState: ProjectFormActionState,
  formData: FormData,
): Promise<ProjectFormActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/projects");
  }

  const parsed = updateProjectInputSchema.safeParse({
    projectSlug: String(formData.get("projectSlug") ?? ""),
    name: String(formData.get("name") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    description: String(formData.get("description") ?? ""),
    status: String(formData.get("status") ?? "DRAFT"),
    priority: String(formData.get("priority") ?? "MEDIUM"),
    primaryRoleId: String(formData.get("primaryRoleId") ?? ""),
    targetStartOn: String(formData.get("targetStartOn") ?? ""),
    targetEndOn: String(formData.get("targetEndOn") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the project fields and try again.",
    };
  }

  const project = await prisma.project.findFirst({
    where: {
      slug: parsed.data.projectSlug,
      ownerId: currentUser.id,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!project) {
    return {
      status: "error",
      message: "Project not found.",
    };
  }

  await updateProjectRecord({
    projectId: project.id,
    ownerId: currentUser.id,
    name: parsed.data.name,
    summary: parsed.data.summary,
    description: parsed.data.description,
    status: parsed.data.status,
    priority: parsed.data.priority,
    primaryRoleId: parsed.data.primaryRoleId,
    targetStartAt: parseDateInput(parsed.data.targetStartOn),
    targetEndAt: parseDateInput(parsed.data.targetEndOn),
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${project.slug}`);

  return {
    status: "success",
    message: "Project details saved.",
  };
}

export async function deleteProjectAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/projects");
  }

  const parsed = deleteProjectInputSchema.safeParse({
    projectSlug: String(formData.get("projectSlug") ?? ""),
  });

  if (!parsed.success) {
    redirect("/projects");
  }

  const project = await prisma.project.findFirst({
    where: {
      slug: parsed.data.projectSlug,
      ownerId: currentUser.id,
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    redirect("/projects");
  }

  await deleteProjectRecord({
    projectId: project.id,
    ownerId: currentUser.id,
  });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProjectDocumentAction(
  _previousState: ProjectDocumentActionState,
  formData: FormData,
): Promise<ProjectDocumentActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?redirectTo=/projects");
  }

  const parsed = updateProjectDocumentInputSchema.safeParse({
    projectSlug: String(formData.get("projectSlug") ?? ""),
    documentType: String(formData.get("documentType") ?? ""),
    bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the document fields and try again.",
    };
  }

  const project = await prisma.project.findFirst({
    where: {
      slug: parsed.data.projectSlug,
      ownerId: currentUser.id,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      description: true,
    },
  });

  if (!project) {
    return {
      status: "error",
      message: "Project not found.",
    };
  }

  await ensureProjectDocumentSet(project);
  await updateProjectDocumentRecord({
    projectId: project.id,
    type: parsed.data.documentType,
    bodyMarkdown: parsed.data.bodyMarkdown,
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${project.slug}`);

  return {
    status: "success",
    message: "Project document saved.",
  };
}
