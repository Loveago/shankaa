-- CreateTable
CREATE TABLE "AfaRegistration" (
    "id" SERIAL NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "occupation" VARCHAR(255),
    "idType" VARCHAR(50) NOT NULL,
    "idNumber" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AfaRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AfaRegistration_status_idx" ON "AfaRegistration"("status");

-- CreateIndex
CREATE INDEX "AfaRegistration_phoneNumber_idx" ON "AfaRegistration"("phoneNumber");
