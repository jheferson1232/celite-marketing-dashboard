-- Campañas archivadas del dashboard Meta (JSON array).
CREATE TABLE IF NOT EXISTS "MetaDashboardSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "archivedCampaigns" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaDashboardSettings_pkey" PRIMARY KEY ("id")
);
