-- Automatizaciones TikTok Agente: activación 6:00 y escalado del mejor resultado.
ALTER TABLE "TikTokAgentSettings"
  ADD COLUMN IF NOT EXISTS "activateAt6amEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scaleBestEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scaleBestBudgetIncreasePercent" DOUBLE PRECISION NOT NULL DEFAULT 20;
