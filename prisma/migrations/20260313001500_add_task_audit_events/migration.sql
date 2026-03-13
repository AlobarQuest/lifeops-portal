-- CreateEnum
CREATE TYPE "TaskAuditAction" AS ENUM ('CREATE', 'UPSERT_UPDATE', 'UPDATE', 'COMPLETE', 'REOPEN', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "TaskAuditAuthType" AS ENUM ('INTERNAL_TOKEN', 'SESSION');

-- CreateTable
CREATE TABLE "TaskAuditEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "ownerId" TEXT NOT NULL,
    "action" "TaskAuditAction" NOT NULL,
    "authType" "TaskAuditAuthType" NOT NULL,
    "actorEmail" TEXT,
    "requestMethod" TEXT NOT NULL,
    "requestPath" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceKey" TEXT,
    "clientIp" TEXT,
    "userAgent" TEXT,
    "requestPayloadJson" JSONB,
    "taskSnapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAuditEvent_taskId_createdAt_idx" ON "TaskAuditEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskAuditEvent_ownerId_createdAt_idx" ON "TaskAuditEvent"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskAuditEvent_sourceType_sourceKey_idx" ON "TaskAuditEvent"("sourceType", "sourceKey");

-- CreateIndex
CREATE INDEX "TaskAuditEvent_action_createdAt_idx" ON "TaskAuditEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskAuditEvent" ADD CONSTRAINT "TaskAuditEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAuditEvent" ADD CONSTRAINT "TaskAuditEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
