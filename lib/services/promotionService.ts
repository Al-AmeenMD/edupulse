import { prisma } from "@/lib/prisma";
import { ClassEnrollment, Prisma } from "@prisma/client";

export class PromotionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "PromotionError";
    this.statusCode = statusCode;
  }
}

export interface PromoteStudentInput {
  schoolId: string;
  studentId: string;
  targetClassId: string;
  targetAcademicYear: string;
  targetTerm?: string | null;
}

export interface PromoteStudentResult {
  studentId: string;
  previousEnrollmentId?: string;
  newEnrollment: ClassEnrollment;
}

export interface PromoteClassBatchInput {
  schoolId: string;
  sourceClassId: string;
  targetClassId: string;
  targetAcademicYear: string;
  targetTerm?: string | null;
  studentIds?: string[];
}

export interface PromoteClassBatchResult {
  promotedCount: number;
  sourceClassId: string;
  targetClassId: string;
  targetAcademicYear: string;
}

/**
 * Promotes a single student to a target class for a specified academic year.
 * Atomically closes any current active enrollment (endedAt = now) and creates a new active enrollment.
 * Leaves student.admissionLevel untouched (treated as immutable admission intake history).
 */
export async function promoteStudent(
  input: PromoteStudentInput,
  txClient?: Prisma.TransactionClient
): Promise<PromoteStudentResult> {
  const { schoolId, studentId, targetClassId, targetAcademicYear, targetTerm } = input;

  if (!targetAcademicYear || !targetAcademicYear.trim()) {
    throw new PromotionError("Target academic year is required for promotion", 400);
  }

  const execute = async (tx: Prisma.TransactionClient): Promise<PromoteStudentResult> => {
    // 1. Verify student exists and belongs to school
    const student = await tx.student.findFirst({
      where: { id: studentId, schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!student) {
      throw new PromotionError("Student not found or inactive in this school", 404);
    }

    // 2. Verify target class exists and belongs to school
    const targetClass = await tx.class.findFirst({
      where: { id: targetClassId, schoolId },
      select: { id: true, name: true },
    });

    if (!targetClass) {
      throw new PromotionError("Target class not found in this school", 404);
    }

    // 3. Find current active enrollment
    const activeEnrollment = await tx.classEnrollment.findFirst({
      where: {
        studentId,
        endedAt: null,
      },
    });

    if (
      activeEnrollment &&
      activeEnrollment.classId === targetClassId &&
      activeEnrollment.academicYear === targetAcademicYear.trim()
    ) {
      throw new PromotionError(
        `Student is already actively enrolled in ${targetClass.name} for academic year ${targetAcademicYear}`,
        400
      );
    }

    // 4. Close current active enrollment if present
    if (activeEnrollment) {
      await tx.classEnrollment.update({
        where: { id: activeEnrollment.id },
        data: { endedAt: new Date() },
      });
    }

    // 5. Create new active enrollment
    const newEnrollment = await tx.classEnrollment.create({
      data: {
        studentId,
        classId: targetClassId,
        academicYear: targetAcademicYear.trim(),
        term: targetTerm?.trim() || null,
        enrolledAt: new Date(),
        endedAt: null,
      },
    });

    return {
      studentId,
      previousEnrollmentId: activeEnrollment?.id,
      newEnrollment,
    };
  };

  return txClient ? execute(txClient) : prisma.$transaction(execute);
}

/**
 * Promotes a cohort of students from a source class to a target class.
 * Closes current active enrollments for the cohort and creates new active enrollments in the target class.
 */
export async function promoteClassBatch(
  input: PromoteClassBatchInput,
  txClient?: Prisma.TransactionClient
): Promise<PromoteClassBatchResult> {
  const { schoolId, sourceClassId, targetClassId, targetAcademicYear, targetTerm, studentIds } = input;

  if (!targetAcademicYear || !targetAcademicYear.trim()) {
    throw new PromotionError("Target academic year is required for promotion", 400);
  }

  const execute = async (tx: Prisma.TransactionClient): Promise<PromoteClassBatchResult> => {
    // 1. Validate classes
    const [sourceClass, targetClass] = await Promise.all([
      tx.class.findFirst({ where: { id: sourceClassId, schoolId }, select: { id: true, name: true } }),
      tx.class.findFirst({ where: { id: targetClassId, schoolId }, select: { id: true, name: true } }),
    ]);

    if (!sourceClass) {
      throw new PromotionError("Source class not found in this school", 404);
    }
    if (!targetClass) {
      throw new PromotionError("Target class not found in this school", 404);
    }

    // 2. Find active enrollments in source class
    const whereEnrollment: Prisma.ClassEnrollmentWhereInput = {
      classId: sourceClassId,
      endedAt: null,
    };

    if (studentIds && studentIds.length > 0) {
      whereEnrollment.studentId = { in: studentIds };
    }

    const activeEnrollments = await tx.classEnrollment.findMany({
      where: whereEnrollment,
      select: { id: true, studentId: true },
    });

    if (activeEnrollments.length === 0) {
      return {
        promotedCount: 0,
        sourceClassId,
        targetClassId,
        targetAcademicYear,
      };
    }

    const now = new Date();
    const enrollmentIds = activeEnrollments.map((e) => e.id);

    // 3. Close active enrollments
    await tx.classEnrollment.updateMany({
      where: { id: { in: enrollmentIds } },
      data: { endedAt: now },
    });

    // 4. Create new active enrollments in target class
    await tx.classEnrollment.createMany({
      data: activeEnrollments.map((e) => ({
        studentId: e.studentId,
        classId: targetClassId,
        academicYear: targetAcademicYear.trim(),
        term: targetTerm?.trim() || null,
        enrolledAt: now,
        endedAt: null,
      })),
    });

    return {
      promotedCount: activeEnrollments.length,
      sourceClassId,
      targetClassId,
      targetAcademicYear,
    };
  };

  return txClient ? execute(txClient) : prisma.$transaction(execute);
}
