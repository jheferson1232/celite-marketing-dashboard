CREATE TABLE IF NOT EXISTS "TikTokCampaignLaunchSource" (
    "campaignId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokCampaignLaunchSource_pkey" PRIMARY KEY ("campaignId")
);

CREATE INDEX IF NOT EXISTS "TikTokCampaignLaunchSource_source_idx" ON "TikTokCampaignLaunchSource"("source");
