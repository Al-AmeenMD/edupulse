import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

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
        name?: string;
        level?: string;
        section?: string;
        teacherId?: string;
      };

      const name = body.name?.trim();
      const level = body.level?.trim() || undefined;
      const section = body.section?.trim() || undefined;
      const teacherId = body.teacherId?.trim() || undefined;

      if (!name) {
        return NextResponse.json(
          { error: "Class name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate class name within same school
      const existingClass = await prisma.class.findUnique({
        where: {
          schoolId_name: {
            schoolId,
            name,
          },
        },
      });

      if (existingClass) {
        return NextResponse.json(
          { error: "A class with this name already exists in this school" },
          { status: 409 }
        );
      }

      // If teacherId provided, verify teacher belongs to this school
      if (teacherId) {
        const teacher = await prisma.teacher.findUnique({
          where: { id: teacherId },
          select: { schoolId: true },
        });

        if (!teacher || teacher.schoolId !== schoolId) {
          return NextResponse.json(
            { error: "Invalid teacherId or teacher does not belong to this school" },
            { status: 400 }
          );
        }
      }

      const newClass = await prisma.class.create({
        data: {
          schoolId,
          name,
          level,
          section,
          teacherId,
        },
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({ data: newClass }, { status: 201 });
    } catch {
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
      const academicYear = searchParams.get("academicYear")?.trim();
      const search = searchParams.get("search")?.trim();

      const where: any = {
        schoolId,
      };

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

        where.teacherId = teacherRecord.id;
      }

      if (academicYear) {
        where.enrollments = {
          some: {
            academicYear,
            endedAt: null,
          },
        };
      }

      if (search) {
        where.name = {
          contains: search,
          mode: "insensitive",
        };
      }

      const classes = await prisma.class.findMany({
        where,
        orderBy: {
          name: "asc",
        },
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          _count: {
            select: {
              enrollments: {
                where: {
                  endedAt: null,
                  ...(academicYear ? { academicYear } : {}),
                },
              },
            },
          },
        },
      });

      return NextResponse.json({ data: classes }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.TEACHER]
);
