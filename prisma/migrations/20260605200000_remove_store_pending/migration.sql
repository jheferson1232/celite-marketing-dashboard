-- DropForeignKey
ALTER TABLE "StorePendingSyncRun" DROP CONSTRAINT IF EXISTS "StorePendingSyncRun_storeId_fkey";

-- DropForeignKey
ALTER TABLE "StorePendingCreative" DROP CONSTRAINT IF EXISTS "StorePendingCreative_snapshotId_fkey";

-- DropForeignKey
ALTER TABLE "StorePendingCreative" DROP CONSTRAINT IF EXISTS "StorePendingCreative_storeId_fkey";

-- DropForeignKey
ALTER TABLE "StorePendingSnapshot" DROP CONSTRAINT IF EXISTS "StorePendingSnapshot_storeId_fkey";

-- DropTable
DROP TABLE IF EXISTS "StorePendingSyncRun";

-- DropTable
DROP TABLE IF EXISTS "StorePendingCreative";

-- DropTable
DROP TABLE IF EXISTS "StorePendingSnapshot";

-- DropTable
DROP TABLE IF EXISTS "StorePending";
