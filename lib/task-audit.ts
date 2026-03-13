import {
  Prisma,
  TaskAuditAction,
  TaskAuditAuthType,
} from "@prisma/client";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import type { ApiAccessContext } from "@/lib/current-user";
import {
  serializeTask,
  type TaskListItem,
} from "@/lib/tasks";

type TaskAuditDbClient = Prisma.TransactionClient | typeof prisma;
type TaskAuditRequestBody = Record<string, unknown>;

function normalizeJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getRequestSourceValue(body: TaskAuditRequestBody | null | undefined, keys: string[]) {
  if (!body) {
    return undefined;
  }

  for (const key of keys) {
    const value = body[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function resolveAuditAuthType(authMethod: ApiAccessContext["authMethod"]) {
  return authMethod === "internal_token"
    ? TaskAuditAuthType.INTERNAL_TOKEN
    : TaskAuditAuthType.SESSION;
}

function getRequestClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  if (firstForwardedIp) {
    return firstForwardedIp;
  }

  return request.headers.get("x-real-ip")?.trim() ?? null;
}

export async function createTaskAuditEvent({
  action,
  accessContext,
  db = prisma,
  ownerId,
  request,
  requestBody,
  task,
}: {
  action: TaskAuditAction;
  accessContext: ApiAccessContext;
  db?: TaskAuditDbClient;
  ownerId: string;
  request: NextRequest;
  requestBody?: TaskAuditRequestBody | null;
  task: TaskListItem;
}) {
  if (!accessContext.user || !accessContext.authMethod) {
    return null;
  }

  return db.taskAuditEvent.create({
    data: {
      taskId: task.id,
      ownerId,
      action,
      authType: resolveAuditAuthType(accessContext.authMethod),
      actorEmail: accessContext.actorEmail ?? accessContext.user.email,
      requestMethod: request.method,
      requestPath: request.nextUrl.pathname,
      sourceType:
        task.sourceType ??
        getRequestSourceValue(requestBody, ["sourceType", "source_type", "externalSource", "external_source"]) ??
        null,
      sourceKey:
        task.sourceKey ??
        getRequestSourceValue(requestBody, ["sourceKey", "source_key", "externalKey", "external_key"]) ??
        null,
      clientIp: getRequestClientIp(request),
      userAgent: request.headers.get("user-agent"),
      requestPayloadJson: normalizeJsonValue(requestBody ?? null),
      taskSnapshotJson: normalizeJsonValue(serializeTask(task)),
    },
  });
}
