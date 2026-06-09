-- Persist SociaVault scrape per entry (evita re-gastar créditos al reabrir).
ALTER TABLE "MetaLibraryEntry" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "MetaLibraryEntry" ADD COLUMN "syncWarning" TEXT;
ALTER TABLE "MetaLibraryEntry" ADD COLUMN "activeCount" INTEGER;
ALTER TABLE "MetaLibraryEntry" ADD COLUMN "totalCount" INTEGER;
ALTER TABLE "MetaLibraryEntry" ADD COLUMN "companyData" JSONB;
ALTER TABLE "MetaLibraryEntry" ADD COLUMN "adsData" JSONB;
ALTER TABLE "MetaLibraryEntry" ADD COLUMN "previewSlidesData" JSONB;

CREATE INDEX "MetaLibraryEntry_lastSyncedAt_idx" ON "MetaLibraryEntry"("lastSyncedAt");
