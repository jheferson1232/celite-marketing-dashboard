-- CreateTable
CREATE TABLE "TikTokProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "imageUrl" TEXT,
    "url" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokProductCampaign" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokProductCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TikTokProductVariant_productId_idx" ON "TikTokProductVariant"("productId");

-- CreateIndex
CREATE INDEX "TikTokProductCampaign_productId_idx" ON "TikTokProductCampaign"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokProductCampaign_productId_campaignId_key" ON "TikTokProductCampaign"("productId", "campaignId");

-- AddForeignKey
ALTER TABLE "TikTokProductVariant" ADD CONSTRAINT "TikTokProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TikTokProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokProductCampaign" ADD CONSTRAINT "TikTokProductCampaign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TikTokProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
