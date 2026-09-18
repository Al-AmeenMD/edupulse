import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/middleware/withAuth";

export const GET = withAuth(
  async (req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } }) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json({ error: "School context required" }, { status: 400 });
      }

      const budgets = await prisma.budget.findMany({
        where: { schoolId },
        include: {
          session: true,
          term: true,
        },
        orderBy: [{ session: { name: "desc" } }, { term: { name: "asc" } }],
      });

      let totalAllocatedDecimal = new Prisma.Decimal(0);
      const formattedBudgets = budgets.map((b) => {
        const amtDecimal = new Prisma.Decimal(b.amount);
        totalAllocatedDecimal = totalAllocatedDecimal.add(amtDecimal);
        return {
          id: b.id,
          schoolId: b.schoolId,
          sessionId: b.sessionId,
          termId: b.termId,
          academicYear: b.session?.name || "N/A",
          term: b.term?.name || "N/A",
          session: b.session,
          termObj: b.term,
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
      const { sessionId: rawSessionId, academicYear, termId: rawTermId, term: rawTerm, amount } = body;

      const sessionIdentifier = rawSessionId?.trim() || academicYear?.trim();
      const termIdentifier = rawTermId?.trim() || rawTerm?.trim();

      if (!sessionIdentifier) {
        return NextResponse.json(
          { error: "Academic session (sessionId or academicYear) is required" },
          { status: 400 }
        );
      }

      if (!termIdentifier) {
        return NextResponse.json(
          { error: "Term (termId or term) is required for budget" },
          { status: 400 }
        );
      }

      if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      }

      // Resolve AcademicSession
      const session = await prisma.academicSession.findFirst({
        where: {
          schoolId,
          OR: [{ id: sessionIdentifier }, { name: sessionIdentifier }],
        },
        include: { terms: true },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Academic session not found in this school" },
          { status: 404 }
        );
      }

      // Resolve Term
      const term = session.terms.find(
        (t) =>
          t.id === termIdentifier ||
          t.name.toLowerCase() === termIdentifier.toLowerCase() ||
          (termIdentifier === "1" && t.name.includes("First")) ||
          (termIdentifier === "2" && t.name.includes("Second")) ||
          (termIdentifier === "3" && t.name.includes("Third"))
      );

      if (!term) {
        return NextResponse.json(
          { error: `Term '${termIdentifier}' not found under session '${session.name}'` },
          { status: 404 }
        );
      }

      const amountDecimal = new Prisma.Decimal(Number(amount).toFixed(2));

      // Atomic creation of Budget + initial BudgetAuditLog with snapshots
      try {
        const [createdBudget] = await prisma.$transaction(
          async (tx) => {
            const newBudget = await tx.budget.create({
              data: {
                schoolId,
                sessionId: session.id,
                termId: term.id,
                amount: amountDecimal,
              },
              include: {
                session: true,
                term: true,
              },
            });

            await tx.budgetAuditLog.create({
              data: {
                budgetId: newBudget.id,
                changedBy: req.user.userId,
                previousAmount: null,
                newAmount: amountDecimal,
                academicSessionName: session.name,
                termName: term.name,
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
              sessionId: createdBudget.sessionId,
              termId: createdBudget.termId,
              academicYear: createdBudget.session.name,
              term: createdBudget.term.name,
              session: createdBudget.session,
              termObj: createdBudget.term,
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
            { error: "A budget already exists for this academic session and term" },
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
