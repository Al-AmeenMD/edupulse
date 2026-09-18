-- Step 1: Create academic_sessions and terms tables
CREATE TABLE "academic_sessions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "academic_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "terms" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- Step 2: Unique constraints and partial single-active indexes
CREATE UNIQUE INDEX "academic_sessions_schoolId_name_key" ON "academic_sessions"("schoolId", "name");
CREATE INDEX "academic_sessions_schoolId_isCurrent_idx" ON "academic_sessions"("schoolId", "isCurrent");
CREATE UNIQUE INDEX "academic_sessions_schoolId_isCurrent_key" ON "academic_sessions"("schoolId") WHERE "isCurrent" = true;

CREATE UNIQUE INDEX "terms_sessionId_name_key" ON "terms"("sessionId", "name");
CREATE INDEX "terms_sessionId_isCurrent_idx" ON "terms"("sessionId", "isCurrent");
CREATE UNIQUE INDEX "terms_sessionId_isCurrent_key" ON "terms"("sessionId") WHERE "isCurrent" = true;

ALTER TABLE "academic_sessions" ADD CONSTRAINT "academic_sessions_schoolId_fkey" 
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "terms" ADD CONSTRAINT "terms_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 3: Add new foreign key and snapshot columns
ALTER TABLE "class_enrollments" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "class_enrollments" ADD COLUMN "termId" TEXT;

ALTER TABLE "fee_structures" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "fee_structures" ADD COLUMN "termId" TEXT;

ALTER TABLE "budgets" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "budgets" ADD COLUMN "termId" TEXT;

ALTER TABLE "fee_packages" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "fee_packages" ADD COLUMN "termId" TEXT;

ALTER TABLE "payments" ADD COLUMN "academicSessionName" TEXT;
ALTER TABLE "payments" ADD COLUMN "termName" TEXT;
ALTER TABLE "payments" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "payments" ADD COLUMN "termId" TEXT;

ALTER TABLE "package_payments" ADD COLUMN "academicSessionName" TEXT;
ALTER TABLE "package_payments" ADD COLUMN "termName" TEXT;
ALTER TABLE "package_payments" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "package_payments" ADD COLUMN "termId" TEXT;

ALTER TABLE "budget_audit_logs" ADD COLUMN "academicSessionName" TEXT;
ALTER TABLE "budget_audit_logs" ADD COLUMN "termName" TEXT;

-- Step 4: Dynamically discover and seed distinct Academic Sessions per school with active-enrollment-driven isCurrent
WITH active_session_ranks AS (
    SELECT 
        c."schoolId",
        ce."academicYear",
        COUNT(*)::int as active_count,
        MAX(ce."enrolledAt") as latest_enrollment
    FROM "class_enrollments" ce
    JOIN "classes" c ON ce."classId" = c."id"
    WHERE ce."endedAt" IS NULL
    GROUP BY c."schoolId", ce."academicYear"
),
current_session_per_school AS (
    SELECT 
        asr."schoolId",
        asr."academicYear",
        ROW_NUMBER() OVER(
            PARTITION BY asr."schoolId" 
            ORDER BY asr.active_count DESC, asr.latest_enrollment DESC
        ) as rn
    FROM active_session_ranks asr
),
distinct_school_sessions AS (
    SELECT c."schoolId", ce."academicYear"
    FROM "class_enrollments" ce
    JOIN "classes" c ON ce."classId" = c."id"
    WHERE ce."academicYear" IS NOT NULL AND trim(ce."academicYear") != ''
    UNION
    SELECT "schoolId", "academicYear"
    FROM "fee_structures"
    WHERE "academicYear" IS NOT NULL AND trim("academicYear") != ''
    UNION
    SELECT "schoolId", "academicYear"
    FROM "budgets"
    WHERE "academicYear" IS NOT NULL AND trim("academicYear") != ''
    UNION
    SELECT "schoolId", "academicYear"
    FROM "fee_packages"
    WHERE "academicYear" IS NOT NULL AND trim("academicYear") != ''
)
INSERT INTO "academic_sessions" ("id", "schoolId", "name", "isCurrent", "createdAt", "updatedAt")
SELECT 
    'sess_' || substr(md5(dss."schoolId" || ':' || dss."academicYear"), 1, 24),
    dss."schoolId", 
    dss."academicYear", 
    COALESCE(
        (cs."academicYear" = dss."academicYear"),
        (ROW_NUMBER() OVER(PARTITION BY dss."schoolId" ORDER BY dss."academicYear" DESC) = 1)
    ),
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
FROM distinct_school_sessions dss
LEFT JOIN current_session_per_school cs ON dss."schoolId" = cs."schoolId" AND cs.rn = 1
ON CONFLICT ("schoolId", "name") DO NOTHING;

-- Fallback bootstrap: Ensure schools with 0 existing records receive a default "2025/2026" current session
INSERT INTO "academic_sessions" ("id", "schoolId", "name", "isCurrent", "createdAt", "updatedAt")
SELECT 
    'sess_' || substr(md5(s."id" || ':2025/2026'), 1, 24),
    s."id",
    '2025/2026',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "schools" s
WHERE NOT EXISTS (
    SELECT 1 FROM "academic_sessions" existing WHERE existing."schoolId" = s."id"
)
ON CONFLICT ("schoolId", "name") DO NOTHING;

-- Step 5: Seed 3 standard terms under every created session
INSERT INTO "terms" ("id", "sessionId", "name", "isCurrent", "createdAt", "updatedAt")
SELECT 
    'term_' || substr(md5(s."id" || ':First Term'), 1, 24),
    s."id",
    'First Term',
    s."isCurrent", -- Active if parent session is active
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "academic_sessions" s
ON CONFLICT ("sessionId", "name") DO NOTHING;

INSERT INTO "terms" ("id", "sessionId", "name", "isCurrent", "createdAt", "updatedAt")
SELECT 
    'term_' || substr(md5(s."id" || ':Second Term'), 1, 24),
    s."id",
    'Second Term',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "academic_sessions" s
ON CONFLICT ("sessionId", "name") DO NOTHING;

INSERT INTO "terms" ("id", "sessionId", "name", "isCurrent", "createdAt", "updatedAt")
SELECT 
    'term_' || substr(md5(s."id" || ':Third Term'), 1, 24),
    s."id",
    'Third Term',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "academic_sessions" s
ON CONFLICT ("sessionId", "name") DO NOTHING;

-- Step 6: Backfill class_enrollments (22 rows across all schools)
UPDATE "class_enrollments" ce
SET "sessionId" = s."id"
FROM "classes" c
JOIN "academic_sessions" s ON s."schoolId" = c."schoolId"
WHERE ce."classId" = c."id"
  AND s."name" = ce."academicYear";

UPDATE "class_enrollments" ce
SET "termId" = t."id"
FROM "terms" t
WHERE ce."sessionId" = t."sessionId"
  AND (
    (ce."term" IN ('FIRST', 'First Term', 'Term 1') AND t."name" = 'First Term') OR
    (ce."term" = 'Term 2' AND t."name" = 'Second Term') OR
    (ce."term" = 'Term 3' AND t."name" = 'Third Term')
  );

-- Step 7: Backfill fee_structures (8 rows across all schools)
UPDATE "fee_structures" fs
SET "sessionId" = s."id"
FROM "academic_sessions" s
WHERE fs."schoolId" = s."schoolId" AND fs."academicYear" = s."name";

UPDATE "fee_structures" fs
SET "termId" = t."id"
FROM "terms" t
WHERE fs."sessionId" = t."sessionId"
  AND (
    (fs."term" IN ('FIRST', 'First Term', 'Term 1') AND t."name" = 'First Term') OR
    (fs."term" = 'Term 2' AND t."name" = 'Second Term') OR
    (fs."term" = 'Term 3' AND t."name" = 'Third Term')
  );

-- Step 8: Backfill budgets (1 row) and fee_packages (1 row)
UPDATE "budgets" b
SET "sessionId" = s."id"
FROM "academic_sessions" s
WHERE b."schoolId" = s."schoolId" AND b."academicYear" = s."name";

UPDATE "budgets" b
SET "termId" = t."id"
FROM "terms" t
WHERE b."sessionId" = t."sessionId"
  AND (
    (b."term" IN ('FIRST', 'First Term', 'Term 1') AND t."name" = 'First Term') OR
    (b."term" = 'Term 2' AND t."name" = 'Second Term') OR
    (b."term" = 'Term 3' AND t."name" = 'Third Term')
  );

UPDATE "fee_packages" fp
SET "sessionId" = s."id"
FROM "academic_sessions" s
WHERE fp."schoolId" = s."schoolId" AND fp."academicYear" = s."name";

UPDATE "fee_packages" fp
SET "termId" = t."id"
FROM "terms" t
WHERE fp."sessionId" = t."sessionId"
  AND (
    (fp."term" IN ('FIRST', 'First Term', 'Term 1') AND t."name" = 'First Term') OR
    (fp."term" = 'Term 2' AND t."name" = 'Second Term') OR
    (fp."term" = 'Term 3' AND t."name" = 'Third Term')
  );

-- Step 9: Relational payment backfills (ZERO contradictions)
UPDATE "payments" p
SET 
    "sessionId" = fs."sessionId",
    "termId" = fs."termId",
    "academicSessionName" = s."name",
    "termName" = t."name"
FROM "fees" f
JOIN "fee_structures" fs ON f."feeStructureId" = fs."id"
LEFT JOIN "academic_sessions" s ON fs."sessionId" = s."id"
LEFT JOIN "terms" t ON fs."termId" = t."id"
WHERE p."feeId" = f."id";

UPDATE "package_payments" pp
SET 
    "sessionId" = fp."sessionId",
    "termId" = fp."termId",
    "academicSessionName" = s."name",
    "termName" = t."name"
FROM "fee_packages" fp
LEFT JOIN "academic_sessions" s ON fp."sessionId" = s."id"
LEFT JOIN "terms" t ON fp."termId" = t."id"
WHERE pp."packageId" = fp."id";

UPDATE "budget_audit_logs" bal
SET
    "academicSessionName" = s."name",
    "termName" = t."name"
FROM "budgets" b
LEFT JOIN "academic_sessions" s ON b."sessionId" = s."id"
LEFT JOIN "terms" t ON b."termId" = t."id"
WHERE bal."budgetId" = b."id";

-- Step 10: Enforce NOT NULL constraints
ALTER TABLE "class_enrollments" ALTER COLUMN "sessionId" SET NOT NULL;
ALTER TABLE "fee_structures" ALTER COLUMN "sessionId" SET NOT NULL;
ALTER TABLE "budgets" ALTER COLUMN "sessionId" SET NOT NULL;
ALTER TABLE "budgets" ALTER COLUMN "termId" SET NOT NULL;
ALTER TABLE "fee_packages" ALTER COLUMN "sessionId" SET NOT NULL;

-- Step 11: Drop legacy free-text columns and old unique constraints
DROP INDEX IF EXISTS "budgets_schoolId_academicYear_term_key";
DROP INDEX IF EXISTS "fee_packages_schoolId_name_academicYear_term_key";
DROP INDEX IF EXISTS "fee_structures_schoolId_academicYear_term_idx";

ALTER TABLE "class_enrollments" DROP COLUMN "academicYear", DROP COLUMN "term";
ALTER TABLE "fee_structures" DROP COLUMN "academicYear", DROP COLUMN "term";
ALTER TABLE "budgets" DROP COLUMN "academicYear", DROP COLUMN "term";
ALTER TABLE "fee_packages" DROP COLUMN "academicYear", DROP COLUMN "term";

-- Step 12: Add new relational foreign keys, unique constraints, and indexes
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_termId_fkey" 
    FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_termId_fkey" 
    FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_termId_fkey" 
    FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fee_packages" ADD CONSTRAINT "fee_packages_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_packages" ADD CONSTRAINT "fee_packages_termId_fkey" 
    FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_termId_fkey" 
    FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_termId_fkey" 
    FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "class_enrollments_sessionId_classId_idx" ON "class_enrollments"("sessionId", "classId");
CREATE INDEX "fee_structures_schoolId_sessionId_termId_idx" ON "fee_structures"("schoolId", "sessionId", "termId");
CREATE UNIQUE INDEX "budgets_schoolId_sessionId_termId_key" ON "budgets"("schoolId", "sessionId", "termId");
CREATE UNIQUE INDEX "fee_packages_schoolId_name_sessionId_termId_key" ON "fee_packages"("schoolId", "name", "sessionId", "termId");
CREATE INDEX "payments_schoolId_sessionId_termId_idx" ON "payments"("schoolId", "sessionId", "termId");
CREATE INDEX "package_payments_schoolId_sessionId_termId_idx" ON "package_payments"("schoolId", "sessionId", "termId");
