-- AlterTable
ALTER TABLE "TikTokCampaignLaunchSource" ADD COLUMN IF NOT EXISTS "launchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: keep previous updatedAt as launchedAt for existing rows
UPDATE "TikTokCampaignLaunchSource" SET "launchedAt" = "updatedAt" WHERE "launchedAt" IS DISTINCT FROM "updatedAt";
