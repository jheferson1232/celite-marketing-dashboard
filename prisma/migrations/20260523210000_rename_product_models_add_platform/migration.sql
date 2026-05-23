-- AlterTable: add platform column
ALTER TABLE "TikTokProductCampaign" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'tiktok';

-- DropIndex
DROP INDEX IF EXISTS "TikTokProductCampaign_productId_campaignId_key";

-- CreateIndex
CREATE UNIQUE INDEX "TikTokProductCampaign_productId_campaignId_platform_key" ON "TikTokProductCampaign"("productId", "campaignId", "platform");
