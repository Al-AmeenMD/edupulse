import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GET = withAuth(async (_req, context) => {
  try {
    const { id } = (await context.params) as Awaited<RouteContext["params"]>;

    const school = await prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        phone: true,
        logoUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            students: true,
            classes: true,
          },
        },
      },
    });

    if (!school) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: school }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}, [Role.SUPER_ADMIN]);

export const PATCH = withAuth(async (req, context) => {
  try {
    const { id } = (await context.params) as Awaited<RouteContext["params"]>;
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      address?: string;
      phone?: string;
      logoUrl?: string;
      isActive?: boolean;
    };

    const existingSchool = await prisma.school.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!existingSchool) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: {
      name?: string;
      email?: string | null;
      address?: string | null;
      phone?: string | null;
      logoUrl?: string | null;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      const name = body.name.trim();

      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      data.name = name;
    }

    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();

      if (email && !emailRegex.test(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      if (email) {
        const duplicateSchool = await prisma.school.findFirst({
          where: {
            email,
            id: { not: id },
          },
          select: { id: true },
        });

        if (duplicateSchool) {
          return NextResponse.json(
            { error: "Already exists" },
            { status: 409 }
          );
        }
      }

      data.email = email || null;
    }

    if (body.address !== undefined) {
      data.address = body.address.trim() || null;
    }

    if (body.phone !== undefined) {
      data.phone = body.phone.trim() || null;
    }

    if (body.logoUrl !== undefined) {
      data.logoUrl = body.logoUrl.trim() || null;
    }

    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
    }

    const updatedSchool = await prisma.school.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        phone: true,
        logoUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: updatedSchool }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}, [Role.SUPER_ADMIN]);

export const DELETE = withAuth(async (_req, context) => {
  try {
    const { id } = (await context.params) as Awaited<RouteContext["params"]>;

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
        { error: "School is already inactive" },
        { status: 400 }
      );
    }

    await prisma.school.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json(
      { message: "School deactivated successfully" },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}, [Role.SUPER_ADMIN]);
