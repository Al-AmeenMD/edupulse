import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

import {
  createStudentCore,
  StudentValidationError,
} from "@/lib/services/studentService";

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
        studentId?: string;
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

      const { student } = await createStudentCore({
        schoolId,
        studentId: body.studentId,
        firstName: body.firstName || "",
        lastName: body.lastName || "",
        dateOfBirth: body.dateOfBirth,
        gender: body.gender,
        address: body.address,
        admissionLevel: body.admissionLevel,
        guardianName: body.guardianName,
        guardianPhone: body.guardianPhone,
        guardianEmail: body.guardianEmail,
      });

      return NextResponse.json({ data: student }, { status: 201 });
    } catch (error: any) {
      if (error instanceof StudentValidationError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
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

      const pageParam = searchParams.get("page");
      const limitParam = searchParams.get("limit");
      const isExplicitlyPaginated = pageParam !== null || limitParam !== null;

      const UNPAGINATED_SAFETY_CEILING = 1000;
      const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
      const rawLimit = parseInt(limitParam || "50", 10) || 50;
      const limit = isExplicitlyPaginated
        ? Math.min(Math.max(1, rawLimit), 200)
        : UNPAGINATED_SAFETY_CEILING;
      const skip = isExplicitlyPaginated ? (page - 1) * limit : 0;

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
          endedAt: null,
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
            endedAt: null,
          },
        };
      }

      const [students, totalCount] = await Promise.all([
        prisma.student.findMany({
          where,
          orderBy: {
            firstName: "asc",
          },
          take: limit,
          skip,
          include: {
            classEnrollments: {
              where: { endedAt: null },
              take: 1,
              orderBy: { enrolledAt: "desc" },
              include: {
                class: {
                  select: {
                    id: true,
                    name: true,
                    level: true,
                  },
                },
              },
            },
          },
        }),
        prisma.student.count({ where }),
      ]);

      if (isExplicitlyPaginated) {
        return NextResponse.json(
          {
            data: students,
            pagination: {
              page,
              limit,
              totalItems: totalCount,
              totalPages: Math.ceil(totalCount / limit),
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          data: students,
          totalCount,
          isTruncated: totalCount > UNPAGINATED_SAFETY_CEILING,
        },
        { status: 200 }
      );
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN, Role.TEACHER]
);
