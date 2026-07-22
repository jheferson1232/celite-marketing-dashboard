CREATE TABLE IF NOT EXISTS "TikTokDashboardSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "archivedCampaigns" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokDashboardSettings_pkey" PRIMARY KEY ("id")
);
