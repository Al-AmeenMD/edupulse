import { Prisma, Student, ClassEnrollment } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class StudentValidationError extends Error {
  statusCode: number;
  field?: string;

  constructor(message: string, statusCode: number = 400, field?: string) {
    super(message);
    this.name = "StudentValidationError";
    this.statusCode = statusCode;
    this.field = field;
  }
}

export function generateStudentId(
  template: string,
  values: {
    prefix: string;
    year: string;
    level?: string;
    seq: number;
  }
): string {
  return template
    .replace("{PREFIX}", values.prefix)
    .replace("{YEAR}", values.year)
    .replace("{LEVEL}", values.level ?? "")
    .replace(/\{SEQ:(\d+)\}/, (_, digits) =>
      String(values.seq).padStart(parseInt(digits, 10), "0")
    );
}

export function normalizeGender(
  rawGender?: string | null
): { gender: string | null; error?: string } {
  if (!rawGender || !rawGender.trim()) {
    return { gender: null };
  }
  const clean = rawGender.trim().toLowerCase();
  if (["male", "m", "boy"].includes(clean)) return { gender: "Male" };
  if (["female", "f", "girl"].includes(clean)) return { gender: "Female" };
  if (["other", "o"].includes(clean)) return { gender: "Other" };
  return {
    gender: null,
    error: `Invalid gender '${rawGender}'. Allowed values: Male, Female, Other (or M/F)`,
  };
}

export function parseDateOfBirth(
  rawDob?: string | Date | null
): { date: Date | null; error?: string } {
  if (!rawDob) {
    return { date: null };
  }
  if (rawDob instanceof Date) {
    return isNaN(rawDob.getTime())
      ? { date: null, error: "Invalid calendar date" }
      : { date: rawDob };
  }
  const trimmed = String(rawDob).trim();
  if (!trimmed) {
    return { date: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { date: null, error: "Invalid date format. Expected YYYY-MM-DD" };
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    return { date: null, error: "Invalid calendar date" };
  }
  return { date: d };
}

export interface CreateStudentInput {
  schoolId: string;
  firstName: string;
  lastName: string;
  studentId?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  address?: string | null;
  admissionLevel?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  classId?: string | null;
  validateOnly?: boolean;
}

export interface CreateStudentResult {
  student: Student;
  enrollment?: ClassEnrollment | null;
  isDryRun?: boolean;
}

export async function createStudentCore(
  input: CreateStudentInput,
  txClient?: Prisma.TransactionClient
): Promise<CreateStudentResult> {
  const db = txClient ?? prisma;
  const schoolId = input.schoolId;

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();

  if (!firstName || !lastName) {
    throw new StudentValidationError(
      "First name and last name are required",
      400,
      !firstName ? "firstName" : "lastName"
    );
  }

  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { studentIdTemplate: true, studentIdPrefix: true },
  });

  if (!school) {
    throw new StudentValidationError("School not found", 404);
  }

  const template = school.studentIdTemplate || "{PREFIX}/{YEAR}/{SEQ:3}";
  const prefix = school.studentIdPrefix || "STU";
  const hasLevelToken = template.includes("{LEVEL}");
  const hasYearToken = template.includes("{YEAR}");

  const admissionLevelInput = input.admissionLevel?.trim();

  if (hasLevelToken && !admissionLevelInput) {
    throw new StudentValidationError(
      "admissionLevel is required for this school's ID format",
      400,
      "admissionLevel"
    );
  }

  const admissionLevel = hasLevelToken ? (admissionLevelInput || null) : null;
  const manualStudentId = input.studentId?.trim();
  let studentId: string;

  if (manualStudentId) {
    const existing = await db.student.findUnique({
      where: {
        schoolId_studentId: {
          schoolId,
          studentId: manualStudentId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new StudentValidationError(
        "Student ID already exists",
        409,
        "studentId"
      );
    }

    studentId = manualStudentId;
  } else {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear + 1, 0, 1);

    const whereCount: any = { schoolId };

    if (hasLevelToken) {
      whereCount.admissionLevel = admissionLevel;
    }

    if (hasYearToken) {
      whereCount.createdAt = {
        gte: yearStart,
        lt: yearEnd,
      };
    }

    const count = await db.student.count({
      where: whereCount,
    });

    studentId = generateStudentId(template, {
      prefix,
      year: String(currentYear),
      level: admissionLevel || "",
      seq: count + 1,
    });
  }

  // Parse & validate DOB
  const dobResult = parseDateOfBirth(input.dateOfBirth);
  if (dobResult.error) {
    throw new StudentValidationError(dobResult.error, 400, "dateOfBirth");
  }

  // Parse & validate gender
  const genderResult = normalizeGender(input.gender);
  if (genderResult.error) {
    throw new StudentValidationError(genderResult.error, 400, "gender");
  }

  // If classId is specified, validate that class exists in this school
  if (input.classId) {
    const classRecord = await db.class.findUnique({
      where: { id: input.classId },
      select: { schoolId: true },
    });

    if (!classRecord || classRecord.schoolId !== schoolId) {
      throw new StudentValidationError(
        "Class not found in this school",
        404,
        "classId"
      );
    }
  }

  // If validateOnly is true (dry-run mode), return predicted result without DB writes
  if (input.validateOnly) {
    const previewStudent: Student = {
      id: "dry-run-preview-id",
      schoolId,
      studentId: manualStudentId || "(auto-generated on import)",
      firstName,
      lastName,
      dateOfBirth: dobResult.date,
      gender: genderResult.gender,
      address: input.address?.trim() || null,
      avatarUrl: null,
      admissionLevel,
      guardianName: input.guardianName?.trim() || null,
      guardianPhone: input.guardianPhone?.trim() || null,
      guardianEmail: input.guardianEmail?.trim() || null,
      isActive: true,
      enrolledAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const previewEnrollment: ClassEnrollment | null = input.classId
      ? {
          id: "dry-run-enrollment-id",
          studentId: "dry-run-preview-id",
          classId: input.classId,
          enrolledAt: new Date(),
        }
      : null;

    return {
      student: previewStudent,
      enrollment: previewEnrollment,
      isDryRun: true,
    };
  }

  // Insert Student
  const student = await db.student.create({
    data: {
      schoolId,
      studentId,
      firstName,
      lastName,
      dateOfBirth: dobResult.date,
      gender: genderResult.gender,
      address: input.address?.trim() || null,
      admissionLevel,
      guardianName: input.guardianName?.trim() || null,
      guardianPhone: input.guardianPhone?.trim() || null,
      guardianEmail: input.guardianEmail?.trim() || null,
    },
  });

  // If classId is specified, atomically enroll the student
  let enrollment: ClassEnrollment | null = null;
  if (input.classId) {
    enrollment = await db.classEnrollment.create({
      data: {
        studentId: student.id,
        classId: input.classId,
      },
    });
  }

  return { student, enrollment };
}
