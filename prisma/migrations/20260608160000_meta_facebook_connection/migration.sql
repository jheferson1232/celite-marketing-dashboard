-- CreateTable
CREATE TABLE "MetaFacebookConnection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageCategory" TEXT,
    "accessToken" TEXT NOT NULL,
    "tokenExpires" TIMESTAMP(3),
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaFacebookConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaFacebookConnection_pageId_key" ON "MetaFacebookConnection"("pageId");

-- CreateIndex
CREATE INDEX "MetaFacebookConnection_connected_idx" ON "MetaFacebookConnection"("connected");
