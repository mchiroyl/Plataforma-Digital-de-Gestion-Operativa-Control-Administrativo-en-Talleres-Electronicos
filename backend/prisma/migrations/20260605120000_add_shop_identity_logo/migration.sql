ALTER TABLE "ShopSettings" ADD COLUMN "logoData" BYTEA;
ALTER TABLE "ShopSettings" ADD COLUMN "logoMimeType" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "logoFileName" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);
ALTER TABLE "ShopSettings" ADD COLUMN "ticketFormat" TEXT NOT NULL DEFAULT 'LETTER';
