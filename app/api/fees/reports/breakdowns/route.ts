import { FeeType, Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

// Helper to format enum keys to title case (e.g. "TUITION" -> "Tuition", "FEEDING" -> "Feeding")
function formatTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatMonthLabel(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split("-");
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || monthStr;
  return `${monthName} ${yearStr}`;
}

// ---------------------------------------------------------------------------
// GET /api/fees/reports/breakdowns — Detailed Fee Reporting Breakdowns
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

      // Execute separate, non-overlapping queries to guarantee zero double-counting
      const [fees, payments] = await Promise.all([
        // 1. All fee assignments for the school
        prisma.fee.findMany({
          where: { schoolId },
          select: {
            id: true,
            amountDue: true,
            feeStructure: {
              select: {
                type: true,
                academicYear: true,
                term: true,
              },
            },
          },
        }),

        // 2. All payment transactions recorded for the school
        prisma.payment.findMany({
          where: { schoolId },
          select: {
            id: true,
            amount: true,
            paidAt: true,
            fee: {
              select: {
                feeStructure: {
                  select: {
                    type: true,
                    academicYear: true,
                    term: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      // -----------------------------------------------------------------------
      // Dimension 1: Fee-Type Breakdown (Dynamic Enum & Existing Types)
      // -----------------------------------------------------------------------
      type BreakdownAccumulator = {
        totalAssigned: Prisma.Decimal;
        totalCollected: Prisma.Decimal;
        feeCount: number;
        paymentCount: number;
      };

      const feeTypeMap = new Map<string, BreakdownAccumulator>();

      // Initialize all known Prisma FeeType enum values dynamically
      for (const typeVal of Object.values(FeeType)) {
        feeTypeMap.set(typeVal, {
          totalAssigned: new Prisma.Decimal(0),
          totalCollected: new Prisma.Decimal(0),
          feeCount: 0,
          paymentCount: 0,
        });
      }

      // Aggregate Assigned amounts by Fee Type
      for (const fee of fees) {
        const type = fee.feeStructure?.type || "MISCELLANEOUS";
        if (!feeTypeMap.has(type)) {
          feeTypeMap.set(type, {
            totalAssigned: new Prisma.Decimal(0),
            totalCollected: new Prisma.Decimal(0),
            feeCount: 0,
            paymentCount: 0,
          });
        }
        const acc = feeTypeMap.get(type)!;
        acc.totalAssigned = acc.totalAssigned.add(new Prisma.Decimal(fee.amountDue));
        acc.feeCount += 1;
      }

      // Aggregate Collected amounts by Fee Type
      for (const pmt of payments) {
        const type = pmt.fee?.feeStructure?.type || "MISCELLANEOUS";
        if (!feeTypeMap.has(type)) {
          feeTypeMap.set(type, {
            totalAssigned: new Prisma.Decimal(0),
            totalCollected: new Prisma.Decimal(0),
            feeCount: 0,
            paymentCount: 0,
          });
        }
        const acc = feeTypeMap.get(type)!;
        acc.totalCollected = acc.totalCollected.add(new Prisma.Decimal(pmt.amount));
        acc.paymentCount += 1;
      }

      // Format Fee Type Breakdown
      const byFeeType = Array.from(feeTypeMap.entries())
        .map(([type, acc]) => {
          const outstanding = acc.totalAssigned.greaterThan(acc.totalCollected)
            ? acc.totalAssigned.sub(acc.totalCollected)
            : new Prisma.Decimal(0);

          const collectionRate = acc.totalAssigned.isZero()
            ? "0.0%"
            : `${acc.totalCollected.div(acc.totalAssigned).mul(100).toFixed(1)}%`;

          return {
            type,
            label: formatTypeLabel(type),
            totalAssigned: acc.totalAssigned.toFixed(2),
            totalCollected: acc.totalCollected.toFixed(2),
            totalOutstanding: outstanding.toFixed(2),
            collectionRate,
            feeCount: acc.feeCount,
            paymentCount: acc.paymentCount,
          };
        })
        // Filter out unused types or sort active types first
        .sort((a, b) => {
          if (a.feeCount > 0 && b.feeCount === 0) return -1;
          if (a.feeCount === 0 && b.feeCount > 0) return 1;
          return a.label.localeCompare(b.label);
        });

      // -----------------------------------------------------------------------
      // Dimension 2: Academic Session / Year Breakdown
      // -----------------------------------------------------------------------
      const sessionMap = new Map<string, BreakdownAccumulator>();

      for (const fee of fees) {
        const sessionKey = fee.feeStructure?.academicYear?.trim() || "Unspecified";
        if (!sessionMap.has(sessionKey)) {
          sessionMap.set(sessionKey, {
            totalAssigned: new Prisma.Decimal(0),
            totalCollected: new Prisma.Decimal(0),
            feeCount: 0,
            paymentCount: 0,
          });
        }
        const acc = sessionMap.get(sessionKey)!;
        acc.totalAssigned = acc.totalAssigned.add(new Prisma.Decimal(fee.amountDue));
        acc.feeCount += 1;
      }

      for (const pmt of payments) {
        const sessionKey = pmt.fee?.feeStructure?.academicYear?.trim() || "Unspecified";
        if (!sessionMap.has(sessionKey)) {
          sessionMap.set(sessionKey, {
            totalAssigned: new Prisma.Decimal(0),
            totalCollected: new Prisma.Decimal(0),
            feeCount: 0,
            paymentCount: 0,
          });
        }
        const acc = sessionMap.get(sessionKey)!;
        acc.totalCollected = acc.totalCollected.add(new Prisma.Decimal(pmt.amount));
        acc.paymentCount += 1;
      }

      const byAcademicYear = Array.from(sessionMap.entries())
        .map(([academicYear, acc]) => {
          const outstanding = acc.totalAssigned.greaterThan(acc.totalCollected)
            ? acc.totalAssigned.sub(acc.totalCollected)
            : new Prisma.Decimal(0);

          const collectionRate = acc.totalAssigned.isZero()
            ? "0.0%"
            : `${acc.totalCollected.div(acc.totalAssigned).mul(100).toFixed(1)}%`;

          return {
            academicYear,
            totalAssigned: acc.totalAssigned.toFixed(2),
            totalCollected: acc.totalCollected.toFixed(2),
            totalOutstanding: outstanding.toFixed(2),
            collectionRate,
            feeCount: acc.feeCount,
            paymentCount: acc.paymentCount,
          };
        })
        .sort((a, b) => b.academicYear.localeCompare(a.academicYear));

      // -----------------------------------------------------------------------
      // Dimension 3: Term Breakdown
      // -----------------------------------------------------------------------
      const termMap = new Map<string, BreakdownAccumulator>();

      for (const fee of fees) {
        const termKey = fee.feeStructure?.term?.trim() || "No Term / Full Year";
        if (!termMap.has(termKey)) {
          termMap.set(termKey, {
            totalAssigned: new Prisma.Decimal(0),
            totalCollected: new Prisma.Decimal(0),
            feeCount: 0,
            paymentCount: 0,
          });
        }
        const acc = termMap.get(termKey)!;
        acc.totalAssigned = acc.totalAssigned.add(new Prisma.Decimal(fee.amountDue));
        acc.feeCount += 1;
      }

      for (const pmt of payments) {
        const termKey = pmt.fee?.feeStructure?.term?.trim() || "No Term / Full Year";
        if (!termMap.has(termKey)) {
          termMap.set(termKey, {
            totalAssigned: new Prisma.Decimal(0),
            totalCollected: new Prisma.Decimal(0),
            feeCount: 0,
            paymentCount: 0,
          });
        }
        const acc = termMap.get(termKey)!;
        acc.totalCollected = acc.totalCollected.add(new Prisma.Decimal(pmt.amount));
        acc.paymentCount += 1;
      }

      const byTerm = Array.from(termMap.entries())
        .map(([term, acc]) => {
          const outstanding = acc.totalAssigned.greaterThan(acc.totalCollected)
            ? acc.totalAssigned.sub(acc.totalCollected)
            : new Prisma.Decimal(0);

          const collectionRate = acc.totalAssigned.isZero()
            ? "0.0%"
            : `${acc.totalCollected.div(acc.totalAssigned).mul(100).toFixed(1)}%`;

          return {
            term,
            totalAssigned: acc.totalAssigned.toFixed(2),
            totalCollected: acc.totalCollected.toFixed(2),
            totalOutstanding: outstanding.toFixed(2),
            collectionRate,
            feeCount: acc.feeCount,
            paymentCount: acc.paymentCount,
          };
        })
        .sort((a, b) => a.term.localeCompare(b.term));

      // -----------------------------------------------------------------------
      // Dimension 4: Calendar Month Breakdown (Based on Payment.paidAt)
      // -----------------------------------------------------------------------
      const monthMap = new Map<
        string,
        { totalCollected: Prisma.Decimal; paymentCount: number }
      >();

      for (const pmt of payments) {
        const dateObj = new Date(pmt.paidAt);
        const year = dateObj.getUTCFullYear();
        const monthNum = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
        const monthKey = `${year}-${monthNum}`;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            totalCollected: new Prisma.Decimal(0),
            paymentCount: 0,
          });
        }
        const acc = monthMap.get(monthKey)!;
        acc.totalCollected = acc.totalCollected.add(new Prisma.Decimal(pmt.amount));
        acc.paymentCount += 1;
      }

      const byMonth = Array.from(monthMap.entries())
        .map(([month, acc]) => ({
          month,
          monthLabel: formatMonthLabel(month),
          totalCollected: acc.totalCollected.toFixed(2),
          paymentCount: acc.paymentCount,
        }))
        .sort((a, b) => a.month.localeCompare(b.month)); // Chronological order

      return NextResponse.json(
        {
          data: {
            byFeeType,
            byAcademicYear,
            byTerm,
            byMonth,
          },
        },
        { status: 200 }
      );
    } catch (err: any) {
      console.error("GET /api/fees/reports/breakdowns error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
