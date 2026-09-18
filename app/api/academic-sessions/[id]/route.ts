import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withAuth } from "@/lib/middleware/withAuth";
import { resolveSchoolContext } from "@/lib/auth/schoolContext";
import { prisma } from "@/lib/prisma";
import {
  updateAcademicSession,
  deleteAcademicSession,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/services/academicSessionService";

export const GET = withAuth(
  async (
    req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } },
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const explicitSchoolId = searchParams.get("schoolId");

      const schoolId = await resolveSchoolContext(req.user, explicitSchoolId);

      const session = await prisma.academicSession.findFirst({
        where: { id, schoolId },
        include: {
          terms: { orderBy: { createdAt: "asc" } },
          _count: {
            select: {
              enrollments: true,
              feeStructures: true,
              budgets: true,
              feePackages: true,
            },
          },
        },
      });

      if (!session) {
        return NextResponse.json({ error: "Academic session not found" }, { status: 404 });
      }

      return NextResponse.json({ data: session }, { status: 200 });
    } catch (error: any) {
      if (error.message?.startsWith("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      console.error("GET /api/academic-sessions/[id] error:", error);
      return NextResponse.json({ error: "Failed to fetch academic session" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN, Role.TEACHER, Role.SUPER_ADMIN, Role.PROPRIETOR]
);

export const PATCH = withAuth(
  async (
    req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } },
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name, startDate, endDate, schoolId: bodySchoolId } = body;

      const schoolId = await resolveSchoolContext(req.user, bodySchoolId);

      const updated = await updateAcademicSession(schoolId, id, {
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
      console.error("PATCH /api/academic-sessions/[id] error:", error);
      return NextResponse.json({ error: error.message || "Failed to update academic session" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.PROPRIETOR]
);

export const DELETE = withAuth(
  async (
    req: NextRequest & { user: { userId: string; role: Role; schoolId: string | null } },
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const explicitSchoolId = searchParams.get("schoolId");

      const schoolId = await resolveSchoolContext(req.user, explicitSchoolId);

      await deleteAcademicSession(schoolId, id);

      return NextResponse.json({ message: "Academic session deleted successfully" }, { status: 200 });
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
      console.error("DELETE /api/academic-sessions/[id] error:", error);
      return NextResponse.json({ error: error.message || "Failed to delete academic session" }, { status: 500 });
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.PROPRIETOR]
);
