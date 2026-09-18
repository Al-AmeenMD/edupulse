import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withAuth } from "@/lib/middleware/withAuth";
import { resolveSchoolContext } from "@/lib/auth/schoolContext";
import {
  activateTerm,
  BadRequestError,
  NotFoundError,
} from "@/lib/services/academicSessionService";

export const POST = withAuth(
  async (
    req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } },
    context: { params: Promise<{ id: string; termId: string }> }
  ) => {
    try {
      const { id: sessionId, termId } = await context.params;
      let bodySchoolId: string | undefined;
      try {
        const body = await req.json();
        bodySchoolId = body?.schoolId;
      } catch {
        // empty body acceptable
      }

      const { searchParams } = new URL(req.url);
      const querySchoolId = searchParams.get("schoolId");

      const schoolId = await resolveSchoolContext(req.user, bodySchoolId || querySchoolId);

      const activatedTerm = await activateTerm(schoolId, sessionId, termId);

      return NextResponse.json(
        {
          message: `Term '${activatedTerm.name}' activated successfully`,
          data: activatedTerm,
        },
        { status: 200 }
      );
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof BadRequestError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message?.startsWith("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      console.error("POST /api/academic-sessions/[id]/terms/[termId]/activate error:", error);
      return NextResponse.json({ error: error.message || "Failed to activate term" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.PROPRIETOR]
);
