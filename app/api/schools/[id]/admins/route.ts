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

export const POST = withAuth(async (req, context) => {
  try {
    const { id } = (await context.params) as Awaited<RouteContext["params"]>;
    const body = (await req.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      password?: string;
    };

    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim() || undefined;
    const password = body.password;

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: "First name, last name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const school = await prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!school) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!school.isActive) {
      return NextResponse.json(
        { error: "School is inactive" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ error: "Already exists" }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);

    const admin = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        password: hashedPassword,
        role: Role.SCHOOL_ADMIN,
        schoolId: id,
      },
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

    return NextResponse.json({ data: admin }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}, [Role.SUPER_ADMIN]);

export const GET = withAuth(async (_req, context) => {
  try {
    const { id } = (await context.params) as Awaited<RouteContext["params"]>;

    const school = await prisma.school.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!school) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const admins = await prisma.user.findMany({
      where: {
        schoolId: id,
        role: Role.SCHOOL_ADMIN,
      },
      orderBy: {
        createdAt: "desc",
      },
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

    return NextResponse.json({ data: admins }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}, [Role.SUPER_ADMIN]);
