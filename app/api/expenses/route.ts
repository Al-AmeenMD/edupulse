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

      const { searchParams } = new URL(req.url);
      const category = searchParams.get("category")?.trim();
      const search = searchParams.get("search")?.trim();
      const startDate = searchParams.get("startDate")?.trim();
      const endDate = searchParams.get("endDate")?.trim();

      const where: Prisma.ExpenseWhereInput = {
        schoolId,
        deletedAt: null,
      };

      if (category && category !== "ALL") {
        where.category = { equals: category, mode: "insensitive" };
      }

      if (startDate || endDate) {
        where.expenseDate = {};
        if (startDate) {
          where.expenseDate.gte = new Date(startDate);
        }
        if (endDate) {
          where.expenseDate.lte = new Date(endDate);
        }
      }

      if (search) {
        where.OR = [
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ];
      }

      const expenses = await prisma.expense.findMany({
        where,
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      });

      // Batch resolve user names for recordedBy field with tenant isolation
      const recorderIds = Array.from(
        new Set(expenses.map((e) => e.recordedBy).filter(Boolean))
      );
      const users =
        recorderIds.length > 0
          ? await prisma.user.findMany({
              where: {
                id: { in: recorderIds },
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

      let totalAmountDecimal = new Prisma.Decimal(0);
      const formattedExpenses = expenses.map((exp) => {
        const amtDecimal = new Prisma.Decimal(exp.amount);
        totalAmountDecimal = totalAmountDecimal.add(amtDecimal);
        return {
          id: exp.id,
          schoolId: exp.schoolId,
          category: exp.category,
          amount: amtDecimal.toFixed(2),
          description: exp.description,
          expenseDate: exp.expenseDate.toISOString().split("T")[0],
          recordedBy: userMap.get(exp.recordedBy) || exp.recordedBy,
          createdAt: exp.createdAt.toISOString(),
          updatedAt: exp.updatedAt.toISOString(),
        };
      });

      return NextResponse.json(
        {
          data: {
            expenses: formattedExpenses,
            summary: {
              totalCount: formattedExpenses.length,
              totalAmount: totalAmountDecimal.toFixed(2),
            },
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("GET /api/expenses error:", error);
      return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
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
      const { category, amount, description, expenseDate } = body;

      if (!category || typeof category !== "string" || category.trim().length === 0) {
        return NextResponse.json({ error: "Category is required" }, { status: 400 });
      }

      if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      }

      if (!description || typeof description !== "string" || description.trim().length === 0) {
        return NextResponse.json({ error: "Description is required" }, { status: 400 });
      }

      if (!expenseDate || isNaN(Date.parse(expenseDate))) {
        return NextResponse.json({ error: "Valid expense date is required" }, { status: 400 });
      }

      const amountDecimal = new Prisma.Decimal(Number(amount).toFixed(2));
      const parsedDate = new Date(expenseDate);

      // schoolId and recordedBy strictly enforced from req.user (JWT)
      const newExpense = await prisma.expense.create({
        data: {
          schoolId,
          category: category.trim(),
          amount: amountDecimal,
          description: description.trim(),
          expenseDate: parsedDate,
          recordedBy: req.user.userId,
        },
      });

      // Look up recordedBy user name for response payload
      const recorder = await prisma.user.findFirst({
        where: { id: req.user.userId, schoolId },
        select: { firstName: true, lastName: true },
      });
      const recordedByName = recorder
        ? `${recorder.firstName} ${recorder.lastName}`.trim()
        : newExpense.recordedBy;

      return NextResponse.json(
        {
          data: {
            id: newExpense.id,
            schoolId: newExpense.schoolId,
            category: newExpense.category,
            amount: new Prisma.Decimal(newExpense.amount).toFixed(2),
            description: newExpense.description,
            expenseDate: newExpense.expenseDate.toISOString().split("T")[0],
            recordedBy: recordedByName,
            createdAt: newExpense.createdAt.toISOString(),
            updatedAt: newExpense.updatedAt.toISOString(),
          },
        },
        { status: 201 }
      );
    } catch (error: any) {
      console.error("POST /api/expenses error:", error);
      return NextResponse.json({ error: error.message || "Failed to create expense" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
// Recompile route handler with new Prisma schema

