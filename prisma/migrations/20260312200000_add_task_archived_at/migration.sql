ALTER TABLE "Task"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Task_archivedAt_idx" ON "Task"("archivedAt");
