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

      const teacher = await prisma.teacher.findUnique({
        where: { id },
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

      if (!teacher) {
        return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      }

      if (teacher.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Forbidden: Access denied to teacher from another school" },
          { status: 403 }
        );
      }

      return NextResponse.json({ data: teacher }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
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

      const existingTeacher = await prisma.teacher.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          schoolId: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!existingTeacher) {
        return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      }

      if (existingTeacher.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Forbidden: Cannot edit teacher from another school" },
          { status: 403 }
        );
      }

      const body = (await req.json()) as {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        employeeId?: string;
        qualification?: string;
        dob?: string | null;
        isActive?: boolean;
      };

      const updateUserData: any = {};
      const updateTeacherData: any = {};

      if (body.firstName !== undefined) {
        const firstName = body.firstName.trim();
        if (!firstName) {
          return NextResponse.json(
            { error: "First name is required" },
            { status: 400 }
          );
        }
        updateUserData.firstName = firstName;
      }

      if (body.lastName !== undefined) {
        const lastName = body.lastName.trim();
        if (!lastName) {
          return NextResponse.json(
            { error: "Last name is required" },
            { status: 400 }
          );
        }
        updateUserData.lastName = lastName;
      }

      if (body.email !== undefined) {
        const email = body.email.trim().toLowerCase();
        if (!email || !emailRegex.test(email)) {
          return NextResponse.json(
            { error: "Invalid email format" },
            { status: 400 }
          );
        }

        if (email !== existingTeacher.user.email) {
          const duplicateUser = await prisma.user.findFirst({
            where: {
              email,
              id: { not: existingTeacher.userId },
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

        updateUserData.email = email;
      }

      if (body.phone !== undefined) {
        updateUserData.phone = body.phone.trim() || null;
      }

      if (body.isActive !== undefined) {
        updateUserData.isActive = body.isActive;
      }

      if (body.employeeId !== undefined) {
        updateTeacherData.employeeId = body.employeeId.trim() || null;
      }

      if (body.qualification !== undefined) {
        updateTeacherData.qualification = body.qualification.trim() || null;
      }

      if (body.dob !== undefined) {
        updateTeacherData.dob = body.dob ? new Date(body.dob) : null;
      }

      const updatedTeacher = await prisma.$transaction(async (tx) => {
        if (Object.keys(updateUserData).length > 0) {
          await tx.user.update({
            where: { id: existingTeacher.userId },
            data: updateUserData,
          });
        }

        if (Object.keys(updateTeacherData).length > 0) {
          await tx.teacher.update({
            where: { id: existingTeacher.id },
            data: updateTeacherData,
          });
        }

        return await tx.teacher.findUnique({
          where: { id: existingTeacher.id },
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
      });

      return NextResponse.json({ data: updatedTeacher }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);

export const DELETE = withAuth(
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

      const existingTeacher = await prisma.teacher.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          schoolId: true,
        },
      });

      if (!existingTeacher) {
        return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      }

      if (existingTeacher.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Forbidden: Cannot deactivate teacher from another school" },
          { status: 403 }
        );
      }

      // Soft delete by updating user.isActive to false
      const updatedTeacher = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existingTeacher.userId },
          data: { isActive: false },
        });

        return await tx.teacher.findUnique({
          where: { id: existingTeacher.id },
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
      });

      return NextResponse.json(
        { message: "Teacher deactivated successfully", data: updatedTeacher },
        { status: 200 }
      );
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
