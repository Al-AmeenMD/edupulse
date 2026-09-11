import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withAuth } from "@/lib/middleware/withAuth";
import { softDeletePayment, FeePaymentError } from "@/lib/services/feePayment";

type RouteContext = {
  params: Promise<{
    id: string;
    paymentId: string;
  }>;
};

// ---------------------------------------------------------------------------
// DELETE /api/fees/:id/payments/:paymentId — Soft-delete / void a payment
// ---------------------------------------------------------------------------
export const DELETE = withAuth(
  async (req, context) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { id: feeId, paymentId } = (await context.params) as Awaited<
        RouteContext["params"]
      >;

      if (!feeId || !paymentId) {
        return NextResponse.json(
          { error: "feeId and paymentId are required" },
          { status: 400 }
        );
      }

      const result = await softDeletePayment({
        paymentId,
        feeId,
        schoolId,
        deletedBy: req.user.userId,
      });

      return NextResponse.json(
        {
          message: "Payment voided successfully",
          data: {
            fee: result.updatedFee,
            payment: result.payment,
          },
        },
        { status: 200 }
      );
    } catch (err: any) {
      if (err instanceof FeePaymentError || err.name === "FeePaymentError") {
        return NextResponse.json(
          { error: err.message },
          { status: err.statusCode || 400 }
        );
      }
      console.error("DELETE /api/fees/[id]/payments/[paymentId] error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
