import { FeeStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";
import { executeFeeAssignment } from "@/lib/services/feeAssignment";

const VALID_FEE_STATUSES: string[] = Object.values(FeeStatus);

// ---------------------------------------------------------------------------
// POST /api/fees — Assign fee(s) to student(s) (Single or Multi-select)
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
        feeStructureIds?: string[];
        studentId?: string;
        studentIds?: string[];
        classId?: string;
        admissionLevel?: string;
      };

      const feeStructureId = body.feeStructureId?.trim();
      const feeStructureIds = body.feeStructureIds;
      const studentId = body.studentId?.trim();
      const studentIds = Array.isArray(body.studentIds) ? body.studentIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())) : undefined;
      const classId = body.classId?.trim();
      const admissionLevel = body.admissionLevel?.trim();

      const isMultiSelect = Array.isArray(feeStructureIds) && feeStructureIds.length > 0;
      const structureIds = isMultiSelect ? feeStructureIds : feeStructureId ? [feeStructureId] : [];

      if (structureIds.length === 0) {
        return NextResponse.json(
          { error: "feeStructureId or feeStructureIds is required" },
          { status: 400 }
        );
      }

      if (!studentId && (!studentIds || studentIds.length === 0) && !classId && !admissionLevel) {
        return NextResponse.json(
          { error: "Either studentId, studentIds, classId, or admissionLevel is required" },
          { status: 400 }
        );
      }

      const summary = await executeFeeAssignment({
        schoolId,
        feeStructureIds: structureIds,
        studentId,
        studentIds,
        classId,
        admissionLevel,
      });

      // -----------------------------------------------------------------
      // Multi-Structure Response
      // -----------------------------------------------------------------
      if (isMultiSelect) {
        return NextResponse.json({ data: summary }, { status: 201 });
      }

      // -----------------------------------------------------------------
      // Backward Compatibility: Single Structure Responses
      // -----------------------------------------------------------------
      const singleResult = summary.results[0];

      if (studentId && !classId && !admissionLevel && (!studentIds || studentIds.length === 0)) {
        if (summary.totalFeesCreated === 0 && summary.totalFeesSkipped > 0) {
          return NextResponse.json(
            { error: "Fee already assigned to this student for this fee structure" },
            { status: 409 }
          );
        }
        return NextResponse.json({ data: singleResult?.fees[0] }, { status: 201 });
      }

      if (summary.targetMode === "multiple") {
        if (summary.totalFeesCreated === 0 && summary.totalFeesSkipped > 0) {
          return NextResponse.json(
            { error: "Fee already assigned to all selected students for this fee structure" },
            { status: 409 }
          );
        }
        return NextResponse.json(
          {
            data: singleResult?.fees || [],
            summary: {
              totalStudents: summary.totalTargetStudents,
              assigned: summary.totalFeesCreated,
              skipped: summary.totalFeesSkipped,
            },
          },
          { status: 201 }
        );
      }

      if (classId && !admissionLevel) {
        if (summary.totalFeesCreated === 0 && summary.totalFeesSkipped > 0) {
          return NextResponse.json(
            { error: "Fee already assigned to all students in this class" },
            { status: 409 }
          );
        }
        return NextResponse.json(
          {
            data: singleResult?.fees || [],
            summary: {
              totalStudents: summary.totalTargetStudents,
              assigned: summary.totalFeesCreated,
              skipped: summary.totalFeesSkipped,
            },
          },
          { status: 201 }
        );
      }

      if (admissionLevel) {
        if (summary.totalFeesCreated === 0 && summary.totalFeesSkipped > 0) {
          return NextResponse.json(
            { error: `Fee structure already assigned to all students with admission level '${admissionLevel}'` },
            { status: 409 }
          );
        }
        return NextResponse.json(
          {
            data: singleResult?.fees || [],
            summary: {
              totalStudents: summary.totalTargetStudents,
              assigned: summary.totalFeesCreated,
              skipped: summary.totalFeesSkipped,
            },
          },
          { status: 201 }
        );
      }

      return NextResponse.json({ data: summary }, { status: 201 });
    } catch (err: any) {
      if (err.name === "FeeAssignmentError") {
        return NextResponse.json(
          { error: err.message },
          { status: err.statusCode || 400 }
        );
      }
      console.error("POST /api/fees error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
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
      const term = searchParams.get("term");
      const classId = searchParams.get("classId");
      const admissionLevel = searchParams.get("admissionLevel");
      const paidFrom = searchParams.get("paidFrom");
      const paidTo = searchParams.get("paidTo");

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

      if ((academicYear && academicYear !== "ALL") || (term && term !== "ALL")) {
        where.feeStructure = {
          ...(where.feeStructure as object || {}),
          ...(academicYear && academicYear !== "ALL" ? { academicYear } : {}),
          ...(term && term !== "ALL" ? { term } : {}),
        };
      }

      if (admissionLevel && admissionLevel !== "ALL") {
        where.student = {
          ...(where.student as object || {}),
          admissionLevel,
        };
      }

      if (paidFrom || paidTo) {
        const paidAtFilter: Record<string, Date> = {};
        if (paidFrom) {
          paidAtFilter.gte = new Date(`${paidFrom}T00:00:00.000Z`);
        }
        if (paidTo) {
          paidAtFilter.lte = new Date(`${paidTo}T23:59:59.999Z`);
        }
        where.payments = {
          some: {
            paidAt: paidAtFilter,
          },
        };
      }

      let fees = await prisma.fee.findMany({
        where,
        orderBy: { dueDate: "asc" },
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
              admissionLevel: true,
              classEnrollments: {
                select: {
                  class: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
                take: 1,
                orderBy: { enrolledAt: "desc" },
              },
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
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              reference: true,
              receiptNumber: true,
              paidAt: true,
            },
            orderBy: { paidAt: "desc" },
          },
        },
      });

      // Filter by current active class if classId filter provided (FIX-008 & FIX-015)
      if (classId) {
        fees = fees.filter(
          (f) => f.student?.classEnrollments?.[0]?.class?.id === classId
        );
      }

      return NextResponse.json({ data: fees }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
