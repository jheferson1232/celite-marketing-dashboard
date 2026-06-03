-- CreateTable
CREATE TABLE "TikTokAgentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "adsetPauseSpendPen" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "campaignPauseSpendPen" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "adsetCpaCriticoPen" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "telegramNotify" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokAgentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokAgentRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "accountsScanned" INTEGER NOT NULL DEFAULT 1,
    "campaignsScanned" INTEGER NOT NULL DEFAULT 0,
    "adgroupsScanned" INTEGER NOT NULL DEFAULT 0,
    "actionsCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "errorMessage" TEXT,
    "actions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "TikTokAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TikTokAgentRun_startedAt_idx" ON "TikTokAgentRun"("startedAt");
