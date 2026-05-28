-- CreateTable
CREATE TABLE "RolePrice" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RolePrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RolePrice_productId_idx" ON "RolePrice"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePrice_productId_role_key" ON "RolePrice"("productId", "role");

-- AddForeignKey
ALTER TABLE "RolePrice" ADD CONSTRAINT "RolePrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
