-- AlterEnum
ALTER TYPE "FeeType" ADD VALUE 'FEEDING';

-- CreateTable
CREATE TABLE "fee_packages" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "academicYear" TEXT NOT NULL,
    "term" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_package_items" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fee_packages_schoolId_name_academicYear_term_key" ON "fee_packages"("schoolId", "name", "academicYear", "term");

-- CreateIndex
CREATE UNIQUE INDEX "fee_package_items_packageId_feeStructureId_key" ON "fee_package_items"("packageId", "feeStructureId");

-- AddForeignKey
ALTER TABLE "fee_packages" ADD CONSTRAINT "fee_packages_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_package_items" ADD CONSTRAINT "fee_package_items_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "fee_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_package_items" ADD CONSTRAINT "fee_package_items_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
