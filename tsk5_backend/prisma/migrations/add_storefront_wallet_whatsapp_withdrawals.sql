-- Add storefront wallet balance column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "storefrontWallet" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add storefront WhatsApp number column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "storefrontWhatsapp" VARCHAR(20);

-- Create WithdrawalRequest table
CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
  "id" SERIAL NOT NULL,
  "agentId" INTEGER NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "mobileNumber" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
  "adminNotes" TEXT,
  "processedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WithdrawalRequest_agentId_idx" ON "WithdrawalRequest"("agentId");
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_status_idx" ON "WithdrawalRequest"("status");

ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
