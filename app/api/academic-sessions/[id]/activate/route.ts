import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withAuth } from "@/lib/middleware/withAuth";
import { resolveSchoolContext } from "@/lib/auth/schoolContext";
import {
  activateAcademicSession,
  NotFoundError,
  BadRequestError,
} from "@/lib/services/academicSessionService";

export const POST = withAuth(
  async (
    req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } },
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await context.params;
      let bodySchoolId: string | undefined;
      try {
        const body = await req.json();
        bodySchoolId = body?.schoolId;
      } catch {
        // empty body is acceptable
      }

      const { searchParams } = new URL(req.url);
      const querySchoolId = searchParams.get("schoolId");

      const schoolId = await resolveSchoolContext(req.user, bodySchoolId || querySchoolId);

      const activated = await activateAcademicSession(schoolId, id);

      return NextResponse.json(
        {
          message: `Academic session '${activated?.name}' activated successfully with its First Term`,
          data: activated,
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
      console.error("POST /api/academic-sessions/[id]/activate error:", error);
      return NextResponse.json({ error: error.message || "Failed to activate academic session" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.PROPRIETOR]
);
