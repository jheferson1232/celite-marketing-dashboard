-- CreateTable
CREATE TABLE "MetaLibraryEntry" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "facebookPage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaLibraryEntry_updatedAt_idx" ON "MetaLibraryEntry"("updatedAt");
