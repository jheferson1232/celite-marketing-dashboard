-- Si ya aplicaste la migración con umbrales en COP, convierte columnas a soles (PEN).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'TikTokAgentSettings' AND column_name = 'adsetPauseSpendCop'
  ) THEN
    ALTER TABLE "TikTokAgentSettings" RENAME COLUMN "adsetPauseSpendCop" TO "adsetPauseSpendPen";
    ALTER TABLE "TikTokAgentSettings" RENAME COLUMN "campaignPauseSpendCop" TO "campaignPauseSpendPen";
    ALTER TABLE "TikTokAgentSettings" RENAME COLUMN "adsetCpaCriticoCop" TO "adsetCpaCriticoPen";
    ALTER TABLE "TikTokAgentSettings"
      ALTER COLUMN "adsetPauseSpendPen" TYPE DOUBLE PRECISION USING ("adsetPauseSpendPen"::float / 1050.0),
      ALTER COLUMN "campaignPauseSpendPen" TYPE DOUBLE PRECISION USING ("campaignPauseSpendPen"::float / 1050.0),
      ALTER COLUMN "adsetCpaCriticoPen" TYPE DOUBLE PRECISION USING ("adsetCpaCriticoPen"::float / 1050.0);
    ALTER TABLE "TikTokAgentSettings" ALTER COLUMN "adsetPauseSpendPen" SET DEFAULT 10;
    ALTER TABLE "TikTokAgentSettings" ALTER COLUMN "campaignPauseSpendPen" SET DEFAULT 30;
    ALTER TABLE "TikTokAgentSettings" ALTER COLUMN "adsetCpaCriticoPen" SET DEFAULT 15;
  END IF;
END $$;
