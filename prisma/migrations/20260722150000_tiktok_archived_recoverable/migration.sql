-- Campañas archivadas de «Pausados con buen historial» (JSON array).
ALTER TABLE "TikTokAgentSettings"
  ADD COLUMN IF NOT EXISTS "archivedRecoverableCampaigns" TEXT NOT NULL DEFAULT '[]';
