-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'ready', 'running', 'archived');

-- AlterTable
ALTER TABLE "TikTokProduct" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'draft';

-- CreateIndex
CREATE INDEX "TikTokProduct_status_idx" ON "TikTokProduct"("status");
