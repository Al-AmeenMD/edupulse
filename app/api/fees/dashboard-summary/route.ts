import { Role, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/fees/dashboard-summary — Summary metrics & top lists for finance dashboard
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

      const now = new Date();

      // Execute database aggregations and slice queries in parallel
      const [
        assignedAgg,
        collectedAgg,
        activeAgg,
        overdueCount,
        waivedCount,
        recentPayments,
        overdueFees,
      ] = await Promise.all([
        // 1. Total Fees Assigned aggregate (sum of amountDue across all school fees)
        prisma.fee.aggregate({
          where: { schoolId },
          _sum: { amountDue: true },
        }),

        // 2. Total Collected aggregate (sum of Payment.amount for school's fees)
        prisma.payment.aggregate({
          where: { fee: { schoolId } },
          _sum: { amount: true },
        }),

        // 3. Active Non-Waived & Non-Paid Fees aggregate (for Net Collectible Outstanding calculation)
        prisma.fee.aggregate({
          where: {
            schoolId,
            status: { notIn: ["WAIVED", "PAID"] },
          },
          _sum: { amountDue: true, amountPaid: true },
        }),

        // 4. Overdue Fees count
        prisma.fee.count({
          where: {
            schoolId,
            OR: [
              { status: "OVERDUE" },
              { dueDate: { lt: now }, status: { in: ["PENDING", "PARTIAL"] } },
            ],
          },
        }),

        // 5. Waived Fees count
        prisma.fee.count({
          where: { schoolId, status: "WAIVED" },
        }),

        // 6. Recent 10 Payments (ordered by paidAt desc)
        prisma.payment.findMany({
          where: { fee: { schoolId } },
          orderBy: { paidAt: "desc" },
          take: 10,
          include: {
            fee: {
              include: {
                student: {
                  select: {
                    id: true,
                    studentId: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                feeStructure: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                  },
                },
              },
            },
          },
        }),

        // 7. Top 10 Overdue Fees (ordered by dueDate asc)
        prisma.fee.findMany({
          where: {
            schoolId,
            OR: [
              { status: "OVERDUE" },
              { dueDate: { lt: now }, status: { in: ["PENDING", "PARTIAL"] } },
            ],
          },
          orderBy: { dueDate: "asc" },
          take: 10,
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
              },
            },
            feeStructure: {
              select: {
                id: true,
                name: true,
                type: true,
                amount: true,
              },
            },
          },
        }),
      ]);

      // Calculate Decimal totals preserving financial precision
      const totalAssigned = assignedAgg._sum.amountDue ?? new Prisma.Decimal(0);
      const totalCollected = collectedAgg._sum.amount ?? new Prisma.Decimal(0);
      const activeDue = activeAgg._sum.amountDue ?? new Prisma.Decimal(0);
      const activePaid = activeAgg._sum.amountPaid ?? new Prisma.Decimal(0);
      const totalOutstanding = activeDue.sub(activePaid);

      return NextResponse.json(
        {
          data: {
            stats: {
              totalFeesAssigned: totalAssigned.toFixed(2),
              totalCollected: totalCollected.toFixed(2),
              totalOutstanding: totalOutstanding.toFixed(2),
              overdueCount,
              waivedCount,
            },
            recentPayments,
            overdueFees,
          },
        },
        { status: 200 }
      );
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
