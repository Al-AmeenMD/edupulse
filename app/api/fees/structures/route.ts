import { FeeType, Role } from "@prisma/client";
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
// POST /api/fees/structures — Create a new fee structure
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
        name?: string;
        type?: string;
        amount?: number;
        academicYear?: string;
        term?: string;
        dueDate?: string;
      };

      const name = body.name?.trim();
      const type = body.type?.trim();
      const amount = body.amount;
      const academicYear = body.academicYear?.trim();
      const term = body.term?.trim() || null;
      const dueDateRaw = body.dueDate?.trim();

      // --- Required field validation ---
      if (!name || !type || amount === undefined || amount === null || !academicYear || !dueDateRaw) {
        return NextResponse.json(
          { error: "name, type, amount, academicYear, and dueDate are required" },
          { status: 400 }
        );
      }

      // --- FeeType enum validation ---
      if (!VALID_FEE_TYPES.includes(type)) {
        return NextResponse.json(
          {
            error: `Invalid fee type: ${type}. Must be one of ${VALID_FEE_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // --- Amount validation ---
      if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "amount must be a positive number" },
          { status: 400 }
        );
      }

      // --- Date validation ---
      const dueDate = parseDateParam(dueDateRaw);
      if (!dueDate) {
        return NextResponse.json(
          { error: "Invalid dueDate format, expected YYYY-MM-DD" },
          { status: 400 }
        );
      }

      const feeStructure = await prisma.feeStructure.create({
        data: {
          schoolId,
          name,
          type: type as FeeType,
          amount,
          academicYear,
          term,
          dueDate,
        },
      });

      return NextResponse.json({ data: feeStructure }, { status: 201 });
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
// GET /api/fees/structures — List fee structures for the school
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
      const academicYear = searchParams.get("academicYear");
      const type = searchParams.get("type");
      const term = searchParams.get("term");

      // Build where clause
      const where: Record<string, unknown> = { schoolId };

      if (academicYear) {
        where.academicYear = academicYear;
      }

      if (type && VALID_FEE_TYPES.includes(type)) {
        where.type = type as FeeType;
      }

      if (term) {
        where.term = term;
      }

      const feeStructures = await prisma.feeStructure.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { fees: true },
          },
        },
      });

      return NextResponse.json({ data: feeStructures }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
