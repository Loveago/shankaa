-- AlterTable - Add payment fields to AfaRegistration
ALTER TABLE "AfaRegistration" ADD COLUMN "paymentRef" VARCHAR(255);
ALTER TABLE "AfaRegistration" ADD COLUMN "paymentStatus" VARCHAR(20) DEFAULT 'unpaid';

-- CreateIndex
CREATE INDEX "AfaRegistration_paymentRef_idx" ON "AfaRegistration"("paymentRef");
