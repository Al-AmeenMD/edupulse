import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
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
// PATCH /api/fees/:id — Update note or waive/overdue a fee
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
        },
      });

      if (!fee || fee.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Fee not found" },
          { status: 404 }
        );
      }

      // Build the update data
      const updateData: Record<string, unknown> = {};

      // --- Note can always be updated ---
      if (body.note !== undefined) {
        updateData.note = body.note.trim() || null;
      }

      // --- Status change logic ---
      if (body.status !== undefined) {
        const newStatus = body.status.trim().toUpperCase();

        // Cannot manually set status to PAID — only payments do that
        if (newStatus === "PAID") {
          return NextResponse.json(
            { error: "Cannot manually set status to PAID. Record a payment instead." },
            { status: 400 }
          );
        }

        // Cannot set status to PARTIAL — only payments do that
        if (newStatus === "PARTIAL") {
          return NextResponse.json(
            { error: "Cannot manually set status to PARTIAL. Record a payment instead." },
            { status: 400 }
          );
        }

        // Cannot set status to PENDING — use this only as a reset, not exposed
        if (newStatus === "PENDING") {
          return NextResponse.json(
            { error: "Cannot manually set status to PENDING" },
            { status: 400 }
          );
        }

        if (newStatus === "WAIVED") {
          // Can only waive if PENDING or PARTIAL
          if (fee.status === "PAID") {
            return NextResponse.json(
              { error: "Cannot waive a fully paid fee" },
              { status: 400 }
            );
          }
          if (fee.status === "WAIVED") {
            return NextResponse.json(
              { error: "Fee is already waived" },
              { status: 400 }
            );
          }
          if (fee.status !== "PENDING" && fee.status !== "PARTIAL" && fee.status !== "OVERDUE") {
            return NextResponse.json(
              { error: "Fee can only be waived when PENDING, PARTIAL, or OVERDUE" },
              { status: 400 }
            );
          }
          updateData.status = "WAIVED";
        } else if (newStatus === "OVERDUE") {
          // Can only mark overdue if PENDING or PARTIAL
          if (fee.status === "PAID") {
            return NextResponse.json(
              { error: "Cannot mark a fully paid fee as overdue" },
              { status: 400 }
            );
          }
          if (fee.status === "WAIVED") {
            return NextResponse.json(
              { error: "Cannot mark a waived fee as overdue" },
              { status: 400 }
            );
          }
          if (fee.status !== "PENDING" && fee.status !== "PARTIAL") {
            return NextResponse.json(
              { error: "Fee can only be marked overdue when PENDING or PARTIAL" },
              { status: 400 }
            );
          }
          updateData.status = "OVERDUE";
        } else {
          return NextResponse.json(
            { error: `Invalid status: ${body.status}. Allowed values: WAIVED, OVERDUE` },
            { status: 400 }
          );
        }
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
