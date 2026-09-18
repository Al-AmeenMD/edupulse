import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withAuth } from "@/lib/middleware/withAuth";
import { resolveSchoolContext } from "@/lib/auth/schoolContext";
import {
  updateTerm,
  deleteTerm,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/services/academicSessionService";

export const PATCH = withAuth(
  async (
    req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } },
    context: { params: Promise<{ id: string; termId: string }> }
  ) => {
    try {
      const { id: sessionId, termId } = await context.params;
      const body = await req.json();
      const { name, startDate, endDate, schoolId: bodySchoolId } = body;

      const schoolId = await resolveSchoolContext(req.user, bodySchoolId);

      const updated = await updateTerm(schoolId, sessionId, termId, {
        name,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
      });

      return NextResponse.json({ data: updated }, { status: 200 });
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
      console.error("PATCH /api/academic-sessions/[id]/terms/[termId] error:", error);
      return NextResponse.json({ error: error.message || "Failed to update term" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.PROPRIETOR]
);

export const DELETE = withAuth(
  async (
    req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } },
    context: { params: Promise<{ id: string; termId: string }> }
  ) => {
    try {
      const { id: sessionId, termId } = await context.params;
      const { searchParams } = new URL(req.url);
      const explicitSchoolId = searchParams.get("schoolId");

      const schoolId = await resolveSchoolContext(req.user, explicitSchoolId);

      await deleteTerm(schoolId, sessionId, termId);

      return NextResponse.json({ message: "Term deleted successfully" }, { status: 200 });
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof ConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message?.startsWith("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      console.error("DELETE /api/academic-sessions/[id]/terms/[termId] error:", error);
      return NextResponse.json({ error: error.message || "Failed to delete term" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.PROPRIETOR]
);
