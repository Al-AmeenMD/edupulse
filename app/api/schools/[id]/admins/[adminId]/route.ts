import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { validateProprietorSchoolAccess } from "@/lib/auth/proprietor";
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
// GET /api/schools/:id/admins/:adminId — Get single SCHOOL_ADMIN
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (req, context) => {
    try {
      const { id, adminId } = (await context.params) as Awaited<RouteContext["params"]>;

      if (req.user.role === "PROPRIETOR") {
        const hasAccess = await validateProprietorSchoolAccess(req.user.userId, id);
        if (!hasAccess) {
          return NextResponse.json({ error: "Forbidden: You do not own this school" }, { status: 403 });
        }
      }

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

      if (!targetUser) {
        return NextResponse.json(
          { error: "School administrator not found" },
          { status: 404 }
        );
      }

      if (targetUser.role !== "SCHOOL_ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Target user is not a school administrator" },
          { status: 403 }
        );
      }

      if (targetUser.schoolId !== id) {
        return NextResponse.json(
          { error: "School administrator not found" },
          { status: 404 }
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
  [Role.SUPER_ADMIN, "PROPRIETOR" as Role]
);

// ---------------------------------------------------------------------------
// PATCH /api/schools/:id/admins/:adminId — Update/Deactivate/Reactivate SCHOOL_ADMIN
// ---------------------------------------------------------------------------
export const PATCH = withAuth(
  async (req, context) => {
    try {
      const { id, adminId } = (await context.params) as Awaited<RouteContext["params"]>;

      if (req.user.role === "PROPRIETOR") {
        const hasAccess = await validateProprietorSchoolAccess(req.user.userId, id);
        if (!hasAccess) {
          return NextResponse.json({ error: "Forbidden: You do not own this school" }, { status: 403 });
        }
      }

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

      if (!targetUser) {
        return NextResponse.json(
          { error: "School administrator not found" },
          { status: 404 }
        );
      }

      // Explicit target role guard
      if (targetUser.role !== "SCHOOL_ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Target user is not a school administrator" },
          { status: 403 }
        );
      }

      if (targetUser.schoolId !== id) {
        return NextResponse.json(
          { error: "School administrator not found" },
          { status: 404 }
        );
      }

      // Self-target modification check
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
    } catch (err: any) {
      console.error("PATCH adminId error:", err);
      return NextResponse.json(
        { error: err?.message || "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SUPER_ADMIN, "PROPRIETOR" as Role]
);
