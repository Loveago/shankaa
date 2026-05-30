-- DropIndex
DROP INDEX "Complaint_orderItemId_idx";

-- AlterTable
ALTER TABLE "Complaint" ALTER COLUMN "refundStatus" SET DATA TYPE TEXT,
ALTER COLUMN "refundedAt" SET DATA TYPE TIMESTAMP(3);
