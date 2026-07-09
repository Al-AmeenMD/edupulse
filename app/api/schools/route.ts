import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withAuth(async (req) => {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      address?: string;
      phone?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase() || undefined;
    const address = body.address?.trim() || undefined;
    const phone = body.phone?.trim() || undefined;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (email && !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (email) {
      const existingSchool = await prisma.school.findFirst({
        where: { email },
        select: { id: true },
      });

      if (existingSchool) {
        return NextResponse.json(
          { error: "Already exists" },
          { status: 409 }
        );
      }
    }

    const school = await prisma.school.create({
      data: {
        name,
        email,
        address,
        phone,
      },
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

    return NextResponse.json({ data: school }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}, [Role.SUPER_ADMIN]);

export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const isActiveParam = searchParams.get("isActive");

    const where: {
      name?: { contains: string; mode: "insensitive" };
      isActive?: boolean;
    } = {};

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    if (isActiveParam === "true") {
      where.isActive = true;
    }

    if (isActiveParam === "false") {
      where.isActive = false;
    }

    const schools = await prisma.school.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
          },
        },
      },
    });

    return NextResponse.json({ data: schools }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}, [Role.SUPER_ADMIN]);
