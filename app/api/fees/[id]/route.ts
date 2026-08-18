import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// Map of allowed target statuses per current status for manual status corrections (FIX-017)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["OVERDUE", "WAIVED"],
  OVERDUE: ["PENDING", "WAIVED"],
  WAIVED: ["PENDING", "OVERDUE"],
  PARTIAL: ["PENDING"],
};

// ---------------------------------------------------------------------------
// GET /api/fees/:id — Get fee details
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (_req, context) => {
    try {
      const schoolId = _req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { id } = (await context.params) as Awaited<
        RouteContext["params"]
      >;

      const fee = await prisma.fee.findUnique({
        where: { id },
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
                    select: { id: true, name: true },
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
            orderBy: { paidAt: "desc" },
          },
        },
      });

      if (!fee || fee.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Fee not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ data: fee }, { status: 200 });
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
// PATCH /api/fees/:id — Update note or manual status correction (FIX-017)
// ---------------------------------------------------------------------------
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

      const { id } = (await context.params) as Awaited<
        RouteContext["params"]
      >;

      const body = (await req.json()) as {
        note?: string;
        status?: string;
      };

      // --- Verify fee exists and belongs to this school ---
      const fee = await prisma.fee.findUnique({
        where: { id },
        select: {
          id: true,
          schoolId: true,
          status: true,
          note: true,
        },
      });

      if (!fee || fee.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Fee not found" },
          { status: 404 }
        );
      }

      // Build update payload
      const updateData: Record<string, unknown> = {};

      // --- Status change logic ---
      if (body.status !== undefined) {
        const newStatus = body.status.trim().toUpperCase();
        const currentStatus = fee.status;

        // Reason validation: note/reason must be a non-empty string when status changes
        const reason = body.note?.trim();
        if (!reason || reason.length === 0) {
          return NextResponse.json(
            { error: "A reason is required when changing fee status" },
            { status: 400 }
          );
        }

        // Rejection rule 1: Target status is PAID
        if (newStatus === "PAID") {
          return NextResponse.json(
            { error: "Cannot manually set status to PAID. Record a payment instead." },
            { status: 400 }
          );
        }

        // Rejection rule 2: Target status is PARTIAL
        if (newStatus === "PARTIAL") {
          return NextResponse.json(
            { error: "Cannot manually set status to PARTIAL. Record a payment instead." },
            { status: 400 }
          );
        }

        // Rejection rule 3: Source status is PAID
        if (currentStatus === "PAID") {
          return NextResponse.json(
            { error: "Cannot manually change status of a fully paid fee. Fully paid fees are locked to preserve payment audit integrity." },
            { status: 400 }
          );
        }

        // Check transition matrix
        const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
        if (!allowedTargets.includes(newStatus)) {
          return NextResponse.json(
            { error: `Status transition from ${currentStatus} to ${newStatus} is not allowed.` },
            { status: 400 }
          );
        }

        updateData.status = newStatus;
        updateData.note = reason;
      } else if (body.note !== undefined) {
        // Simple note update without status change
        updateData.note = body.note.trim() || null;
      }

      // --- Nothing to update ---
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: "No valid fields to update. Provide note or status." },
          { status: 400 }
        );
      }

      const updatedFee = await prisma.fee.update({
        where: { id },
        data: updateData,
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
                  class: { select: { id: true, name: true } },
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
            orderBy: { paidAt: "desc" },
          },
        },
      });

      return NextResponse.json({ data: updatedFee }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
