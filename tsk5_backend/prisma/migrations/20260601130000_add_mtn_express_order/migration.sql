-- CreateTable
CREATE TABLE "MtnExpressOrder" (
    "id" SERIAL NOT NULL,
    "receiptNumber" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "bundleSize" VARCHAR(20) NOT NULL DEFAULT '214GB',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MtnExpressOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MtnExpressOrder_status_idx" ON "MtnExpressOrder"("status");

-- CreateIndex
CREATE INDEX "MtnExpressOrder_phoneNumber_idx" ON "MtnExpressOrder"("phoneNumber");
