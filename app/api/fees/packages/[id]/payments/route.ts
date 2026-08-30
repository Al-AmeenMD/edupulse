import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { recordPackagePayment, FeePaymentError } from "@/lib/services/feePayment";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

      const { id: packageId } = await context.params;

      const body = (await req.json()) as {
        studentId?: string;
        amount?: number;
        method?: string;
        reference?: string;
        note?: string;
        allocations?: Array<{ feeId: string; amount: number }>;
      };

      const studentId = body.studentId?.trim();
      const amount = body.amount;
      const method = body.method?.trim();
      const reference = body.reference?.trim() || null;
      const note = body.note?.trim() || null;
      const allocations = body.allocations;

      if (!studentId) {
        return NextResponse.json({ error: "studentId is required" }, { status: 400 });
      }

      if (amount === undefined || amount === null || !method) {
        return NextResponse.json({ error: "amount and method are required" }, { status: 400 });
      }

      const result = await recordPackagePayment({
        schoolId,
        packageId,
        studentId,
        amount,
        method,
        reference,
        note,
        recordedBy: req.user.userId,
        allocations,
      });

      return NextResponse.json(
        {
          data: result,
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
      console.error("POST /api/fees/packages/[id]/payments error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
