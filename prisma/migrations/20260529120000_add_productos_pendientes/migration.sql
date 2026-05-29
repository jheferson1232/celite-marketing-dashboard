-- CreateTable
CREATE TABLE "PendingSyncRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "imported" INTEGER NOT NULL DEFAULT 0,
    "searched" INTEGER NOT NULL DEFAULT 0,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "noMatch" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "PendingSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DropiFavoriteProduct" (
    "id" TEXT NOT NULL,
    "dropiId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "imageUrl" TEXT,
    "imageUrls" JSONB NOT NULL DEFAULT '[]',
    "sku" TEXT,
    "price" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'IMPORTED',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DropiFavoriteProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPendingMatch" (
    "id" TEXT NOT NULL,
    "favoriteId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT,
    "pageName" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "previewUrl" TEXT,
    "landingUrl" TEXT,
    "payload" JSONB NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPendingMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingSyncRun_startedAt_idx" ON "PendingSyncRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DropiFavoriteProduct_dropiId_key" ON "DropiFavoriteProduct"("dropiId");

-- CreateIndex
CREATE INDEX "DropiFavoriteProduct_status_idx" ON "DropiFavoriteProduct"("status");

-- CreateIndex
CREATE INDEX "DropiFavoriteProduct_updatedAt_idx" ON "DropiFavoriteProduct"("updatedAt");

-- CreateIndex
CREATE INDEX "ProductPendingMatch_favoriteId_idx" ON "ProductPendingMatch"("favoriteId");

-- CreateIndex
CREATE INDEX "ProductPendingMatch_favoriteId_isFavorite_idx" ON "ProductPendingMatch"("favoriteId", "isFavorite");

-- CreateIndex
CREATE INDEX "ProductPendingMatch_score_idx" ON "ProductPendingMatch"("score");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPendingMatch_favoriteId_matchType_externalId_key" ON "ProductPendingMatch"("favoriteId", "matchType", "externalId");

-- AddForeignKey
ALTER TABLE "ProductPendingMatch" ADD CONSTRAINT "ProductPendingMatch_favoriteId_fkey" FOREIGN KEY ("favoriteId") REFERENCES "DropiFavoriteProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
