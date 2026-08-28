import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/middleware/withAuth";

const VALID_TERMS = ["First Term", "Second Term", "Third Term"];
const ACADEMIC_YEAR_REGEX = /^\d{4}\/\d{4}$/;

export const GET = withAuth(
  async (req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } }) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json({ error: "School context required" }, { status: 400 });
      }

      const budgets = await prisma.budget.findMany({
        where: { schoolId },
        orderBy: [{ academicYear: "desc" }, { term: "asc" }],
      });

      let totalAllocatedDecimal = new Prisma.Decimal(0);
      const formattedBudgets = budgets.map((b) => {
        const amtDecimal = new Prisma.Decimal(b.amount);
        totalAllocatedDecimal = totalAllocatedDecimal.add(amtDecimal);
        return {
          id: b.id,
          schoolId: b.schoolId,
          academicYear: b.academicYear,
          term: b.term,
          amount: amtDecimal.toFixed(2),
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        };
      });

      return NextResponse.json(
        {
          data: {
            budgets: formattedBudgets,
            summary: {
              totalCount: formattedBudgets.length,
              totalAmount: totalAllocatedDecimal.toFixed(2),
            },
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("GET /api/budgets error:", error);
      return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);

export const POST = withAuth(
  async (req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } }) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json({ error: "School context required" }, { status: 400 });
      }

      const body = await req.json();
      const { academicYear, term, amount } = body;

      if (!academicYear || typeof academicYear !== "string" || !ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
        return NextResponse.json(
          { error: "Valid academic year in YYYY/YYYY format is required (e.g. 2025/2026)" },
          { status: 400 }
        );
      }

      if (!term || typeof term !== "string" || !VALID_TERMS.includes(term.trim())) {
        return NextResponse.json(
          { error: "Valid term is required (First Term, Second Term, or Third Term)" },
          { status: 400 }
        );
      }

      if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      }

      const cleanYear = academicYear.trim();
      const cleanTerm = term.trim();
      const amountDecimal = new Prisma.Decimal(Number(amount).toFixed(2));

      // Atomic creation of Budget + initial BudgetAuditLog in a single transaction
      try {
        const [createdBudget] = await prisma.$transaction(
          async (tx) => {
            const newBudget = await tx.budget.create({
              data: {
                schoolId,
                academicYear: cleanYear,
                term: cleanTerm,
                amount: amountDecimal,
              },
            });

            await tx.budgetAuditLog.create({
              data: {
                budgetId: newBudget.id,
                changedBy: req.user.userId,
                previousAmount: null,
                newAmount: amountDecimal,
              },
            });

            return [newBudget];
          },
          {
            maxWait: 10000,
            timeout: 20000,
          }
        );

        return NextResponse.json(
          {
            data: {
              id: createdBudget.id,
              schoolId: createdBudget.schoolId,
              academicYear: createdBudget.academicYear,
              term: createdBudget.term,
              amount: new Prisma.Decimal(createdBudget.amount).toFixed(2),
              createdAt: createdBudget.createdAt.toISOString(),
              updatedAt: createdBudget.updatedAt.toISOString(),
            },
          },
          { status: 201 }
        );
      } catch (txError: any) {
        if (txError instanceof Prisma.PrismaClientKnownRequestError && txError.code === "P2002") {
          return NextResponse.json(
            { error: "A budget already exists for this academic year and term" },
            { status: 409 }
          );
        }
        throw txError;
      }
    } catch (error: any) {
      console.error("POST /api/budgets error:", error);
      return NextResponse.json({ error: error.message || "Failed to create budget" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
