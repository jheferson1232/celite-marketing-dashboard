CREATE TABLE IF NOT EXISTS "MetaCampaignOrigin" (
    "campaignId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaCampaignOrigin_pkey" PRIMARY KEY ("campaignId")
);

CREATE INDEX IF NOT EXISTS "MetaCampaignOrigin_origin_idx" ON "MetaCampaignOrigin"("origin");
