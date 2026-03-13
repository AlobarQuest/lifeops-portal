import {
  PriorityLevel,
  TaskRecurrenceRule,
  TaskStatus,
} from "@prisma/client";
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

const optionalIntegerString = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "number") {
      return value;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    return Number.parseInt(trimmed, 10);
  })
  .refine(
    (value) => value === undefined || (Number.isInteger(value) && value >= 0),
    "Use a whole number.",
  );

const nullableOptionalIntegerString = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value === "number") {
      return value;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    return Number.parseInt(trimmed, 10);
  })
  .refine(
    (value) => value === undefined || value === null || (Number.isInteger(value) && value >= 0),
    "Use a whole number.",
  );

const optionalSortOrder = optionalIntegerString.refine(
  (value) => value === undefined || value <= 100_000,
  "Use 100,000 or less.",
);

const nullableOptionalSortOrder = nullableOptionalIntegerString.refine(
  (value) => value === undefined || value === null || value <= 100_000,
  "Use 100,000 or less.",
);

const optionalRecurrenceRule = z
  .union([z.nativeEnum(TaskRecurrenceRule), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

const nullableOptionalRecurrenceRule = z
  .union([z.nativeEnum(TaskRecurrenceRule), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value ? value : null;
  });

function coerceTaskLabels(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  return value;
}

const optionalTaskLabels = z
  .preprocess(
    coerceTaskLabels,
    z.array(z.string().trim().min(1).max(40, "Task labels must be 40 characters or less.")).max(12, "Use 12 labels or fewer."),
  )
  .optional()
  .transform((value) => value?.map((label) => label.trim()).filter(Boolean));

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
    scheduledFor: optionalDateString,
    dueOn: optionalDateString,
    deadlineOn: optionalDateString,
    durationMinutes: optionalIntegerString.refine(
      (value) => value === undefined || value <= 10080,
      "Use 10,080 minutes or fewer.",
    ),
    recurrenceRule: optionalRecurrenceRule,
    sortOrder: optionalSortOrder,
    projectId: optionalString,
    sectionId: optionalString,
    parentTaskId: optionalString,
    labels: optionalTaskLabels,
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
  scheduledFor: nullableOptionalDateString,
  dueOn: nullableOptionalDateString,
  deadlineOn: nullableOptionalDateString,
  durationMinutes: nullableOptionalIntegerString.refine(
    (value) => value === undefined || value === null || value <= 10080,
    "Use 10,080 minutes or fewer.",
  ),
  recurrenceRule: nullableOptionalRecurrenceRule,
  sortOrder: nullableOptionalSortOrder,
  projectId: nullableOptionalString,
  sectionId: nullableOptionalString,
  parentTaskId: nullableOptionalString,
  labels: optionalTaskLabels,
  blockedReason: nullableOptionalString,
});

export const taskListFilterSchema = z.object({
  view: z.enum(taskViewValues).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  recurrenceRule: optionalRecurrenceRule,
  recurring: optionalBooleanString,
  projectId: optionalString,
  sectionId: optionalString,
  parentTaskId: optionalString,
  label: optionalString,
  labelId: optionalString,
  sourceType: optionalSourceType,
  sourceKey: optionalSourceKey,
  includeArchived: optionalBooleanString,
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createTaskCommentInputSchema = z.object({
  bodyMarkdown: z.string().trim().min(1, "Enter a comment.").max(10_000, "Comment is too long."),
});

export function parseTaskDate(value?: string) {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T12:00:00.000Z`);
}

export function parseDueOn(value?: string) {
  return parseTaskDate(value);
}
