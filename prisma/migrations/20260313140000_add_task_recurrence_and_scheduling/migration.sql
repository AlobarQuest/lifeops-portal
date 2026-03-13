CREATE TYPE "TaskRecurrenceRule" AS ENUM ('DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY');

ALTER TABLE "Task"
ADD COLUMN "recurrencePreviousTaskId" TEXT,
ADD COLUMN "scheduledFor" TIMESTAMP(3),
ADD COLUMN "deadlineAt" TIMESTAMP(3),
ADD COLUMN "durationMinutes" INTEGER,
ADD COLUMN "recurrenceRule" "TaskRecurrenceRule";

ALTER TABLE "Task"
ADD CONSTRAINT "Task_recurrencePreviousTaskId_fkey"
FOREIGN KEY ("recurrencePreviousTaskId") REFERENCES "Task"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "Task_recurrencePreviousTaskId_idx" ON "Task"("recurrencePreviousTaskId");
CREATE INDEX "Task_scheduledFor_idx" ON "Task"("scheduledFor");
CREATE INDEX "Task_deadlineAt_idx" ON "Task"("deadlineAt");
