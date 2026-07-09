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
        academicYear?: string;
      };

      const name = body.name?.trim();
      const level = body.level?.trim() || undefined;
      const section = body.section?.trim() || undefined;
      const teacherId = body.teacherId?.trim() || undefined;
      const academicYear = body.academicYear?.trim();

      if (!name || !academicYear) {
        return NextResponse.json(
          { error: "Name and academic year are required" },
          { status: 400 }
        );
      }

      // Check for duplicate class name within same school + academicYear
      const existingClass = await prisma.class.findUnique({
        where: {
          schoolId_name_academicYear: {
            schoolId,
            name,
            academicYear,
          },
        },
      });

      if (existingClass) {
        return NextResponse.json(
          { error: "Class already exists in this school for this academic year" },
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
          academicYear,
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
        where.academicYear = academicYear;
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
              enrollments: true,
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
