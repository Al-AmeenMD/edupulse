import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const VALID_METHODS = ["cash", "bank_transfer", "card"];

// ---------------------------------------------------------------------------
// POST /api/fees/:id/payments — Record a payment against a fee
// ---------------------------------------------------------------------------
export const POST = withAuth(
  async (req, context) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { id: feeId } = (await context.params) as Awaited<
        RouteContext["params"]
      >;

      const body = (await req.json()) as {
        amount?: number;
        method?: string;
        reference?: string;
        note?: string;
      };

      const amount = body.amount;
      const method = body.method?.trim().toLowerCase();
      const reference = body.reference?.trim() || null;

      // --- Required field validation ---
      if (amount === undefined || amount === null || !method) {
        return NextResponse.json(
          { error: "amount and method are required" },
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

      // --- Method validation ---
      if (!VALID_METHODS.includes(method)) {
        return NextResponse.json(
          {
            error: `Invalid payment method: ${method}. Must be one of ${VALID_METHODS.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // --- Verify fee exists and belongs to this school ---
      const fee = await prisma.fee.findUnique({
        where: { id: feeId },
        select: {
          id: true,
          schoolId: true,
          amountDue: true,
          amountPaid: true,
          status: true,
        },
      });

      if (!fee || fee.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Fee not found" },
          { status: 404 }
        );
      }

      // --- Check fee is not already fully paid or waived ---
      if (fee.status === "PAID") {
        return NextResponse.json(
          { error: "This fee has already been fully paid" },
          { status: 400 }
        );
      }

      if (fee.status === "WAIVED") {
        return NextResponse.json(
          { error: "This fee has been waived and cannot accept payments" },
          { status: 400 }
        );
      }

      // --- Check for overpayment ---
      const amountDue = new Prisma.Decimal(fee.amountDue);
      const currentPaid = new Prisma.Decimal(fee.amountPaid);
      const paymentAmount = new Prisma.Decimal(amount);
      const newAmountPaid = currentPaid.add(paymentAmount);

      if (newAmountPaid.greaterThan(amountDue)) {
        const remaining = amountDue.sub(currentPaid);
        return NextResponse.json(
          {
            error: `Payment would exceed amount due. Remaining balance is ${remaining.toFixed(2)}`,
          },
          { status: 400 }
        );
      }

      // --- Determine new status ---
      let newStatus: "PAID" | "PARTIAL" | "PENDING";
      let paidAt: Date | null = null;

      if (newAmountPaid.greaterThanOrEqualTo(amountDue)) {
        newStatus = "PAID";
        paidAt = new Date();
      } else if (newAmountPaid.greaterThan(0)) {
        newStatus = "PARTIAL";
      } else {
        newStatus = "PENDING";
      }

      // --- Create payment and update fee in a transaction ---
      const [payment, updatedFee] = await prisma.$transaction([
        prisma.payment.create({
          data: {
            feeId,
            amount: paymentAmount,
            method,
            reference,
            recordedBy: req.user.userId,
          },
        }),
        prisma.fee.update({
          where: { id: feeId },
          data: {
            amountPaid: newAmountPaid,
            status: newStatus,
            paidAt,
          },
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
                academicYear: true,
                term: true,
              },
            },
          },
        }),
      ]);

      return NextResponse.json(
        {
          data: {
            fee: updatedFee,
            payment,
          },
        },
        { status: 201 }
      );
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);

// ---------------------------------------------------------------------------
// GET /api/fees/:id/payments — List all payments for a fee
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (_req, context) => {
    try {
      const schoolId = _req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { id: feeId } = (await context.params) as Awaited<
        RouteContext["params"]
      >;

      // --- Verify fee exists and belongs to this school ---
      const fee = await prisma.fee.findUnique({
        where: { id: feeId },
        select: {
          id: true,
          schoolId: true,
          amountDue: true,
          amountPaid: true,
          status: true,
          dueDate: true,
          paidAt: true,
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
              academicYear: true,
              term: true,
            },
          },
        },
      });

      if (!fee || fee.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Fee not found" },
          { status: 404 }
        );
      }

      const payments = await prisma.payment.findMany({
        where: { feeId },
        orderBy: { paidAt: "desc" },
      });

      return NextResponse.json(
        {
          data: {
            fee,
            payments,
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
  [Role.SCHOOL_ADMIN]
);
