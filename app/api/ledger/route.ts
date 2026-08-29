import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withAuth } from "@/lib/middleware/withAuth";
import { getUnifiedLedger, LedgerQueryOptions } from "@/lib/services/ledgerService";

// ---------------------------------------------------------------------------
// GET /api/ledger — Unified Financial Ledger Projection
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } }) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);

      const typeParam = searchParams.get("type")?.trim().toUpperCase();
      const validTypes = ["ALL", "PAYMENT", "EXPENSE", "BUDGET_CHANGE"];
      const type = validTypes.includes(typeParam || "")
        ? (typeParam as LedgerQueryOptions["type"])
        : "ALL";

      const startDate = searchParams.get("startDate")?.trim() || searchParams.get("dateFrom")?.trim() || undefined;
      const endDate = searchParams.get("endDate")?.trim() || searchParams.get("dateTo")?.trim() || undefined;
      const category = searchParams.get("category")?.trim() || undefined;
      const search = searchParams.get("search")?.trim() || undefined;

      const pageParam = parseInt(searchParams.get("page") || "1", 10);
      const limitParam = parseInt(searchParams.get("limit") || "20", 10);
      const sortOrderParam = searchParams.get("sortOrder")?.trim().toLowerCase();
      const sortOrder = sortOrderParam === "asc" ? "asc" : "desc";

      const ledgerResult = await getUnifiedLedger(schoolId, {
        type,
        startDate,
        endDate,
        category,
        search,
        page: isNaN(pageParam) ? 1 : pageParam,
        limit: isNaN(limitParam) ? 20 : limitParam,
        sortOrder,
      });

      return NextResponse.json(ledgerResult, { status: 200 });
    } catch (error: any) {
      console.error("GET /api/ledger error:", error);
      return NextResponse.json(
        { error: "Internal server error while fetching financial ledger" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
