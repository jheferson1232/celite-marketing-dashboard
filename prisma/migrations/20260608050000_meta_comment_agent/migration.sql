-- CreateTable
CREATE TABLE "MetaCommentAgentRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "pagesScanned" INTEGER NOT NULL DEFAULT 0,
    "postsScanned" INTEGER NOT NULL DEFAULT 0,
    "commentsSeen" INTEGER NOT NULL DEFAULT 0,
    "actionsCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "MetaCommentAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaCommentDecision" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "metaCommentId" TEXT NOT NULL,
    "postStoryId" TEXT,
    "adId" TEXT,
    "pageId" TEXT,
    "authorName" TEXT,
    "message" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "replyText" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaCommentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaCommentAgentRun_startedAt_idx" ON "MetaCommentAgentRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetaCommentDecision_metaCommentId_key" ON "MetaCommentDecision"("metaCommentId");

-- CreateIndex
CREATE INDEX "MetaCommentDecision_createdAt_idx" ON "MetaCommentDecision"("createdAt");

-- CreateIndex
CREATE INDEX "MetaCommentDecision_runId_idx" ON "MetaCommentDecision"("runId");
