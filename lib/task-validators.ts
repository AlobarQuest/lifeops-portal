import { PriorityLevel, TaskStatus } from "@prisma/client";
import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalDateString = optionalString.refine(
  (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
  "Use a valid date.",
);

const nullableOptionalString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const nullableOptionalDateString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((value) => value === undefined || value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "Use a valid date.");

const optionalSourceType = z
  .string()
  .trim()
  .max(80, "Source type is too long.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalSourceKey = z
  .string()
  .trim()
  .max(160, "Source key is too long.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

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

export const taskViewValues = [
  "all",
  "inbox",
  "today",
  "overdue",
  "blocked",
  "completed",
] as const;

export type TaskView = (typeof taskViewValues)[number];

export const taskSourceReferenceSchema = z
  .object({
    sourceType: optionalSourceType,
    sourceKey: optionalSourceKey,
  })
  .superRefine((value, context) => {
    if ((value.sourceType && !value.sourceKey) || (!value.sourceType && value.sourceKey)) {
      context.addIssue({
        code: "custom",
        path: value.sourceType ? ["sourceKey"] : ["sourceType"],
        message: "Provide both sourceType and sourceKey together.",
      });
    }
  });

export const createTaskInputSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a task title."),
    description: optionalString,
    priority: z.nativeEnum(PriorityLevel).default(PriorityLevel.MEDIUM),
    status: z.nativeEnum(TaskStatus).default(TaskStatus.INBOX),
    dueOn: optionalDateString,
    projectId: optionalString,
    sectionId: optionalString,
    sourceType: optionalSourceType,
    sourceKey: optionalSourceKey,
  })
  .superRefine((value, context) => {
    if ((value.sourceType && !value.sourceKey) || (!value.sourceType && value.sourceKey)) {
      context.addIssue({
        code: "custom",
        path: value.sourceType ? ["sourceKey"] : ["sourceType"],
        message: "Provide both sourceType and sourceKey together.",
      });
    }
  });

export const updateTaskInputSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: nullableOptionalString,
  priority: z.nativeEnum(PriorityLevel).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueOn: nullableOptionalDateString,
  projectId: nullableOptionalString,
  sectionId: nullableOptionalString,
  blockedReason: nullableOptionalString,
});

export const taskListFilterSchema = z.object({
  view: z.enum(taskViewValues).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  projectId: optionalString,
  sectionId: optionalString,
  sourceType: optionalSourceType,
  sourceKey: optionalSourceKey,
  includeArchived: optionalBooleanString,
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export function parseDueOn(value?: string) {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T12:00:00.000Z`);
}
