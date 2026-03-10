-- CreateEnum
CREATE TYPE "ProjectDocumentType" AS ENUM (
    'PROJECT_CHARTER',
    'PRODUCT_BRIEF',
    'SCOPE_BACKLOG',
    'REQUIREMENTS_USER_STORIES',
    'ARCHITECTURE_OVERVIEW',
    'DATA_MODEL',
    'DECISION_LOG',
    'TASK_BOARD',
    'TEST_CHECKLIST',
    'DEPLOYMENT_NOTES',
    'AI_COLLABORATION_RULES',
    'PROJECT_CONTEXT_PACK'
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ProjectDocumentType" NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocument_projectId_type_key" ON "ProjectDocument"("projectId", "type");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_updatedAt_idx" ON "ProjectDocument"("projectId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ProjectDocument"
ADD CONSTRAINT "ProjectDocument_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
