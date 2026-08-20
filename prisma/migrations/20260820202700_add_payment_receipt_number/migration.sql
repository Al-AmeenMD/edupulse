-- AlterTable: Add nullable columns
ALTER TABLE "payments" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "payments" ADD COLUMN "receiptNumber" TEXT;

-- Backfill schoolId from fees table
UPDATE "payments" p
SET "schoolId" = f."schoolId"
FROM "fees" f
WHERE p."feeId" = f."id";

-- Backfill receiptNumber for historical payment records
WITH numbered_payments AS (
  SELECT 
    p."id",
    COALESCE(s."studentIdPrefix", 'SCH') as prefix,
    EXTRACT(YEAR FROM p."paidAt")::text as yr,
    LPAD(ROW_NUMBER() OVER (PARTITION BY p."schoolId", EXTRACT(YEAR FROM p."paidAt") ORDER BY p."paidAt" ASC)::text, 5, '0') as seq
  FROM "payments" p
  JOIN "schools" s ON s."id" = p."schoolId"
)
UPDATE "payments" p
SET "receiptNumber" = 'RCP/' || np.prefix || '/' || np.yr || '/' || np.seq
FROM numbered_payments np
WHERE p."id" = np."id";

-- AlterTable: Enforce NOT NULL constraints
ALTER TABLE "payments" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "receiptNumber" SET NOT NULL;

-- CreateIndex: Composite unique index on (schoolId, receiptNumber)
CREATE UNIQUE INDEX "payments_schoolId_receiptNumber_key" ON "payments"("schoolId", "receiptNumber");

-- AddForeignKey: payment -> school
ALTER TABLE "payments" ADD CONSTRAINT "payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
