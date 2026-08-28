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

      const expense = await prisma.expense.findFirst({
        where: {
          id,
          schoolId,
          deletedAt: null,
        },
      });

      if (!expense) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 });
      }

      // Look up recordedBy user name with tenant isolation
      const recorder = await prisma.user.findFirst({
        where: { id: expense.recordedBy, schoolId },
        select: { firstName: true, lastName: true },
      });
      const recordedByName = recorder
        ? `${recorder.firstName} ${recorder.lastName}`.trim()
        : expense.recordedBy;

      return NextResponse.json(
        {
          data: {
            id: expense.id,
            schoolId: expense.schoolId,
            category: expense.category,
            amount: new Prisma.Decimal(expense.amount).toFixed(2),
            description: expense.description,
            expenseDate: expense.expenseDate.toISOString().split("T")[0],
            recordedBy: recordedByName,
            createdAt: expense.createdAt.toISOString(),
            updatedAt: expense.updatedAt.toISOString(),
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("GET /api/expenses/:id error:", error);
      return NextResponse.json({ error: "Failed to fetch expense" }, { status: 500 });
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

      const existing = await prisma.expense.findFirst({
        where: {
          id,
          schoolId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 });
      }

      const body = await req.json();
      const { category, amount, description, expenseDate } = body;

      const updateData: Prisma.ExpenseUpdateInput = {};

      if (category !== undefined) {
        if (typeof category !== "string" || category.trim().length === 0) {
          return NextResponse.json({ error: "Category cannot be empty" }, { status: 400 });
        }
        updateData.category = category.trim();
      }

      if (amount !== undefined) {
        if (isNaN(Number(amount)) || Number(amount) <= 0) {
          return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
        }
        updateData.amount = new Prisma.Decimal(Number(amount).toFixed(2));
      }

      if (description !== undefined) {
        if (typeof description !== "string" || description.trim().length === 0) {
          return NextResponse.json({ error: "Description cannot be empty" }, { status: 400 });
        }
        updateData.description = description.trim();
      }

      if (expenseDate !== undefined) {
        if (isNaN(Date.parse(expenseDate))) {
          return NextResponse.json({ error: "Valid expense date is required" }, { status: 400 });
        }
        updateData.expenseDate = new Date(expenseDate);
      }

      const updated = await prisma.expense.update({
        where: { id: existing.id },
        data: updateData,
      });

      // Look up recordedBy user name for response payload
      const recorder = await prisma.user.findFirst({
        where: { id: updated.recordedBy, schoolId },
        select: { firstName: true, lastName: true },
      });
      const recordedByName = recorder
        ? `${recorder.firstName} ${recorder.lastName}`.trim()
        : updated.recordedBy;

      return NextResponse.json(
        {
          data: {
            id: updated.id,
            schoolId: updated.schoolId,
            category: updated.category,
            amount: new Prisma.Decimal(updated.amount).toFixed(2),
            description: updated.description,
            expenseDate: updated.expenseDate.toISOString().split("T")[0],
            recordedBy: recordedByName,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("PATCH /api/expenses/:id error:", error);
      return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);

export const DELETE = withAuth(
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

      const existing = await prisma.expense.findFirst({
        where: {
          id,
          schoolId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 });
      }

      // Soft delete by setting deletedAt
      await prisma.expense.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });

      return NextResponse.json(
        { message: "Expense deleted successfully", id: existing.id },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("DELETE /api/expenses/:id error:", error);
      return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
