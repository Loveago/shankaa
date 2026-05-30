-- Add orderItemId and refund fields to Complaint model
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "orderItemId" INTEGER;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "refundStatus" VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP;

-- Create an index on orderItemId for faster lookups
CREATE INDEX IF NOT EXISTS "Complaint_orderItemId_idx" ON "Complaint"("orderItemId");
