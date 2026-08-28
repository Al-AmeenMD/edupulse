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
      });

      if (!budget) {
        return NextResponse.json({ error: "Budget not found" }, { status: 404 });
      }

      return NextResponse.json(
        {
          data: {
            id: budget.id,
            schoolId: budget.schoolId,
            academicYear: budget.academicYear,
            term: budget.term,
            amount: new Prisma.Decimal(budget.amount).toFixed(2),
            createdAt: budget.createdAt.toISOString(),
            updatedAt: budget.updatedAt.toISOString(),
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("GET /api/budgets/:id error:", error);
      return NextResponse.json({ error: "Failed to fetch budget" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);

export const PATCH = withAuth(
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

      const existing = await prisma.budget.findFirst({
        where: {
          id,
          schoolId,
        },
      });

      if (!existing) {
        return NextResponse.json({ error: "Budget not found" }, { status: 404 });
      }

      const body = await req.json();
      const { amount } = body;

      if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      }

      const newAmountDecimal = new Prisma.Decimal(Number(amount).toFixed(2));

      // No-Op Check: If amount is identical to current value, return 200 OK without creating an audit entry
      if (new Prisma.Decimal(existing.amount).equals(newAmountDecimal)) {
        return NextResponse.json(
          {
            message: "No change in budget amount",
            data: {
              id: existing.id,
              schoolId: existing.schoolId,
              academicYear: existing.academicYear,
              term: existing.term,
              amount: new Prisma.Decimal(existing.amount).toFixed(2),
              createdAt: existing.createdAt.toISOString(),
              updatedAt: existing.updatedAt.toISOString(),
            },
          },
          { status: 200 }
        );
      }

      // Atomic update of Budget + append BudgetAuditLog in a single transaction
      const [updatedBudget] = await prisma.$transaction(
        async (tx) => {
          const updated = await tx.budget.update({
            where: { id: existing.id },
            data: {
              amount: newAmountDecimal,
            },
          });

          await tx.budgetAuditLog.create({
            data: {
              budgetId: existing.id,
              changedBy: req.user.userId,
              previousAmount: existing.amount,
              newAmount: newAmountDecimal,
            },
          });

          return [updated];
        },
        {
          maxWait: 10000,
          timeout: 20000,
        }
      );

      return NextResponse.json(
        {
          data: {
            id: updatedBudget.id,
            schoolId: updatedBudget.schoolId,
            academicYear: updatedBudget.academicYear,
            term: updatedBudget.term,
            amount: new Prisma.Decimal(updatedBudget.amount).toFixed(2),
            createdAt: updatedBudget.createdAt.toISOString(),
            updatedAt: updatedBudget.updatedAt.toISOString(),
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("PATCH /api/budgets/:id error:", error);
      return NextResponse.json({ error: error.message || "Failed to update budget" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
