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
        sessionId?: string;
        academicYear?: string;
        termId?: string;
        term?: string;
        dueDate?: string;
      };

      const name = body.name?.trim();
      const type = body.type?.trim();
      const amount = body.amount;
      const rawSession = body.sessionId?.trim() || body.academicYear?.trim();
      const rawTerm = body.termId?.trim() || body.term?.trim() || null;
      const dueDateRaw = body.dueDate?.trim();

      // --- Required field validation ---
      if (!name || !type || amount === undefined || amount === null || !rawSession || !dueDateRaw) {
        return NextResponse.json(
          { error: "name, type, amount, sessionId (or academicYear), and dueDate are required" },
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

      // Resolve academic session
      const session = await prisma.academicSession.findFirst({
        where: {
          schoolId,
          OR: [{ id: rawSession }, { name: rawSession }],
        },
        include: { terms: true },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Academic session not found in this school" },
          { status: 404 }
        );
      }

      let termId: string | null = null;
      if (rawTerm) {
        const foundTerm = session.terms.find(
          (t) =>
            t.id === rawTerm ||
            t.name.toLowerCase() === rawTerm.toLowerCase() ||
            (rawTerm === "1" && t.name.includes("First")) ||
            (rawTerm === "2" && t.name.includes("Second")) ||
            (rawTerm === "3" && t.name.includes("Third"))
        );
        termId = foundTerm ? foundTerm.id : null;
      }

      const feeStructure = await prisma.feeStructure.create({
        data: {
          schoolId,
          name,
          type: type as FeeType,
          amount,
          sessionId: session.id,
          termId,
          dueDate,
        },
        include: {
          session: true,
          term: true,
        },
      });

      return NextResponse.json({ data: feeStructure }, { status: 201 });
    } catch (err: any) {
      console.error("POST /api/fees/structures error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
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
      const sessionId = searchParams.get("sessionId") || searchParams.get("academicYear");
      const termId = searchParams.get("termId") || searchParams.get("term");
      const type = searchParams.get("type");

      // Build where clause
      const where: Record<string, unknown> = { schoolId };

      if (sessionId && sessionId !== "ALL") {
        where.OR = [
          { sessionId },
          { session: { name: sessionId } },
        ];
      }

      if (type && type !== "ALL" && VALID_FEE_TYPES.includes(type)) {
        where.type = type as FeeType;
      }

      if (termId && termId !== "ALL") {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          {
            OR: [
              { termId },
              { term: { name: termId } },
            ],
          },
        ];
      }

      const feeStructures = await prisma.feeStructure.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          session: true,
          term: true,
          _count: {
            select: { fees: true },
          },
        },
      });

      return NextResponse.json({ data: feeStructures }, { status: 200 });
    } catch (err: any) {
      console.error("GET /api/fees/structures error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
