-- Статусы доставки/прочтения
ALTER TABLE "messages" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'delivered';
ALTER TABLE "messages" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "messages" SET "status" = 'delivered' WHERE "status" = '';
