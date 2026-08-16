-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "division" TEXT;

-- DataMigration: Move retired section/arm values to division and reset section for clean grouping
UPDATE "classes" SET "division" = "section", "section" = NULL WHERE "section" IS NOT NULL;
