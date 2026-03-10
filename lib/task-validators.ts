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

export const taskViewValues = [
  "all",
  "inbox",
  "today",
  "overdue",
  "blocked",
  "completed",
] as const;

export type TaskView = (typeof taskViewValues)[number];

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title."),
  description: optionalString,
  priority: z.nativeEnum(PriorityLevel).default(PriorityLevel.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.INBOX),
  dueOn: optionalDateString,
  projectId: optionalString,
});

export const updateTaskInputSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: optionalString,
  priority: z.nativeEnum(PriorityLevel).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueOn: optionalDateString,
  projectId: optionalString,
  blockedReason: optionalString,
});

export const taskListFilterSchema = z.object({
  view: z.enum(taskViewValues).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  projectId: optionalString,
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export function parseDueOn(value?: string) {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T12:00:00.000Z`);
}
