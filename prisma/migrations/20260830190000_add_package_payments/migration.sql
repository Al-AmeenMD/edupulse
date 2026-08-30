-- AlterTable
ALTER TABLE "payments" ADD COLUMN "packagePaymentId" TEXT;

-- CreateTable
CREATE TABLE "package_payments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "packageId" TEXT,
    "studentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "package_payments_schoolId_receiptNumber_key" ON "package_payments"("schoolId", "receiptNumber");

-- CreateIndex
CREATE INDEX "package_payments_schoolId_paidAt_idx" ON "package_payments"("schoolId", "paidAt");

-- CreateIndex
CREATE INDEX "package_payments_studentId_idx" ON "package_payments"("studentId");

-- CreateIndex
CREATE INDEX "package_payments_packageId_idx" ON "package_payments"("packageId");

-- CreateIndex
CREATE INDEX "payments_packagePaymentId_idx" ON "payments"("packagePaymentId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_packagePaymentId_fkey" FOREIGN KEY ("packagePaymentId") REFERENCES "package_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "fee_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
