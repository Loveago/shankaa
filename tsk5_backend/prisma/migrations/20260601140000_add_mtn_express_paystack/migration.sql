-- AlterTable: make receiptNumber optional, add paymentRef and email
ALTER TABLE "MtnExpressOrder" 
  ALTER COLUMN "receiptNumber" DROP NOT NULL,
  ADD COLUMN "paymentRef" VARCHAR(255),
  ADD COLUMN "email" VARCHAR(255);

-- CreateIndex for paymentRef
CREATE UNIQUE INDEX "MtnExpressOrder_paymentRef_key" ON "MtnExpressOrder"("paymentRef");
CREATE INDEX "MtnExpressOrder_paymentRef_idx" ON "MtnExpressOrder"("paymentRef");
