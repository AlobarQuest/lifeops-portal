CREATE TABLE "TaskSection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task"
ADD COLUMN "sectionId" TEXT;

CREATE UNIQUE INDEX "TaskSection_projectId_name_key" ON "TaskSection"("projectId", "name");
CREATE INDEX "TaskSection_projectId_sortOrder_idx" ON "TaskSection"("projectId", "sortOrder");
CREATE INDEX "TaskSection_archivedAt_idx" ON "TaskSection"("archivedAt");
CREATE INDEX "Task_sectionId_idx" ON "Task"("sectionId");

ALTER TABLE "TaskSection"
ADD CONSTRAINT "TaskSection_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "TaskSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
