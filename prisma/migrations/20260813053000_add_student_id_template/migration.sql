-- AlterTable
ALTER TABLE "schools" ADD COLUMN "studentIdPrefix" TEXT NOT NULL DEFAULT 'STU',
ADD COLUMN "studentIdTemplate" TEXT NOT NULL DEFAULT '{PREFIX}/{YEAR}/{SEQ:3}';

-- AlterTable
ALTER TABLE "students" ADD COLUMN "admissionLevel" TEXT;
