-- CreateTable
CREATE TABLE "StorePending" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "pageUrl" TEXT,
    "country" TEXT NOT NULL DEFAULT 'ALL',
    "metaPageId" TEXT,
    "logoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IMPORTED',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePendingSnapshot" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "activeAds" INTEGER NOT NULL DEFAULT 0,
    "totalAds" INTEGER NOT NULL DEFAULT 0,
    "creativesSaved" INTEGER NOT NULL DEFAULT 0,
    "topCountries" JSONB NOT NULL DEFAULT '[]',
    "searchQuery" TEXT,
    "metaPageId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorePendingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePendingCreative" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "externalId" TEXT,
    "title" TEXT,
    "pageName" TEXT,
    "previewUrl" TEXT,
    "landingUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mediaType" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorePendingCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePendingSyncRun" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "adsFound" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "StorePendingSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorePending_status_idx" ON "StorePending"("status");

-- CreateIndex
CREATE INDEX "StorePending_updatedAt_idx" ON "StorePending"("updatedAt");

-- CreateIndex
CREATE INDEX "StorePendingSnapshot_storeId_idx" ON "StorePendingSnapshot"("storeId");

-- CreateIndex
CREATE INDEX "StorePendingSnapshot_createdAt_idx" ON "StorePendingSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "StorePendingCreative_storeId_idx" ON "StorePendingCreative"("storeId");

-- CreateIndex
CREATE INDEX "StorePendingCreative_snapshotId_idx" ON "StorePendingCreative"("snapshotId");

-- CreateIndex
CREATE INDEX "StorePendingCreative_isActive_idx" ON "StorePendingCreative"("isActive");

-- CreateIndex
CREATE INDEX "StorePendingCreative_score_idx" ON "StorePendingCreative"("score");

-- CreateIndex
CREATE UNIQUE INDEX "StorePendingCreative_storeId_externalId_key" ON "StorePendingCreative"("storeId", "externalId");

-- CreateIndex
CREATE INDEX "StorePendingSyncRun_storeId_idx" ON "StorePendingSyncRun"("storeId");

-- CreateIndex
CREATE INDEX "StorePendingSyncRun_startedAt_idx" ON "StorePendingSyncRun"("startedAt");

-- AddForeignKey
ALTER TABLE "StorePendingSnapshot" ADD CONSTRAINT "StorePendingSnapshot_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "StorePending"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePendingCreative" ADD CONSTRAINT "StorePendingCreative_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "StorePending"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePendingCreative" ADD CONSTRAINT "StorePendingCreative_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StorePendingSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePendingSyncRun" ADD CONSTRAINT "StorePendingSyncRun_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "StorePending"("id") ON DELETE CASCADE ON UPDATE CASCADE;
