import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withAuth } from "@/lib/middleware/withAuth";
import { resolveSchoolContext } from "@/lib/auth/schoolContext";
import {
  createTerm,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/services/academicSessionService";

export const POST = withAuth(
  async (
    req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } },
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: sessionId } = await context.params;
      const body = await req.json();
      const { name, startDate, endDate, schoolId: bodySchoolId } = body;

      const schoolId = await resolveSchoolContext(req.user, bodySchoolId);

      const term = await createTerm(schoolId, sessionId, {
        name,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      return NextResponse.json({ data: term }, { status: 201 });
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof BadRequestError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof ConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message?.startsWith("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      console.error("POST /api/academic-sessions/[id]/terms error:", error);
      return NextResponse.json({ error: error.message || "Failed to create term" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.PROPRIETOR]
);
