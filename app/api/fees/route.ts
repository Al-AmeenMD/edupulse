import { FeeStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

const VALID_FEE_STATUSES: string[] = Object.values(FeeStatus);

// ---------------------------------------------------------------------------
// POST /api/fees — Assign fee(s) to student(s)
// ---------------------------------------------------------------------------
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
        feeStructureId?: string;
        studentId?: string;
        classId?: string;
      };

      const feeStructureId = body.feeStructureId?.trim();
      const studentId = body.studentId?.trim();
      const classId = body.classId?.trim();

      // --- Required field validation ---
      if (!feeStructureId) {
        return NextResponse.json(
          { error: "feeStructureId is required" },
          { status: 400 }
        );
      }

      if (!studentId && !classId) {
        return NextResponse.json(
          { error: "Either studentId or classId is required" },
          { status: 400 }
        );
      }

      // --- Verify fee structure exists and belongs to this school ---
      const feeStructure = await prisma.feeStructure.findUnique({
        where: { id: feeStructureId },
        select: {
          id: true,
          schoolId: true,
          amount: true,
          dueDate: true,
        },
      });

      if (!feeStructure || feeStructure.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Fee structure not found" },
          { status: 404 }
        );
      }

      const amountDue = feeStructure.amount;
      const dueDate = feeStructure.dueDate;

      // -----------------------------------------------------------------
      // Option 1: Single student assignment
      // -----------------------------------------------------------------
      if (studentId && !classId) {
        // Verify student belongs to this school
        const student = await prisma.student.findFirst({
          where: { id: studentId, schoolId },
          select: { id: true },
        });

        if (!student) {
          return NextResponse.json(
            { error: "Student not found" },
            { status: 404 }
          );
        }

        // Check for duplicate — skip if student already has a fee for this structure
        const existingFee = await prisma.fee.findFirst({
          where: {
            schoolId,
            studentId,
            feeStructureId,
          },
        });

        if (existingFee) {
          return NextResponse.json(
            { error: "Fee already assigned to this student for this fee structure" },
            { status: 409 }
          );
        }

        const fee = await prisma.fee.create({
          data: {
            schoolId,
            studentId,
            feeStructureId,
            amountDue,
            dueDate,
            status: "PENDING",
          },
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
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
        });

        return NextResponse.json({ data: fee }, { status: 201 });
      }

      // -----------------------------------------------------------------
      // Option 2: Bulk assign to all students enrolled in a class
      // -----------------------------------------------------------------
      if (classId) {
        // Verify class belongs to this school
        const classRecord = await prisma.class.findFirst({
          where: { id: classId, schoolId },
          select: { id: true },
        });

        if (!classRecord) {
          return NextResponse.json(
            { error: "Class not found" },
            { status: 404 }
          );
        }

        // Get all enrolled students in the class
        const enrollments = await prisma.classEnrollment.findMany({
          where: { classId },
          select: { studentId: true },
        });

        if (enrollments.length === 0) {
          return NextResponse.json(
            { error: "No students enrolled in this class" },
            { status: 400 }
          );
        }

        const enrolledStudentIds = enrollments.map((e) => e.studentId);

        // Find students who already have a fee for this structure (to skip)
        const existingFees = await prisma.fee.findMany({
          where: {
            schoolId,
            feeStructureId,
            studentId: { in: enrolledStudentIds },
          },
          select: { studentId: true },
        });

        const alreadyAssigned = new Set(existingFees.map((f) => f.studentId));

        // Filter to only students without an existing fee
        const newStudentIds = enrolledStudentIds.filter(
          (id) => !alreadyAssigned.has(id)
        );

        if (newStudentIds.length === 0) {
          return NextResponse.json(
            { error: "Fee already assigned to all students in this class" },
            { status: 409 }
          );
        }

        // Bulk create in a transaction
        const createOperations = newStudentIds.map((sid) =>
          prisma.fee.create({
            data: {
              schoolId,
              studentId: sid,
              feeStructureId,
              amountDue,
              dueDate,
              status: "PENDING",
            },
            include: {
              student: {
                select: {
                  id: true,
                  studentId: true,
                  firstName: true,
                  lastName: true,
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

        const createdFees = await prisma.$transaction(createOperations);

        return NextResponse.json(
          {
            data: createdFees,
            summary: {
              totalEnrolled: enrolledStudentIds.length,
              assigned: createdFees.length,
              skipped: alreadyAssigned.size,
            },
          },
          { status: 201 }
        );
      }

      // Should never reach here, but safety net
      return NextResponse.json(
        { error: "Either studentId or classId is required" },
        { status: 400 }
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

// ---------------------------------------------------------------------------
// GET /api/fees — List fees for the school
// ---------------------------------------------------------------------------
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
      const studentId = searchParams.get("studentId");
      const status = searchParams.get("status");
      const feeStructureId = searchParams.get("feeStructureId");
      const academicYear = searchParams.get("academicYear");

      // Build where clause
      const where: Record<string, unknown> = { schoolId };

      if (studentId) {
        where.studentId = studentId;
      }

      if (status && VALID_FEE_STATUSES.includes(status)) {
        where.status = status as FeeStatus;
      }

      if (feeStructureId) {
        where.feeStructureId = feeStructureId;
      }

      if (academicYear) {
        where.feeStructure = { academicYear };
      }

      const fees = await prisma.fee.findMany({
        where,
        orderBy: { dueDate: "asc" },
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
            },
          },
          feeStructure: {
            select: {
              id: true,
              name: true,
              type: true,
              amount: true,
              academicYear: true,
              term: true,
            },
          },
        },
      });

      return NextResponse.json({ data: fees }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
