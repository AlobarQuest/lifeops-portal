import { ProjectDocumentType } from "@prisma/client";
import { z } from "zod";

export const updateProjectDocumentInputSchema = z.object({
  projectSlug: z.string().min(1, "Project slug is required."),
  documentType: z.nativeEnum(ProjectDocumentType),
  bodyMarkdown: z.string().max(100_000, "Document content is too large."),
});
