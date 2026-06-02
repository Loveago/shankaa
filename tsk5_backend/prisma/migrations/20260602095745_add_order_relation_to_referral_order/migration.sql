-- AlterTable: Add unique constraint to orderId on ReferralOrder
ALTER TABLE "ReferralOrder" 
ALTER COLUMN "orderId" DROP NOT NULL,
ADD CONSTRAINT "ReferralOrder_orderId_key" UNIQUE ("orderId");

-- Create foreign key constraint for ReferralOrder.orderId -> Order.id
ALTER TABLE "ReferralOrder"
ADD CONSTRAINT "ReferralOrder_orderId_fkey" 
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL;
