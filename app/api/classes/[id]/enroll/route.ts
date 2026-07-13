import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const POST = withAuth(
  async (req, context) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { id } = (await context.params) as Awaited<RouteContext["params"]>;
      const body = (await req.json()) as {
        studentId?: string;
      };

      const studentId = body.studentId?.trim();

      if (!studentId) {
        return NextResponse.json(
          { error: "Student ID is required" },
          { status: 400 }
        );
      }

      // Verify class exists and belongs to this school
      const classRecord = await prisma.class.findUnique({
        where: { id },
        select: { schoolId: true },
      });

      if (!classRecord || classRecord.schoolId !== schoolId) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }

      // Verify student exists and belongs to this school
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { schoolId: true },
      });

      if (!student || student.schoolId !== schoolId) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      // Check student not already enrolled in this class
      const existingEnrollment = await prisma.classEnrollment.findUnique({
        where: {
          studentId_classId: {
            studentId,
            classId: id,
          },
        },
      });

      if (existingEnrollment) {
        return NextResponse.json(
          { error: "Student is already enrolled in this class" },
          { status: 409 }
        );
      }

      const enrollment = await prisma.classEnrollment.create({
        data: {
          studentId,
          classId: id,
        },
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });

      return NextResponse.json({ data: enrollment }, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);

export const DELETE = withAuth(
  async (req, context) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { id } = (await context.params) as Awaited<RouteContext["params"]>;
      const body = (await req.json()) as {
        studentId?: string;
      };

      const studentId = body.studentId?.trim();

      if (!studentId) {
        return NextResponse.json(
          { error: "Student ID is required" },
          { status: 400 }
        );
      }

      // Verify class exists and belongs to this school
      const classRecord = await prisma.class.findUnique({
        where: { id },
        select: { schoolId: true },
      });

      if (!classRecord || classRecord.schoolId !== schoolId) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }

      // Verify student exists and belongs to this school
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { schoolId: true },
      });

      if (!student || student.schoolId !== schoolId) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      // Check enrollment exists and delete it
      try {
        await prisma.classEnrollment.delete({
          where: {
            studentId_classId: {
              studentId,
              classId: id,
            },
          },
        });
      } catch {
        return NextResponse.json(
          { error: "Enrollment not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { message: "Student removed from class" },
        { status: 200 }
      );
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
