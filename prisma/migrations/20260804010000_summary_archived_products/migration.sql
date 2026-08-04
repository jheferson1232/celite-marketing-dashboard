CREATE TABLE IF NOT EXISTS "SummaryDashboardSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "archivedProducts" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummaryDashboardSettings_pkey" PRIMARY KEY ("id")
);
