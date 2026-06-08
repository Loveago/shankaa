-- CreateTable
CREATE TABLE "UnpaidOrder" (
    "id" SERIAL NOT NULL,
    "externalRef" VARCHAR(255) NOT NULL,
    "productId" INTEGER,
    "productName" VARCHAR(255),
    "mobileNumber" VARCHAR(20) NOT NULL,
    "customerEmail" VARCHAR(255),
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'GHS',
    "paymentUrl" VARCHAR(512),
    "paystackRef" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "paymentStatus" VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
    "paymentAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "paymentTransactionId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "UnpaidOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnpaidOrder_externalRef_key" ON "UnpaidOrder"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "UnpaidOrder_paymentTransactionId_key" ON "UnpaidOrder"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "UnpaidOrder_status_idx" ON "UnpaidOrder"("status");

-- CreateIndex
CREATE INDEX "UnpaidOrder_paymentStatus_idx" ON "UnpaidOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "UnpaidOrder_externalRef_idx" ON "UnpaidOrder"("externalRef");

-- CreateIndex
CREATE INDEX "UnpaidOrder_mobileNumber_idx" ON "UnpaidOrder"("mobileNumber");

-- CreateIndex
CREATE INDEX "UnpaidOrder_expiresAt_idx" ON "UnpaidOrder"("expiresAt");

-- CreateIndex
CREATE INDEX "UnpaidOrder_createdAt_idx" ON "UnpaidOrder"("createdAt");

-- AddForeignKey
ALTER TABLE "UnpaidOrder"
ADD CONSTRAINT "UnpaidOrder_paymentTransactionId_fkey"
FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing payment transactions without linked orders into unpaid queue
INSERT INTO "UnpaidOrder" (
    "externalRef",
    "productId",
    "productName",
    "mobileNumber",
    "amount",
    "currency",
    "status",
    "paymentStatus",
    "paymentAttempts",
    "lastAttemptAt",
    "paymentTransactionId",
    "expiresAt",
    "createdAt",
    "updatedAt",
    "paidAt"
)
SELECT
    pt."externalRef",
    pt."productId",
    pt."productName",
    pt."mobileNumber",
    pt."amount",
    COALESCE(pt."currency", 'GHS'),
    CASE
        WHEN pt."status" = 'SUCCESS' THEN 'PAID'
        WHEN pt."status" = 'FAILED' THEN 'FAILED'
        ELSE 'PENDING'
    END,
    CASE
        WHEN pt."status" = 'SUCCESS' THEN 'PAID'
        WHEN pt."status" = 'FAILED' THEN 'FAILED'
        ELSE 'UNPAID'
    END,
    0,
    NULL,
    pt."id",
    CASE
        WHEN pt."createdAt" > (CURRENT_TIMESTAMP - INTERVAL '24 hours') THEN pt."createdAt" + INTERVAL '24 hours'
        ELSE CURRENT_TIMESTAMP + INTERVAL '1 hour'
    END,
    pt."createdAt",
    pt."updatedAt",
    CASE WHEN pt."status" = 'SUCCESS' THEN pt."updatedAt" ELSE NULL END
FROM "PaymentTransaction" pt
WHERE pt."orderId" IS NULL
  AND pt."externalRef" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "UnpaidOrder" uo
      WHERE uo."paymentTransactionId" = pt."id"
         OR uo."externalRef" = pt."externalRef"
  );
