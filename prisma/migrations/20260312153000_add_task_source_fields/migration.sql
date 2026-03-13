ALTER TABLE "Task"
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceKey" TEXT;

CREATE INDEX "Task_sourceType_idx" ON "Task"("sourceType");

CREATE INDEX "Task_ownerId_sourceType_idx" ON "Task"("ownerId", "sourceType");

CREATE UNIQUE INDEX "Task_ownerId_sourceType_sourceKey_key"
ON "Task"("ownerId", "sourceType", "sourceKey");
