-- Cola de campañas a activar a las 6:00 America/Lima.
ALTER TABLE "TikTokAgentSettings"
  ADD COLUMN IF NOT EXISTS "pendingActivateCampaignIds" TEXT NOT NULL DEFAULT '[]';
