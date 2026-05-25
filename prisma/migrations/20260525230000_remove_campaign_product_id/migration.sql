-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_productId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Campaign_productId_idx";

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN IF EXISTS "productId";
