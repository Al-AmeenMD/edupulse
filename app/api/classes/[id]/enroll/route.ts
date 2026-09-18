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
        academicYear?: string;
        sessionId?: string;
        term?: string;
        termId?: string;
      };

      const studentId = body.studentId?.trim();
      let targetSession = body.sessionId?.trim() || body.academicYear?.trim();
      let targetTerm = body.termId?.trim() || body.term?.trim() || null;

      if (!studentId) {
        return NextResponse.json(
          { error: "Student ID is required" },
          { status: 400 }
        );
      }

      // Resolve academic session
      let session = null;
      if (targetSession) {
        session = await prisma.academicSession.findFirst({
          where: {
            schoolId,
            OR: [{ id: targetSession }, { name: targetSession }],
          },
          include: { terms: true },
        });
      } else {
        session = await prisma.academicSession.findFirst({
          where: { schoolId, isCurrent: true },
          include: { terms: true },
        });
      }

      if (!session) {
        return NextResponse.json(
          { error: "Academic session not found or no active session configured" },
          { status: 400 }
        );
      }

      let term = null;
      if (targetTerm) {
        term =
          session.terms.find((t) => t.id === targetTerm) ||
          session.terms.find((t) => t.name.toLowerCase() === targetTerm?.toLowerCase()) ||
          null;
      } else {
        term = session.terms.find((t) => t.isCurrent) || null;
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

      // Check student not already actively enrolled in any class
      const existingEnrollment = await prisma.classEnrollment.findFirst({
        where: { studentId, endedAt: null },
        include: {
          class: {
            select: { id: true, name: true },
          },
        },
      });

      if (existingEnrollment) {
        if (existingEnrollment.classId === id) {
          return NextResponse.json(
            { error: "Student is already enrolled in this class" },
            { status: 409 }
          );
        } else {
          return NextResponse.json(
            { error: `Student is already enrolled in class ${existingEnrollment.class.name}` },
            { status: 409 }
          );
        }
      }

      const enrollment = await prisma.classEnrollment.create({
        data: {
          studentId,
          classId: id,
          sessionId: session.id,
          termId: term?.id || null,
          endedAt: null,
        },
        include: {
          session: true,
          term: true,
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

      // Find active enrollment and mark endedAt
      const activeEnrollment = await prisma.classEnrollment.findFirst({
        where: {
          studentId,
          classId: id,
          endedAt: null,
        },
      });

      if (!activeEnrollment) {
        return NextResponse.json(
          { error: "Active enrollment not found for this student and class" },
          { status: 404 }
        );
      }

      await prisma.classEnrollment.update({
        where: { id: activeEnrollment.id },
        data: { endedAt: new Date() },
      });

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
