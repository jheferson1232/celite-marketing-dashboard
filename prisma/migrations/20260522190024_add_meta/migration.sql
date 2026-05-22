-- CreateTable
CREATE TABLE "TelegramSession" (
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'meta',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSession_pkey" PRIMARY KEY ("telegramUserId")
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

-- AddForeignKey
ALTER TABLE "TelegramSession" ADD CONSTRAINT "TelegramSession_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaOperativeDay" ADD CONSTRAINT "MetaOperativeDay_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "MetaTrackEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
