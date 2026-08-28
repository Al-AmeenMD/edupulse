import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/middleware/withAuth";

export const GET = withAuth(
  async (
    req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } },
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json({ error: "School context required" }, { status: 400 });
      }

      const { id } = await context.params;

      const budget = await prisma.budget.findFirst({
        where: {
          id,
          schoolId,
        },
        include: {
          auditLogs: {
            orderBy: { changedAt: "asc" },
          },
        },
      });

      if (!budget) {
        return NextResponse.json({ error: "Budget not found" }, { status: 404 });
      }

      // Batch resolve user names for changedBy field with tenant isolation
      const changedByIds = Array.from(
        new Set(budget.auditLogs.map((log) => log.changedBy).filter(Boolean))
      );

      const users =
        changedByIds.length > 0
          ? await prisma.user.findMany({
              where: {
                id: { in: changedByIds },
                schoolId,
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            })
          : [];

      const userMap = new Map(
        users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()])
      );

      const formattedHistory = budget.auditLogs.map((log) => ({
        id: log.id,
        changedBy: userMap.get(log.changedBy) || log.changedBy,
        changedAt: log.changedAt.toISOString(),
        previousAmount: log.previousAmount
          ? new Prisma.Decimal(log.previousAmount).toFixed(2)
          : null,
        newAmount: new Prisma.Decimal(log.newAmount).toFixed(2),
      }));

      return NextResponse.json(
        {
          data: {
            budget: {
              id: budget.id,
              academicYear: budget.academicYear,
              term: budget.term,
              amount: new Prisma.Decimal(budget.amount).toFixed(2),
            },
            history: formattedHistory,
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("GET /api/budgets/:id/history error:", error);
      return NextResponse.json({ error: "Failed to fetch budget history" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
