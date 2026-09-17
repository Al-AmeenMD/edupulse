import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";
import {
  createTeacherCore,
  TeacherValidationError,
} from "@/lib/services/teacherService";

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
        dob?: string;
      };

      const result = await createTeacherCore({
        schoolId,
        firstName: body.firstName || "",
        lastName: body.lastName || "",
        email: body.email || "",
        password: body.password || "",
        autoGeneratePassword: false, // Strict: requires password
        phone: body.phone,
        employeeId: body.employeeId,
        qualification: body.qualification,
        dob: body.dob,
        mustChangePassword: false,
      });

      return NextResponse.json({ data: result.teacher }, { status: 201 });
    } catch (err: any) {
      if (err instanceof TeacherValidationError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.statusCode }
        );
      }
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
          dob: true,
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
