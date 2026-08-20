import { FeeType, Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

const VALID_FEE_TYPES: string[] = Object.values(FeeType);

/**
 * Helper to parse a "YYYY-MM-DD" string into a UTC Date.
 * Returns null if the string is invalid.
 */
function parseDateParam(value: string): Date | null {
  const parts = value.split("-");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(Date.UTC(year, month, day));

  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// PATCH /api/fees/structures/[id] — Edit an existing fee structure
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

      const params = await context.params;
      const id = params.id;

      if (!id) {
        return NextResponse.json(
          { error: "Fee structure ID is required" },
          { status: 400 }
        );
      }

      // 1. Verify structure exists and belongs to this school
      const existingStructure = await prisma.feeStructure.findFirst({
        where: {
          id,
          schoolId,
        },
      });

      if (!existingStructure) {
        return NextResponse.json(
          { error: "Fee structure not found" },
          { status: 404 }
        );
      }

      const body = (await req.json()) as {
        name?: string;
        type?: string;
        amount?: string | number;
        academicYear?: string;
        term?: string;
        dueDate?: string;
      };

      const name = body.name?.trim();
      const type = body.type?.trim();
      const amountRaw = body.amount !== undefined && body.amount !== null ? String(body.amount).trim() : "";
      const academicYear = body.academicYear?.trim();
      const term = body.term !== undefined ? (body.term?.trim() || null) : existingStructure.term;
      const dueDateRaw = body.dueDate?.trim();

      // --- Required field validation ---
      if (!name) {
        return NextResponse.json(
          { error: "name is required" },
          { status: 400 }
        );
      }

      if (!academicYear) {
        return NextResponse.json(
          { error: "academicYear is required" },
          { status: 400 }
        );
      }

      if (!type || !VALID_FEE_TYPES.includes(type)) {
        return NextResponse.json(
          {
            error: `Invalid fee type: ${type}. Must be one of ${VALID_FEE_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }

      if (!amountRaw) {
        return NextResponse.json(
          { error: "amount is required" },
          { status: 400 }
        );
      }

      let amountDecimal: Prisma.Decimal;
      try {
        if (!/^\d+(\.\d+)?$/.test(amountRaw)) {
          throw new Error("Invalid decimal string");
        }
        amountDecimal = new Prisma.Decimal(amountRaw);
        if (!amountDecimal.isPositive() || amountDecimal.isZero()) {
          throw new Error("Amount must be positive");
        }
      } catch {
        return NextResponse.json(
          { error: "amount must be a positive number" },
          { status: 400 }
        );
      }

      let dueDate: Date = existingStructure.dueDate;
      if (dueDateRaw) {
        const parsed = parseDateParam(dueDateRaw);
        if (!parsed) {
          return NextResponse.json(
            { error: "Invalid dueDate format, expected YYYY-MM-DD" },
            { status: 400 }
          );
        }
        dueDate = parsed;
      }

      const updatedStructure = await prisma.feeStructure.update({
        where: { id },
        data: {
          name,
          type: type as FeeType,
          amount: amountDecimal,
          academicYear,
          term,
          dueDate,
        },
        include: {
          _count: {
            select: { fees: true },
          },
        },
      });

      return NextResponse.json({ data: updatedStructure }, { status: 200 });
    } catch (err: any) {
      console.error("PATCH /api/fees/structures/[id] error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);

// ---------------------------------------------------------------------------
// DELETE /api/fees/structures/[id] — Delete a fee structure (with guard)
// ---------------------------------------------------------------------------
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

      const params = await context.params;
      const id = params.id;

      if (!id) {
        return NextResponse.json(
          { error: "Fee structure ID is required" },
          { status: 400 }
        );
      }

      // 1. Verify structure exists and belongs to this school
      const structure = await prisma.feeStructure.findFirst({
        where: {
          id,
          schoolId,
        },
        include: {
          _count: {
            select: { fees: true },
          },
        },
      });

      if (!structure) {
        return NextResponse.json(
          { error: "Fee structure not found" },
          { status: 404 }
        );
      }

      // 2. Server-side guard check: Block deletion if fee records are assigned
      const assignedCount = structure._count?.fees ?? 0;
      if (assignedCount > 0) {
        return NextResponse.json(
          {
            error: "Cannot delete this fee structure because it has existing fee records.",
            count: assignedCount,
          },
          { status: 400 }
        );
      }

      // 3. Hard delete fee structure
      await prisma.feeStructure.delete({
        where: { id },
      });

      return NextResponse.json(
        {
          data: {
            message: "Fee structure deleted successfully",
          },
        },
        { status: 200 }
      );
    } catch (err: any) {
      console.error("DELETE /api/fees/structures/[id] error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
