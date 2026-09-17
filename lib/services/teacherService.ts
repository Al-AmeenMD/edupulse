import crypto from "crypto";
import { Prisma, Role, Teacher } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class TeacherValidationError extends Error {
  statusCode: number;
  field?: string;

  constructor(message: string, statusCode: number = 400, field?: string) {
    super(message);
    this.name = "TeacherValidationError";
    this.statusCode = statusCode;
    this.field = field;
  }
}

const SECURE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*"; // 60 characters (no ambiguous 0/O, 1/l/I)

export function generateSecurePassword(length: number = 12): string {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += SECURE_CHARS[bytes[i] % SECURE_CHARS.length];
  }
  return password;
}

export function parseTeacherDob(
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

export interface CreateTeacherInput {
  schoolId: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string | null;
  autoGeneratePassword?: boolean; // Defaults to false
  phone?: string | null;
  employeeId?: string | null;
  qualification?: string | null;
  dob?: string | Date | null;
  mustChangePassword?: boolean;
  validateOnly?: boolean;
}

export interface CreateTeacherResult {
  teacher: Teacher & {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      role: Role;
      isActive: boolean;
      mustChangePassword: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  };
  generatedPassword?: string;
  isDryRun?: boolean;
}

export async function createTeacherCore(
  input: CreateTeacherInput,
  txClient?: Prisma.TransactionClient
): Promise<CreateTeacherResult> {
  const db = txClient ?? prisma;
  const schoolId = input.schoolId;

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  const employeeId = input.employeeId?.trim() || null;
  const qualification = input.qualification?.trim() || null;

  // 1. Required field checks (firstName, lastName, email)
  if (!firstName || !lastName || !email) {
    throw new TeacherValidationError(
      "First name, last name, email, and password are required",
      400,
      !firstName ? "firstName" : !lastName ? "lastName" : "email"
    );
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new TeacherValidationError("Invalid email address format", 400, "email");
  }

  // 2. Password handling & contract preservation
  let plainPassword = input.password?.trim() || "";
  let generatedPassword: string | undefined = undefined;
  let mustChangePassword = input.mustChangePassword ?? false;

  if (!plainPassword) {
    if (input.autoGeneratePassword === true) {
      plainPassword = generateSecurePassword(12);
      generatedPassword = plainPassword;
      mustChangePassword = input.mustChangePassword ?? true;
    } else {
      // Direct creation path without password: must fail with exact validation error
      throw new TeacherValidationError(
        "First name, last name, email, and password are required",
        400,
        "password"
      );
    }
  }

  // 3. Date of birth validation
  const { date: dob, error: dobError } = parseTeacherDob(input.dob);
  if (dobError) {
    throw new TeacherValidationError(dobError, 400, "dob");
  }

  // 4. Email uniqueness check (global across User model)
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new TeacherValidationError("Email is already registered", 409, "email");
  }

  // 5. Dry-run mode (no database writes)
  if (input.validateOnly) {
    return {
      teacher: {
        id: "dry-run-teacher-id",
        userId: "dry-run-user-id",
        schoolId,
        employeeId,
        qualification,
        dob,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "dry-run-user-id",
          firstName,
          lastName,
          email,
          phone,
          role: Role.TEACHER,
          isActive: true,
          mustChangePassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      generatedPassword,
      isDryRun: true,
    };
  }

  // 6. Live mode execution
  const hashedPassword = await hashPassword(plainPassword);

  const executeTx = async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        schoolId,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: Role.TEACHER,
        mustChangePassword,
      },
    });

    const teacher = await tx.teacher.create({
      data: {
        userId: user.id,
        schoolId,
        employeeId,
        qualification,
        dob,
      },
      select: {
        id: true,
        userId: true,
        schoolId: true,
        employeeId: true,
        qualification: true,
        dob: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return teacher;
  };

  const teacher = txClient
    ? await executeTx(txClient)
    : await prisma.$transaction(async (tx) => executeTx(tx));

  return {
    teacher,
    generatedPassword,
  };
}
