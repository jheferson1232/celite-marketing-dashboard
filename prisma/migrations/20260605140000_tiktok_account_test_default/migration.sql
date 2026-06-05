-- AlterTable
ALTER TABLE "TikTokAdAccount" ADD COLUMN "isDefaultForTests" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TikTokAdAccount_status_isDefaultForTests_idx" ON "TikTokAdAccount"("status", "isDefaultForTests");
