import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
    adminId: string;
  }>;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// GET /api/schools/:id/finance-admins/:adminId — Get single Finance Admin
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (req, context) => {
    try {
      const { id, adminId } = (await context.params) as Awaited<RouteContext["params"]>;

      // 1. Tenant ownership check for SCHOOL_ADMIN
      if (req.user.role === Role.SCHOOL_ADMIN && req.user.schoolId !== id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // 2. Fetch target user
      const targetUser = await prisma.user.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          schoolId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!targetUser || targetUser.schoolId !== id) {
        return NextResponse.json(
          { error: "Finance administrator not found" },
          { status: 404 }
        );
      }

      if (targetUser.role !== Role.FINANCE_ADMIN) {
        return NextResponse.json(
          { error: "Forbidden: Target user is not a finance administrator" },
          { status: 403 }
        );
      }

      return NextResponse.json({ data: targetUser }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN]
);

// ---------------------------------------------------------------------------
// PATCH /api/schools/:id/finance-admins/:adminId — Update/Deactivate/Reactivate
// ---------------------------------------------------------------------------
export const PATCH = withAuth(
  async (req, context) => {
    try {
      const { id, adminId } = (await context.params) as Awaited<RouteContext["params"]>;

      // 1. Tenant ownership check for SCHOOL_ADMIN
      if (req.user.role === Role.SCHOOL_ADMIN && req.user.schoolId !== id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // 2. Fetch target user
      const targetUser = await prisma.user.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          schoolId: true,
          isActive: true,
        },
      });

      if (!targetUser || targetUser.schoolId !== id) {
        return NextResponse.json(
          { error: "Finance administrator not found" },
          { status: 404 }
        );
      }

      // 3. Role boundary check: Must be FINANCE_ADMIN
      if (targetUser.role !== Role.FINANCE_ADMIN) {
        return NextResponse.json(
          { error: "Forbidden: Target user is not a finance administrator" },
          { status: 403 }
        );
      }

      // 4. Defensive self-target check (unreachable in practice under single-role invariant)
      const callerId = req.user.userId || (req.user as any)?.id;
      if (callerId && callerId === targetUser.id) {
        return NextResponse.json(
          { error: "Cannot modify your own administrative account through this endpoint" },
          { status: 400 }
        );
      }

      const body = (await req.json()) as {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string | null;
        isActive?: boolean;
      };

      const updateData: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string | null;
        isActive?: boolean;
      } = {};

      if (body.firstName !== undefined) {
        const firstName = body.firstName.trim();
        if (!firstName) {
          return NextResponse.json(
            { error: "First name is required" },
            { status: 400 }
          );
        }
        updateData.firstName = firstName;
      }

      if (body.lastName !== undefined) {
        const lastName = body.lastName.trim();
        if (!lastName) {
          return NextResponse.json(
            { error: "Last name is required" },
            { status: 400 }
          );
        }
        updateData.lastName = lastName;
      }

      if (body.email !== undefined) {
        const email = body.email.trim().toLowerCase();
        if (!email || !emailRegex.test(email)) {
          return NextResponse.json(
            { error: "Invalid email format" },
            { status: 400 }
          );
        }

        if (email !== targetUser.email) {
          const duplicateUser = await prisma.user.findFirst({
            where: {
              email,
              id: { not: targetUser.id },
            },
            select: { id: true },
          });

          if (duplicateUser) {
            return NextResponse.json(
              { error: "Email is already registered" },
              { status: 409 }
            );
          }
        }

        updateData.email = email;
      }

      if (body.phone !== undefined) {
        updateData.phone = body.phone ? body.phone.trim() || null : null;
      }

      if (body.isActive !== undefined) {
        if (typeof body.isActive !== "boolean") {
          return NextResponse.json(
            { error: "isActive must be a boolean" },
            { status: 400 }
          );
        }
        updateData.isActive = body.isActive;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided to update" },
          { status: 400 }
        );
      }

      const updatedUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: updateData,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          schoolId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({ data: updatedUser }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN]
);
