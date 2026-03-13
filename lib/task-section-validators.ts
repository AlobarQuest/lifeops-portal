import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const optionalBooleanString = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }

    return value;
  })
  .refine((value) => value === undefined || typeof value === "boolean", "Use true or false.");

export const taskSectionFilterSchema = z.object({
  id: optionalString,
  projectId: optionalString,
  includeArchived: optionalBooleanString,
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createTaskSectionInputSchema = z.object({
  projectId: z.string().trim().min(1, "Project id is required."),
  name: z.string().trim().min(1, "Section name is required.").max(120, "Section name is too long."),
  sortOrder: z.coerce.number().int().min(0).max(100_000).optional().default(0),
});

export const updateTaskSectionInputSchema = z
  .object({
    name: z.string().trim().min(1, "Section name is required.").max(120, "Section name is too long.").optional(),
    sortOrder: z.coerce.number().int().min(0).max(100_000).optional(),
    archived: optionalBooleanString,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one section field to update.",
  });
