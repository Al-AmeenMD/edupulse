import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const GET = withAuth(
  async (req, context) => {
    try {
      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { id } = (await context.params) as Awaited<RouteContext["params"]>;

      const student = await prisma.student.findUnique({
        where: { id },
        include: {
          classEnrollments: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  level: true,
                  academicYear: true,
                },
              },
            },
          },
        },
      });

      if (!student || student.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Student not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ data: student }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.TEACHER]
);

export const PATCH = withAuth(
  async (req, context) => {
    try {
      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const { id } = (await context.params) as Awaited<RouteContext["params"]>;

      const existingStudent = await prisma.student.findUnique({
        where: { id },
      });

      if (!existingStudent || existingStudent.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Student not found" },
          { status: 404 }
        );
      }

      const body = (await req.json()) as {
        firstName?: string;
        lastName?: string;
        dateOfBirth?: string | null;
        gender?: string | null;
        address?: string | null;
        admissionLevel?: string | null;
        guardianName?: string | null;
        guardianPhone?: string | null;
        guardianEmail?: string | null;
        isActive?: boolean;
      };

      const updateData: any = {};

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

      if (body.dateOfBirth !== undefined) {
        updateData.dateOfBirth = body.dateOfBirth
          ? new Date(body.dateOfBirth)
          : null;
      }

      if (body.gender !== undefined) {
        updateData.gender = body.gender?.trim() || null;
      }

      if (body.address !== undefined) {
        updateData.address = body.address?.trim() || null;
      }

      if (body.admissionLevel !== undefined) {
        updateData.admissionLevel = body.admissionLevel?.trim() || null;
      }

      if (body.guardianName !== undefined) {
        updateData.guardianName = body.guardianName?.trim() || null;
      }

      if (body.guardianPhone !== undefined) {
        updateData.guardianPhone = body.guardianPhone?.trim() || null;
      }

      if (body.guardianEmail !== undefined) {
        updateData.guardianEmail = body.guardianEmail?.trim() || null;
      }

      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
      }

      const updatedStudent = await prisma.student.update({
        where: { id },
        data: updateData,
        include: {
          classEnrollments: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  level: true,
                  academicYear: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({ data: updatedStudent }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
