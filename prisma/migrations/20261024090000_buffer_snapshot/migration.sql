-- CreateTable
CREATE TABLE "BufferSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "board" JSONB NOT NULL,
    "investments" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BufferSnapshot_pkey" PRIMARY KEY ("id")
);
