import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

export const POST = withAuth(
  async (req) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const body = (await req.json()) as {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        password?: string;
        employeeId?: string;
        qualification?: string;
      };

      const firstName = body.firstName?.trim();
      const lastName = body.lastName?.trim();
      const email = body.email?.trim().toLowerCase();
      const phone = body.phone?.trim() || undefined;
      const password = body.password;
      const employeeId = body.employeeId?.trim() || undefined;
      const qualification = body.qualification?.trim() || undefined;

      if (!firstName || !lastName || !email || !password) {
        return NextResponse.json(
          { error: "First name, last name, email, and password are required" },
          { status: 400 }
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Email is already registered" },
          { status: 409 }
        );
      }

      const hashedPassword = await hashPassword(password);

      const teacher = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            schoolId,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            role: Role.TEACHER,
          },
        });

        return await tx.teacher.create({
          data: {
            userId: user.id,
            schoolId,
            employeeId,
            qualification,
          },
          select: {
            id: true,
            userId: true,
            schoolId: true,
            employeeId: true,
            qualification: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });
      });

      return NextResponse.json({ data: teacher }, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);

export const GET = withAuth(
  async (req) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search")?.trim();
      const isActiveParam = searchParams.get("isActive");

      const where: any = {
        schoolId,
      };

      const userConditions: any[] = [];

      if (search) {
        userConditions.push({
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        });
      }

      if (isActiveParam === "true") {
        userConditions.push({ isActive: true });
      } else if (isActiveParam === "false") {
        userConditions.push({ isActive: false });
      }

      if (userConditions.length > 0) {
        where.user = {
          AND: userConditions,
        };
      }

      const teachers = await prisma.teacher.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          userId: true,
          schoolId: true,
          employeeId: true,
          qualification: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      return NextResponse.json({ data: teachers }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
