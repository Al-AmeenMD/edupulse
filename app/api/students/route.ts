import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

function generateStudentId(
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

export const POST = withAuth(
  async (req) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const body = (await req.json()) as {
        firstName?: string;
        lastName?: string;
        dateOfBirth?: string;
        gender?: string;
        address?: string;
        admissionLevel?: string;
        guardianName?: string;
        guardianPhone?: string;
        guardianEmail?: string;
      };

      const firstName = body.firstName?.trim();
      const lastName = body.lastName?.trim();
      const gender = body.gender?.trim() || undefined;
      const address = body.address?.trim() || undefined;
      const guardianName = body.guardianName?.trim() || undefined;
      const guardianPhone = body.guardianPhone?.trim() || undefined;
      const guardianEmail = body.guardianEmail?.trim() || undefined;

      if (!firstName || !lastName) {
        return NextResponse.json(
          { error: "First name and last name are required" },
          { status: 400 }
        );
      }

      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { studentIdTemplate: true, studentIdPrefix: true },
      });

      if (!school) {
        return NextResponse.json(
          { error: "School not found" },
          { status: 404 }
        );
      }

      const template = school.studentIdTemplate || "{PREFIX}/{YEAR}/{SEQ:3}";
      const prefix = school.studentIdPrefix || "STU";
      const hasLevelToken = template.includes("{LEVEL}");
      const hasYearToken = template.includes("{YEAR}");

      const admissionLevelInput = body.admissionLevel?.trim();

      if (hasLevelToken && !admissionLevelInput) {
        return NextResponse.json(
          { error: "admissionLevel is required for this school's ID format" },
          { status: 400 }
        );
      }

      const admissionLevel = hasLevelToken ? admissionLevelInput : null;
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

      const count = await prisma.student.count({
        where: whereCount,
      });

      const studentId = generateStudentId(template, {
        prefix,
        year: String(currentYear),
        level: admissionLevel || "",
        seq: count + 1,
      });

      const student = await prisma.student.create({
        data: {
          schoolId,
          studentId,
          firstName,
          lastName,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
          gender,
          address,
          admissionLevel,
          guardianName,
          guardianPhone,
          guardianEmail,
        },
      });

      return NextResponse.json({ data: student }, { status: 201 });
    } catch (error: any) {
      if (error?.code === "P2002") {
        return NextResponse.json(
          { error: "ID generation conflict — please try again" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);

export const GET = withAuth(
  async (req) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search")?.trim();
      const isActiveParam = searchParams.get("isActive");
      const classId = searchParams.get("classId")?.trim();

      const where: any = {
        schoolId,
      };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { studentId: { contains: search, mode: "insensitive" } },
        ];
      }

      if (isActiveParam === "true") {
        where.isActive = true;
      } else if (isActiveParam === "false") {
        where.isActive = false;
      }

      if (req.user.role === Role.TEACHER) {
        const teacherRecord = await prisma.teacher.findUnique({
          where: { userId: req.user.userId },
          select: { id: true },
        });

        if (!teacherRecord) {
          return NextResponse.json(
            { error: "Teacher profile not found" },
            { status: 404 }
          );
        }

        const enrollmentFilter: any = {
          class: {
            teacherId: teacherRecord.id,
          },
        };

        if (classId) {
          enrollmentFilter.classId = classId;
        }

        where.classEnrollments = {
          some: enrollmentFilter,
        };
      } else if (classId) {
        where.classEnrollments = {
          some: {
            classId,
          },
        };
      }

      const students = await prisma.student.findMany({
        where,
        orderBy: {
          firstName: "asc",
        },
        include: {
          classEnrollments: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  level: true,
                  section: true,
                  academicYear: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({ data: students }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.TEACHER]
);
