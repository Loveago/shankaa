-- AlterTable: Add webhook fields to UserApiKey
ALTER TABLE "UserApiKey" ADD COLUMN "webhookUrl" VARCHAR(2048);
ALTER TABLE "UserApiKey" ADD COLUMN "webhookEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add userApiKeyId to Order
ALTER TABLE "Order" ADD COLUMN "userApiKeyId" INTEGER;

-- CreateIndex
CREATE INDEX "Order_userApiKeyId_idx" ON "Order"("userApiKeyId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userApiKeyId_fkey" FOREIGN KEY ("userApiKeyId") REFERENCES "UserApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
