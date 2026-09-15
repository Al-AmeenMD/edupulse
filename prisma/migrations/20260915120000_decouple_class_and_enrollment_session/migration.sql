-- Step 1: Add new session and lifecycle columns to class_enrollments
ALTER TABLE "class_enrollments" ADD COLUMN "academicYear" TEXT;
ALTER TABLE "class_enrollments" ADD COLUMN "term" TEXT;
ALTER TABLE "class_enrollments" ADD COLUMN "endedAt" TIMESTAMP(3);

-- Step 2: Accurate backfill from Class.academicYear (Zero hardcoded fallbacks: audit proved 0 orphans)
UPDATE "class_enrollments" ce
SET "academicYear" = c."academicYear"
FROM "classes" c
WHERE ce."classId" = c."id";

-- Enforce NOT NULL on academicYear now that existing rows are populated
ALTER TABLE "class_enrollments" ALTER COLUMN "academicYear" SET NOT NULL;

-- Step 3: Consolidate Duplicate (schoolId, name) Classes
-- 3a. Merge non-null metadata into canonical (earliest createdAt) record
UPDATE "classes" p
SET 
  level = COALESCE(p.level, d.level),
  section = COALESCE(p.section, d.section),
  "teacherId" = COALESCE(p."teacherId", d."teacherId")
FROM "classes" d
WHERE p."schoolId" = d."schoolId" 
  AND p.name = d.name 
  AND p.id <> d.id 
  AND p."createdAt" < d."createdAt";

-- 3b. Re-point class_enrollments foreign keys from duplicate to canonical class
UPDATE "class_enrollments" ce
SET "classId" = p.id
FROM "classes" d
JOIN "classes" p ON p."schoolId" = d."schoolId" AND p.name = d.name AND p."createdAt" < d."createdAt"
WHERE ce."classId" = d.id;

-- 3c. Re-point attendance foreign keys (safety check)
UPDATE "attendance" a
SET "classId" = p.id
FROM "classes" d
JOIN "classes" p ON p."schoolId" = d."schoolId" AND p.name = d.name AND p."createdAt" < d."createdAt"
WHERE a."classId" = d.id;

-- 3d. Re-point subject_teachers foreign keys (safety check)
UPDATE "subject_teachers" st
SET "classId" = p.id
FROM "classes" d
JOIN "classes" p ON p."schoolId" = d."schoolId" AND p.name = d.name AND p."createdAt" < d."createdAt"
WHERE st."classId" = d.id;

-- 3e. Delete duplicate class records
DELETE FROM "classes" d
USING "classes" p
WHERE p."schoolId" = d."schoolId" 
  AND p.name = d.name 
  AND p."createdAt" < d."createdAt";

-- Step 4: Drop old unique index and column on classes, add persistent unique index
DROP INDEX IF EXISTS "classes_schoolId_name_academicYear_key";
ALTER TABLE "classes" DROP COLUMN "academicYear";
CREATE UNIQUE INDEX "classes_schoolId_name_key" ON "classes"("schoolId", "name");

-- Step 5: Update constraints on class_enrollments
-- 5a. Drop studentId_classId uniqueness so repeating a class is legal
DROP INDEX IF EXISTS "class_enrollments_studentId_classId_key";

-- 5b. Defensive cleanup: if any student had multiple active enrollments, keep latest
WITH ranked AS (
  SELECT id, "studentId",
         ROW_NUMBER() OVER (PARTITION BY "studentId" ORDER BY "enrolledAt" DESC) as rn
  FROM "class_enrollments"
  WHERE "endedAt" IS NULL
)
UPDATE "class_enrollments" ce
SET "endedAt" = ce."enrolledAt"
FROM ranked r
WHERE ce.id = r.id AND r.rn > 1;

-- 5c. Create partial unique index guaranteeing exactly ONE active enrollment per student
CREATE UNIQUE INDEX "class_enrollments_single_active_per_student" 
ON "class_enrollments" ("studentId") 
WHERE "endedAt" IS NULL;

-- 5d. Create query performance indexes
CREATE INDEX "class_enrollments_classId_endedAt_idx" ON "class_enrollments"("classId", "endedAt");
CREATE INDEX "class_enrollments_studentId_endedAt_idx" ON "class_enrollments"("studentId", "endedAt");
