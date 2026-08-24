import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function generateSecureRandomPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const array = new Uint32Array(12);
  crypto.getRandomValues(array);
  let generatedPassword = "";
  for (let i = 0; i < array.length; i++) {
    generatedPassword += chars[array[i] % chars.length];
  }
  return generatedPassword;
}

export const POST = withAuth(async (req, context) => {
  try {
    const { id } = (await context.params) as Awaited<RouteContext["params"]>;

    // Fetch Target User
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        schoolId: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const callerId = req.user.userId || (req.user as any)?.id;

    // Common Self-Target Check (Neither SCHOOL_ADMIN nor SUPER_ADMIN can reset themselves via admin reset)
    if (callerId && targetUser.id === callerId) {
      return NextResponse.json(
        { error: "Cannot reset your own password via admin reset. Use self-service password change." },
        { status: 400 }
      );
    }

    // Role-Based Authorization & Scoping Rules
    if (req.user.role === Role.SUPER_ADMIN) {
      // SUPER_ADMIN Scoping Rules:
      // 1. Cannot reset peer SUPER_ADMIN
      if (targetUser.role === Role.SUPER_ADMIN) {
        return NextResponse.json(
          { error: "Cannot reset password for Super Admin accounts" },
          { status: 403 }
        );
      }

      // 2. Can only reset SCHOOL_ADMIN accounts (cannot reset TEACHER or FINANCE_ADMIN directly)
      if (targetUser.role !== Role.SCHOOL_ADMIN) {
        return NextResponse.json(
          { error: "Super Admin password reset is restricted to School Admins. School Admins manage staff passwords." },
          { status: 403 }
        );
      }

      // Note: SUPER_ADMIN is NOT schoolId-scoped (operates globally across all schools)
    } else if (req.user.role === Role.SCHOOL_ADMIN) {
      // SCHOOL_ADMIN Scoping Rules:
      // 1. Tenant Isolation: Must belong to caller's school
      if (targetUser.schoolId !== req.user.schoolId) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // 2. Role Boundary: Cannot reset SCHOOL_ADMIN or SUPER_ADMIN
      if (targetUser.role === Role.SCHOOL_ADMIN || targetUser.role === Role.SUPER_ADMIN) {
        return NextResponse.json(
          { error: "Cannot reset password for administrative accounts" },
          { status: 403 }
        );
      }

      // 3. Can only reset TEACHER or FINANCE_ADMIN accounts
      if (targetUser.role !== Role.TEACHER && targetUser.role !== Role.FINANCE_ADMIN) {
        return NextResponse.json(
          { error: "Password reset is only permitted for staff members (Teachers and Finance Admins)" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse & Validate Password
    const body = (await req.json().catch(() => ({}))) as { newPassword?: string };
    let finalNewPassword = body.newPassword?.trim();

    if (!finalNewPassword) {
      finalNewPassword = generateSecureRandomPassword();
    } else if (finalNewPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Hash & Save
    const hashedPassword = await hashPassword(finalNewPassword);

    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
      },
    });

    return NextResponse.json(
      {
        message: "Password reset successfully",
        newPassword: finalNewPassword,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("reset-password error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}, [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN]);
