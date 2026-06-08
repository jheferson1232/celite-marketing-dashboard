-- CreateTable
CREATE TABLE "MetaCommentPageConfig" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "replyMode" TEXT NOT NULL DEFAULT 'professional',
    "replyTemplate" TEXT,
    "websiteUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaCommentPageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaCommentPageConfig_pageId_key" ON "MetaCommentPageConfig"("pageId");

-- CreateIndex
CREATE INDEX "MetaCommentPageConfig_enabled_idx" ON "MetaCommentPageConfig"("enabled");
