CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TaskComment"
ADD CONSTRAINT "TaskComment_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "TaskComment"
ADD CONSTRAINT "TaskComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");
CREATE INDEX "TaskComment_authorId_createdAt_idx" ON "TaskComment"("authorId", "createdAt");
