import {
  PriorityLevel,
  ProjectDocumentType,
  ProjectStatus,
} from "@prisma/client";
import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

export const updateProjectDocumentInputSchema = z.object({
  projectSlug: z.string().min(1, "Project slug is required."),
  documentType: z.nativeEnum(ProjectDocumentType),
  bodyMarkdown: z.string().max(100_000, "Document content is too large."),
});

const projectDateInputSchema = optionalString;
const hasValidProjectDateOrder = (value: {
  targetStartOn?: string;
  targetEndOn?: string;
}) =>
  !value.targetStartOn ||
  !value.targetEndOn ||
  new Date(value.targetStartOn).getTime() <= new Date(value.targetEndOn).getTime();

const optionalBooleanString = z
  .string()
  .optional()
  .transform((value) => value?.trim().toLowerCase())
  .refine((value) => value === undefined || value === "true" || value === "false", "Use true or false.")
  .transform((value) => (value === undefined ? undefined : value === "true"));

const baseProjectInputShape = {
  name: z.string().trim().min(2, "Project name is required.").max(120, "Project name is too long."),
  summary: z.string().trim().min(12, "Add a useful project summary.").max(280, "Summary is too long."),
  description: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => !value || value.length <= 10_000, "Description is too long."),
  status: z.nativeEnum(ProjectStatus),
  priority: z.nativeEnum(PriorityLevel),
  primaryRoleId: optionalString,
  targetStartOn: projectDateInputSchema,
  targetEndOn: projectDateInputSchema,
};

const baseProjectInputObject = z.object(baseProjectInputShape);

export const baseProjectInputSchema = baseProjectInputObject
  .refine(
    hasValidProjectDateOrder,
    {
      message: "Target end date must be on or after the target start date.",
      path: ["targetEndOn"],
    },
  );

export const createProjectInputSchema = baseProjectInputSchema;

export const updateProjectInputSchema = baseProjectInputObject
  .extend({
    projectSlug: z.string().min(1, "Project slug is required."),
  })
  .refine(
    hasValidProjectDateOrder,
    {
      message: "Target end date must be on or after the target start date.",
      path: ["targetEndOn"],
    },
  );

export const deleteProjectInputSchema = z.object({
  projectSlug: z.string().min(1, "Project slug is required."),
});

export const taskProjectFilterSchema = z.object({
  id: optionalString,
  slug: optionalString,
  q: optionalString,
  status: z.nativeEnum(ProjectStatus).optional(),
  includeArchived: optionalBooleanString,
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createTaskProjectInputSchema = baseProjectInputObject
  .extend({
    status: z.nativeEnum(ProjectStatus).default(ProjectStatus.DRAFT),
    priority: z.nativeEnum(PriorityLevel).default(PriorityLevel.MEDIUM),
  })
  .refine(
    hasValidProjectDateOrder,
    {
      message: "Target end date must be on or after the target start date.",
      path: ["targetEndOn"],
    },
  );

export const updateTaskProjectInputSchema = z
  .object({
    name: z.string().trim().min(2, "Project name is required.").max(120, "Project name is too long.").optional(),
    summary: z.string().trim().min(12, "Add a useful project summary.").max(280, "Summary is too long.").optional(),
    description: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined)
      .refine((value) => !value || value.length <= 10_000, "Description is too long."),
    status: z.nativeEnum(ProjectStatus).optional(),
    priority: z.nativeEnum(PriorityLevel).optional(),
    primaryRoleId: optionalString,
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
