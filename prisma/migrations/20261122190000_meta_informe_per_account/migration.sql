-- Informe IA por cuenta Meta.
-- Las filas existentes eran de la cuenta de META_AD_ACCOUNT_ID (Cuenta 11).
ALTER TABLE "MetaTrackEntity" ADD COLUMN "accountId" TEXT NOT NULL DEFAULT '';
UPDATE "MetaTrackEntity" SET "accountId" = '1682130105855238';
CREATE INDEX "MetaTrackEntity_accountId_idx" ON "MetaTrackEntity"("accountId");

ALTER TABLE "MetaInformeAccountDay" ADD COLUMN "accountId" TEXT NOT NULL DEFAULT '';
UPDATE "MetaInformeAccountDay" SET "accountId" = '1682130105855238';
ALTER TABLE "MetaInformeAccountDay" DROP CONSTRAINT "MetaInformeAccountDay_pkey";
ALTER TABLE "MetaInformeAccountDay" ADD CONSTRAINT "MetaInformeAccountDay_pkey" PRIMARY KEY ("accountId", "date");

CREATE TABLE "MetaInformeAccountSettings" (
    "accountId" TEXT NOT NULL,
    "cpaTarget" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaInformeAccountSettings_pkey" PRIMARY KEY ("accountId")
);

INSERT INTO "MetaInformeAccountSettings" ("accountId", "cpaTarget", "updatedAt") VALUES
    ('870267208104445', 12000, CURRENT_TIMESTAMP),
    ('428704200222227', 25, CURRENT_TIMESTAMP)
ON CONFLICT ("accountId") DO NOTHING;
