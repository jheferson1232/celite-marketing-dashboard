-- CreateTable
CREATE TABLE "TikTokCommentAgentRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "adsScanned" INTEGER NOT NULL DEFAULT 0,
    "commentsSeen" INTEGER NOT NULL DEFAULT 0,
    "actionsCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "TikTokCommentAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokCommentDecision" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "tiktokCommentId" TEXT NOT NULL,
    "adId" TEXT,
    "tiktokItemId" TEXT,
    "identityId" TEXT,
    "identityType" TEXT,
    "authorName" TEXT,
    "message" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "replyText" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokCommentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TikTokCommentAgentRun_startedAt_idx" ON "TikTokCommentAgentRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokCommentDecision_tiktokCommentId_key" ON "TikTokCommentDecision"("tiktokCommentId");

-- CreateIndex
CREATE INDEX "TikTokCommentDecision_createdAt_idx" ON "TikTokCommentDecision"("createdAt");

-- CreateIndex
CREATE INDEX "TikTokCommentDecision_runId_idx" ON "TikTokCommentDecision"("runId");
