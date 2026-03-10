"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { ensureProjectDocumentSet, updateProjectDocumentRecord } from "@/lib/projects";
import { updateProjectDocumentInputSchema } from "@/lib/project-validators";

export type ProjectDocumentActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

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
