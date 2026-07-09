import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
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
        dateOfBirth?: string;
        gender?: string;
        address?: string;
        guardianName?: string;
        guardianPhone?: string;
        guardianEmail?: string;
      };

      const firstName = body.firstName?.trim();
      const lastName = body.lastName?.trim();
      const gender = body.gender?.trim() || undefined;
      const address = body.address?.trim() || undefined;
      const guardianName = body.guardianName?.trim() || undefined;
      const guardianPhone = body.guardianPhone?.trim() || undefined;
      const guardianEmail = body.guardianEmail?.trim() || undefined;

      if (!firstName || !lastName) {
        return NextResponse.json(
          { error: "First name and last name are required" },
          { status: 400 }
        );
      }

      const count = await prisma.student.count({
        where: { schoolId },
      });

      const currentYear = new Date().getFullYear();
      const paddedCount = String(count + 1).padStart(3, "0");
      const studentId = `STU/${currentYear}/${paddedCount}`;

      const student = await prisma.student.create({
        data: {
          schoolId,
          studentId,
          firstName,
          lastName,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
          gender,
          address,
          guardianName,
          guardianPhone,
          guardianEmail,
        },
      });

      return NextResponse.json({ data: student }, { status: 201 });
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
      const classId = searchParams.get("classId")?.trim();

      const where: any = {
        schoolId,
      };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { studentId: { contains: search, mode: "insensitive" } },
        ];
      }

      if (isActiveParam === "true") {
        where.isActive = true;
      } else if (isActiveParam === "false") {
        where.isActive = false;
      }

      if (classId) {
        where.classEnrollments = {
          some: {
            classId,
          },
        };
      }

      const students = await prisma.student.findMany({
        where,
        orderBy: {
          firstName: "asc",
        },
        include: {
          classEnrollments: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  level: true,
                  section: true,
                  academicYear: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({ data: students }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.TEACHER]
);
