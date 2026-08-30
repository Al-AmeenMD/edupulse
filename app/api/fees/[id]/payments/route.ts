import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";
import { FeePaymentError, recordSingleFeePaymentCore } from "@/lib/services/feePayment";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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
      const method = body.method;
      const reference = body.reference;

      // Required field validation
      if (amount === undefined || amount === null || !method) {
        return NextResponse.json(
          { error: "amount and method are required" },
          { status: 400 }
        );
      }

      let result: any;
      const MAX_RETRIES = 5;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          result = await prisma.$transaction(async (tx) => {
            return recordSingleFeePaymentCore(
              {
                schoolId,
                feeId,
                amount,
                method,
                reference,
                recordedBy: req.user.userId,
              },
              tx
            );
          });
          break;
        } catch (err: any) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            console.log(
              `[P2002 Collision Handled] Caught P2002 on attempt ${attempt + 1}. Retrying with fresh count...`
            );
            if (attempt === MAX_RETRIES - 1) throw err;
            continue;
          }
          throw err;
        }
      }

      return NextResponse.json(
        {
          data: {
            fee: result.updatedFee,
            payment: result.payment,
          },
        },
        { status: 201 }
      );
    } catch (err: any) {
      if (err.name === "FeePaymentError") {
        return NextResponse.json(
          { error: err.message },
          { status: err.statusCode || 400 }
        );
      }
      console.error("POST /api/fees/[id]/payments error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
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
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
