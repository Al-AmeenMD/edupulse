import { Fee, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ExecuteAssignmentParams {
  schoolId: string;
  feeStructureIds: string[];
  studentId?: string;
  classId?: string;
  admissionLevel?: string;
}

export interface SingleStructureAssignmentResult {
  feeStructureId: string;
  feeStructureName: string;
  feeStructureType: string;
  amount: Prisma.Decimal;
  academicYear: string;
  term?: string | null;
  assignedCount: number;
  skippedCount: number;
  totalEligible: number;
  fees: Fee[];
}

export interface AssignmentExecutionSummary {
  structuresProcessed: number;
  totalFeesCreated: number;
  totalFeesSkipped: number;
  targetMode: "single" | "class" | "admissionLevel";
  totalTargetStudents: number;
  results: SingleStructureAssignmentResult[];
}

export class FeeAssignmentError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "FeeAssignmentError";
    this.statusCode = statusCode;
  }
}

/**
 * Resolves and validates target student IDs based on mode (single, class, or admission level).
 */
export async function resolveTargetStudents(
  params: {
    schoolId: string;
    studentId?: string;
    classId?: string;
    admissionLevel?: string;
  },
  tx: Prisma.TransactionClient | typeof prisma
): Promise<{
  targetMode: "single" | "class" | "admissionLevel";
  studentIds: string[];
}> {
  const { schoolId, studentId, classId, admissionLevel } = params;

  const targetCount = [Boolean(studentId), Boolean(classId), Boolean(admissionLevel)].filter(Boolean).length;

  if (targetCount === 0) {
    throw new FeeAssignmentError("Either studentId, classId, or admissionLevel is required", 400);
  }

  if (targetCount > 1) {
    throw new FeeAssignmentError("Provide only one assignment target (studentId, classId, or admissionLevel)", 400);
  }

  // 1. Single Student Target
  if (studentId) {
    const student = await tx.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true },
    });

    if (!student) {
      throw new FeeAssignmentError("Student not found", 404);
    }

    return {
      targetMode: "single",
      studentIds: [student.id],
    };
  }

  // 2. Class Target
  if (classId) {
    const classRecord = await tx.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true },
    });

    if (!classRecord) {
      throw new FeeAssignmentError("Class not found", 404);
    }

    const enrollments = await tx.classEnrollment.findMany({
      where: { classId },
      select: { studentId: true },
    });

    if (enrollments.length === 0) {
      throw new FeeAssignmentError("No students enrolled in this class", 400);
    }

    return {
      targetMode: "class",
      studentIds: enrollments.map((e) => e.studentId),
    };
  }

  // 3. Admission Level Target
  if (admissionLevel) {
    const matchingStudents = await tx.student.findMany({
      where: { schoolId, admissionLevel },
      select: { id: true },
    });

    if (matchingStudents.length === 0) {
      throw new FeeAssignmentError(`No active students found with admission level '${admissionLevel}'`, 400);
    }

    return {
      targetMode: "admissionLevel",
      studentIds: matchingStudents.map((s) => s.id),
    };
  }

  throw new FeeAssignmentError("Invalid assignment target", 400);
}

/**
 * Assigns a single fee structure to a set of pre-resolved eligible students.
 */
export async function assignSingleStructureCore(
  feeStructureId: string,
  eligibleStudentIds: string[],
  schoolId: string,
  tx: Prisma.TransactionClient
): Promise<SingleStructureAssignmentResult> {
  const feeStructure = await tx.feeStructure.findUnique({
    where: { id: feeStructureId },
    select: {
      id: true,
      schoolId: true,
      name: true,
      type: true,
      amount: true,
      academicYear: true,
      term: true,
      dueDate: true,
    },
  });

  if (!feeStructure || feeStructure.schoolId !== schoolId) {
    throw new FeeAssignmentError(`Fee structure not found (${feeStructureId})`, 404);
  }

  // Find students who already have a fee for this structure
  const existingFees = await tx.fee.findMany({
    where: {
      schoolId,
      feeStructureId,
      studentId: { in: eligibleStudentIds },
    },
    select: { studentId: true },
  });

  const alreadyAssignedSet = new Set(existingFees.map((f) => f.studentId));
  const newStudentIds = eligibleStudentIds.filter((id) => !alreadyAssignedSet.has(id));

  let createdFees: Fee[] = [];

  if (newStudentIds.length > 0) {
    // Bulk create fee records
    const createOps = newStudentIds.map((sid) =>
      tx.fee.create({
        data: {
          schoolId,
          studentId: sid,
          feeStructureId,
          amountDue: feeStructure.amount,
          dueDate: feeStructure.dueDate,
          status: "PENDING",
        },
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
              admissionLevel: true,
              classEnrollments: {
                select: { class: { select: { id: true, name: true } } },
                take: 1,
                orderBy: { enrolledAt: "desc" },
              },
            },
          },
          feeStructure: {
            select: {
              id: true,
              name: true,
              type: true,
              academicYear: true,
              term: true,
            },
          },
        },
      })
    );

    createdFees = (await Promise.all(createOps)) as unknown as Fee[];
  }

  return {
    feeStructureId: feeStructure.id,
    feeStructureName: feeStructure.name,
    feeStructureType: feeStructure.type,
    amount: feeStructure.amount,
    academicYear: feeStructure.academicYear,
    term: feeStructure.term,
    assignedCount: createdFees.length,
    skippedCount: alreadyAssignedSet.size,
    totalEligible: eligibleStudentIds.length,
    fees: createdFees,
  };
}

/**
 * Unified Master Assignment Engine
 * Executes single, multi-select, or package fee assignments atomically.
 */
export async function executeFeeAssignment(
  params: ExecuteAssignmentParams,
  txClient?: Prisma.TransactionClient
): Promise<AssignmentExecutionSummary> {
  const { schoolId, feeStructureIds, studentId, classId, admissionLevel } = params;

  if (!feeStructureIds || feeStructureIds.length === 0) {
    throw new FeeAssignmentError("At least one fee structure ID is required", 400);
  }

  // Deduplicate structure IDs while preserving order
  const uniqueStructureIds = Array.from(new Set(feeStructureIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueStructureIds.length === 0) {
    throw new FeeAssignmentError("No valid fee structure IDs provided", 400);
  }

  const runWithTransaction = async (tx: Prisma.TransactionClient): Promise<AssignmentExecutionSummary> => {
    // 1. Resolve eligible target students
    const { targetMode, studentIds } = await resolveTargetStudents(
      { schoolId, studentId, classId, admissionLevel },
      tx
    );

    // 2. Iterate through each structure and assign
    const results: SingleStructureAssignmentResult[] = [];
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const structureId of uniqueStructureIds) {
      const result = await assignSingleStructureCore(structureId, studentIds, schoolId, tx);
      results.push(result);
      totalCreated += result.assignedCount;
      totalSkipped += result.skippedCount;
    }

    return {
      structuresProcessed: uniqueStructureIds.length,
      totalFeesCreated: totalCreated,
      totalFeesSkipped: totalSkipped,
      targetMode,
      totalTargetStudents: studentIds.length,
      results,
    };
  };

  if (txClient) {
    return runWithTransaction(txClient);
  }

  return prisma.$transaction(runWithTransaction, { maxWait: 10000, timeout: 20000 });
}
