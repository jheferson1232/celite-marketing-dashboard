-- CreateTable
CREATE TABLE "TikTokAdAccount" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "identityId" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "country" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokAdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TikTokAdAccount_advertiserId_key" ON "TikTokAdAccount"("advertiserId");

-- CreateIndex
CREATE INDEX "TikTokAdAccount_status_isDefault_idx" ON "TikTokAdAccount"("status", "isDefault");
