-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'ready', 'running', 'archived');

-- CreateEnum
CREATE TYPE "CreativeType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'ready', 'running', 'archived');

-- CreateEnum
CREATE TYPE "CampaignStrategy" AS ENUM ('ABO');

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramSession" (
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'meta',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSession_pkey" PRIMARY KEY ("telegramUserId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaTrackEntity" (
    "id" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignMetaId" TEXT,
    "objective" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaTrackEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaOperativeDay" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "intentActive" BOOLEAN NOT NULL DEFAULT false,
    "metaWasActive" BOOLEAN NOT NULL DEFAULT false,
    "sold" BOOLEAN NOT NULL DEFAULT false,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points" INTEGER,
    "estadoKind" TEXT NOT NULL DEFAULT 'neutral',
    "estadoLabel" TEXT NOT NULL DEFAULT '—',
    "notifyOlvido" BOOLEAN NOT NULL DEFAULT false,
    "rowHighlight" TEXT NOT NULL DEFAULT 'none',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaOperativeDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaInformeAccountDay" (
    "date" TEXT NOT NULL,
    "accountSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accountPurchases" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaInformeAccountDay_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "CreativeType" NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingUrlCatalog" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingUrlCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "strategy" "CampaignStrategy" NOT NULL,
    "config" JSONB NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokProductCampaign" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'tiktok',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokProductCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CreativeToProductVariant" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CreativeToProductVariant_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_LandingPageToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LandingPageToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSession_chatId_key" ON "TelegramSession"("chatId");

-- CreateIndex
CREATE INDEX "MetaTrackEntity_type_campaignMetaId_idx" ON "MetaTrackEntity"("type", "campaignMetaId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaTrackEntity_metaId_type_key" ON "MetaTrackEntity"("metaId", "type");

-- CreateIndex
CREATE INDEX "MetaOperativeDay_date_idx" ON "MetaOperativeDay"("date");

-- CreateIndex
CREATE INDEX "MetaOperativeDay_entityId_date_idx" ON "MetaOperativeDay"("entityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetaOperativeDay_date_entityId_key" ON "MetaOperativeDay"("date", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Creative_url_key" ON "Creative"("url");

-- CreateIndex
CREATE INDEX "Creative_type_idx" ON "Creative"("type");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_url_key" ON "LandingPage"("url");

-- CreateIndex
CREATE INDEX "TikTokProduct_status_idx" ON "TikTokProduct"("status");

-- CreateIndex
CREATE INDEX "TikTokProductVariant_productId_idx" ON "TikTokProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingUrlCatalog_url_key" ON "LandingUrlCatalog"("url");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_productId_idx" ON "Campaign"("productId");

-- CreateIndex
CREATE INDEX "TikTokProductCampaign_productId_idx" ON "TikTokProductCampaign"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokProductCampaign_productId_campaignId_platform_key" ON "TikTokProductCampaign"("productId", "campaignId", "platform");

-- CreateIndex
CREATE INDEX "_CreativeToProductVariant_B_index" ON "_CreativeToProductVariant"("B");

-- CreateIndex
CREATE INDEX "_LandingPageToProduct_B_index" ON "_LandingPageToProduct"("B");

-- AddForeignKey
ALTER TABLE "TelegramSession" ADD CONSTRAINT "TelegramSession_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaOperativeDay" ADD CONSTRAINT "MetaOperativeDay_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "MetaTrackEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokProductVariant" ADD CONSTRAINT "TikTokProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TikTokProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TikTokProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokProductCampaign" ADD CONSTRAINT "TikTokProductCampaign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TikTokProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CreativeToProductVariant" ADD CONSTRAINT "_CreativeToProductVariant_A_fkey" FOREIGN KEY ("A") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CreativeToProductVariant" ADD CONSTRAINT "_CreativeToProductVariant_B_fkey" FOREIGN KEY ("B") REFERENCES "TikTokProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LandingPageToProduct" ADD CONSTRAINT "_LandingPageToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LandingPageToProduct" ADD CONSTRAINT "_LandingPageToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "TikTokProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
