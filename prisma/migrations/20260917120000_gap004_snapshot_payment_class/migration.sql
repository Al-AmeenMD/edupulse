-- Step 1: Add columns
ALTER TABLE "payments" ADD COLUMN "classId" TEXT;
ALTER TABLE "payments" ADD COLUMN "className" TEXT;

ALTER TABLE "package_payments" ADD COLUMN "classId" TEXT;
ALTER TABLE "package_payments" ADD COLUMN "className" TEXT;

-- Step 2: Create Indexes & Foreign Keys
CREATE INDEX "payments_schoolId_classId_idx" ON "payments"("schoolId", "classId");
CREATE INDEX "package_payments_schoolId_classId_idx" ON "package_payments"("schoolId", "classId");

ALTER TABLE "payments" ADD CONSTRAINT "payments_classId_fkey" 
  FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_classId_fkey" 
  FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 3: Backfill Payments table via temporal point-in-time match against class_enrollments
UPDATE "payments" p
SET 
  "classId" = matched_enrollment."classId",
  "className" = matched_enrollment."className"
FROM (
  SELECT DISTINCT ON (p2.id)
    p2.id AS payment_id,
    ce."classId" AS "classId",
    c.name AS "className"
  FROM "payments" p2
  JOIN "fees" f ON p2."feeId" = f.id
  JOIN "class_enrollments" ce ON f."studentId" = ce."studentId"
  JOIN "classes" c ON ce."classId" = c.id
  WHERE ce."enrolledAt" <= p2."paidAt"
    AND (ce."endedAt" IS NULL OR ce."endedAt" >= p2."paidAt")
  ORDER BY p2.id, ce."enrolledAt" DESC
) matched_enrollment
WHERE p.id = matched_enrollment.payment_id;

-- Step 4: Backfill PackagePayments table via temporal point-in-time match against class_enrollments
UPDATE "package_payments" pp
SET 
  "classId" = matched_enrollment."classId",
  "className" = matched_enrollment."className"
FROM (
  SELECT DISTINCT ON (pp2.id)
    pp2.id AS package_payment_id,
    ce."classId" AS "classId",
    c.name AS "className"
  FROM "package_payments" pp2
  JOIN "class_enrollments" ce ON pp2."studentId" = ce."studentId"
  JOIN "classes" c ON ce."classId" = c.id
  WHERE ce."enrolledAt" <= pp2."paidAt"
    AND (ce."endedAt" IS NULL OR ce."endedAt" >= pp2."paidAt")
  ORDER BY pp2.id, ce."enrolledAt" DESC
) matched_enrollment
WHERE pp.id = matched_enrollment.package_payment_id;
