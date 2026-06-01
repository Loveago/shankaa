-- Add Skanka5 fields to OrderItem for API integration
ALTER TABLE "OrderItem" ADD COLUMN "skanka5Ref" VARCHAR(255);
ALTER TABLE "OrderItem" ADD COLUMN "skanka5OrderCode" VARCHAR(255);
ALTER TABLE "OrderItem" ADD COLUMN "skanka5Status" VARCHAR(100);
