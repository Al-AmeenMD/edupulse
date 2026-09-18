import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withAuth } from "@/lib/middleware/withAuth";
import { resolveSchoolContext } from "@/lib/auth/schoolContext";
import {
  getAcademicSessions,
  createAcademicSession,
  BadRequestError,
  ConflictError,
} from "@/lib/services/academicSessionService";

export const GET = withAuth(
  async (req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } }) => {
    try {
      const { searchParams } = new URL(req.url);
      const explicitSchoolId = searchParams.get("schoolId");

      const schoolId = await resolveSchoolContext(req.user, explicitSchoolId);
      const sessions = await getAcademicSessions(schoolId);

      return NextResponse.json({ data: sessions }, { status: 200 });
    } catch (error: any) {
      if (error.message?.startsWith("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message?.includes("required")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("GET /api/academic-sessions error:", error);
      return NextResponse.json({ error: "Failed to fetch academic sessions" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN, Role.TEACHER, Role.SUPER_ADMIN, Role.PROPRIETOR]
);

export const POST = withAuth(
  async (req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } }) => {
    try {
      const body = await req.json();
      const { name, startDate, endDate, isCurrent, schoolId: bodySchoolId } = body;

      const schoolId = await resolveSchoolContext(req.user, bodySchoolId);

      const session = await createAcademicSession(schoolId, {
        name,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isCurrent,
      });

      return NextResponse.json({ data: session }, { status: 201 });
    } catch (error: any) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof ConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message?.startsWith("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message?.includes("required")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("POST /api/academic-sessions error:", error);
      return NextResponse.json({ error: error.message || "Failed to create academic session" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.PROPRIETOR]
);
