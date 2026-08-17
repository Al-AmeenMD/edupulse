import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

export const PATCH = withAuth(
  async (req, context) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const params = await context.params;
      const id = params.id;

      if (!id) {
        return NextResponse.json(
          { error: "Class ID is required" },
          { status: 400 }
        );
      }

      // 1. Verify class exists and belongs to this school
      const existingClass = await prisma.class.findFirst({
        where: {
          id,
          schoolId,
        },
      });

      if (!existingClass) {
        return NextResponse.json(
          { error: "Class not found" },
          { status: 404 }
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
      const level = body.level !== undefined ? (body.level?.trim() || null) : existingClass.level;
      const section = body.section !== undefined ? (body.section?.trim() || null) : existingClass.section;
      const academicYear = body.academicYear?.trim();
      const teacherIdInput = body.teacherId !== undefined ? body.teacherId?.trim() : existingClass.teacherId;
      const teacherId = teacherIdInput || null;

      // 2. Validate required fields
      if (!name || !academicYear) {
        return NextResponse.json(
          { error: "Name and academic year are required" },
          { status: 400 }
        );
      }

      // 3. Check duplicate class name within same school + academicYear (excluding current class)
      const duplicateClass = await prisma.class.findFirst({
        where: {
          schoolId,
          name,
          academicYear,
          NOT: {
            id,
          },
        },
      });

      if (duplicateClass) {
        return NextResponse.json(
          { error: "Class already exists in this school for this academic year" },
          { status: 409 }
        );
      }

      // 4. Validate teacherId if provided
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

      // 5. Update class
      const updatedClass = await prisma.class.update({
        where: { id },
        data: {
          name,
          level,
          section,
          academicYear,
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
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      });

      return NextResponse.json({ data: updatedClass }, { status: 200 });
    } catch (err: any) {
      console.error("PATCH /api/classes/[id] error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
