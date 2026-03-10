import {
  PriorityLevel,
  ProjectDocumentType,
  ProjectStatus,
} from "@prisma/client";
import { z } from "zod";

export const updateProjectDocumentInputSchema = z.object({
  projectSlug: z.string().min(1, "Project slug is required."),
  documentType: z.nativeEnum(ProjectDocumentType),
  bodyMarkdown: z.string().max(100_000, "Document content is too large."),
});

const projectDateInputSchema = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

export const baseProjectInputSchema = z
  .object({
    name: z.string().trim().min(2, "Project name is required.").max(120, "Project name is too long."),
    summary: z.string().trim().min(12, "Add a useful project summary.").max(280, "Summary is too long."),
    description: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined)
      .refine((value) => !value || value.length <= 10_000, "Description is too long."),
    status: z.nativeEnum(ProjectStatus),
    priority: z.nativeEnum(PriorityLevel),
    primaryRoleId: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    targetStartOn: projectDateInputSchema,
    targetEndOn: projectDateInputSchema,
  })
  .refine(
    (value) =>
      !value.targetStartOn ||
      !value.targetEndOn ||
      new Date(value.targetStartOn).getTime() <= new Date(value.targetEndOn).getTime(),
    {
      message: "Target end date must be on or after the target start date.",
      path: ["targetEndOn"],
    },
  );

export const createProjectInputSchema = baseProjectInputSchema;

export const updateProjectInputSchema = baseProjectInputSchema.extend({
  projectSlug: z.string().min(1, "Project slug is required."),
});

export const deleteProjectInputSchema = z.object({
  projectSlug: z.string().min(1, "Project slug is required."),
});
