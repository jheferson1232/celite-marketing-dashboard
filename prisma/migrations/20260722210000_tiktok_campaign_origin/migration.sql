CREATE TABLE IF NOT EXISTS "TikTokCampaignOrigin" (
    "campaignId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokCampaignOrigin_pkey" PRIMARY KEY ("campaignId")
);

CREATE INDEX IF NOT EXISTS "TikTokCampaignOrigin_origin_idx" ON "TikTokCampaignOrigin"("origin");
