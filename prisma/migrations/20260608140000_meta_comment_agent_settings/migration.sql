-- CreateTable
CREATE TABLE "MetaCommentAgentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "country" TEXT NOT NULL DEFAULT 'CO',
    "contactInfo" TEXT,
    "shippingTime" TEXT,
    "businessInfo" TEXT,
    "deleteNegativeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deletePrompt" TEXT,
    "deleteExamplesRemove" TEXT,
    "deleteExamplesKeep" TEXT,
    "publicReplyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publicReplyPrompt" TEXT,
    "publicReplyIncludeLink" BOOLEAN NOT NULL DEFAULT true,
    "publicReplyIncludePrice" BOOLEAN NOT NULL DEFAULT true,
    "dmReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dmReplyPrompt" TEXT,
    "dmDataToCollect" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaCommentAgentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaCommentProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaCommentProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaCommentProduct_active_idx" ON "MetaCommentProduct"("active");
