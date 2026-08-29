import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";
import { executeFeeAssignment } from "@/lib/services/feeAssignment";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ---------------------------------------------------------------------------
// POST /api/fees/packages/:id/assign — Assign all bundled fees in a package
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

      const { id } = await context.params;

      const pkg = await prisma.feePackage.findFirst({
        where: { id, schoolId },
        include: {
          items: {
            select: { feeStructureId: true },
          },
        },
      });

      if (!pkg) {
        return NextResponse.json(
          { error: "Fee package not found" },
          { status: 404 }
        );
      }

      if (pkg.items.length === 0) {
        return NextResponse.json(
          { error: "This fee package contains no bundled fee structures" },
          { status: 400 }
        );
      }

      const body = (await req.json()) as {
        studentId?: string;
        classId?: string;
        admissionLevel?: string;
      };

      const studentId = body.studentId?.trim();
      const classId = body.classId?.trim();
      const admissionLevel = body.admissionLevel?.trim();

      const feeStructureIds = pkg.items.map((it) => it.feeStructureId);

      const summary = await executeFeeAssignment({
        schoolId,
        feeStructureIds,
        studentId,
        classId,
        admissionLevel,
      });

      return NextResponse.json(
        {
          data: {
            packageId: pkg.id,
            packageName: pkg.name,
            summary,
          },
        },
        { status: 201 }
      );
    } catch (err: any) {
      if (err.name === "FeeAssignmentError") {
        return NextResponse.json(
          { error: err.message },
          { status: err.statusCode || 400 }
        );
      }
      console.error("POST /api/fees/packages/[id]/assign error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
