import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";
import {
  promoteStudent,
  promoteClassBatch,
  PromotionError,
} from "@/lib/services/promotionService";

export const POST = withAuth(
  async (req) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const body = (await req.json()) as {
        mode?: "single" | "batch";
        studentId?: string;
        sourceClassId?: string;
        targetClassId?: string;
        targetSessionId?: string;
        targetAcademicYear?: string;
        targetTermId?: string;
        targetTerm?: string;
        studentIds?: string[];
      };

      const targetClassId = body.targetClassId?.trim();
      let targetSessionId = body.targetSessionId?.trim() || body.targetAcademicYear?.trim();
      let targetTermId = body.targetTermId?.trim() || body.targetTerm?.trim() || null;

      if (!targetClassId) {
        return NextResponse.json(
          { error: "Target class is required" },
          { status: 400 }
        );
      }

      if (!targetSessionId) {
        return NextResponse.json(
          { error: "Target academic session is required" },
          { status: 400 }
        );
      }

      // Check if targetSessionId is an ID or a name
      const session = await prisma.academicSession.findFirst({
        where: {
          schoolId,
          OR: [{ id: targetSessionId }, { name: targetSessionId }],
        },
        include: { terms: true },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Target academic session not found in this school" },
          { status: 404 }
        );
      }
      targetSessionId = session.id;

      if (targetTermId) {
        const foundTerm = session.terms.find(
          (t) =>
            t.id === targetTermId ||
            t.name.toLowerCase() === targetTermId?.toLowerCase() ||
            (targetTermId === "1" && t.name.includes("First")) ||
            (targetTermId === "2" && t.name.includes("Second")) ||
            (targetTermId === "3" && t.name.includes("Third"))
        );
        targetTermId = foundTerm ? foundTerm.id : null;
      }

      // Single student promotion
      if (body.studentId || body.mode === "single") {
        const studentId = body.studentId?.trim();
        if (!studentId) {
          return NextResponse.json(
            { error: "Student ID is required for single promotion" },
            { status: 400 }
          );
        }

        const result = await promoteStudent({
          schoolId,
          studentId,
          targetClassId,
          targetSessionId,
          targetTermId,
        });

        return NextResponse.json(
          {
            message: "Student promoted successfully",
            data: result,
          },
          { status: 200 }
        );
      }

      // Cohort / batch class promotion
      const sourceClassId = body.sourceClassId?.trim();
      if (!sourceClassId) {
        return NextResponse.json(
          { error: "Source class is required for batch promotion" },
          { status: 400 }
        );
      }

      const result = await promoteClassBatch({
        schoolId,
        sourceClassId,
        targetClassId,
        targetSessionId,
        targetTermId,
        studentIds: body.studentIds,
      });

      return NextResponse.json(
        {
          message: `Successfully promoted ${result.promotedCount} student(s)`,
          data: result,
        },
        { status: 200 }
      );
    } catch (err: any) {
      if (err instanceof PromotionError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.statusCode }
        );
      }

      console.error("Error in promotion endpoint:", err);
      return NextResponse.json(
        { error: "Internal server error during promotion" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
