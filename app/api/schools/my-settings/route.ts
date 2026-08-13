import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

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

      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: {
          id: true,
          name: true,
          studentIdTemplate: true,
          studentIdPrefix: true,
          _count: {
            select: {
              students: true,
            },
          },
        },
      });

      if (!school) {
        return NextResponse.json({ error: "School not found" }, { status: 404 });
      }

      return NextResponse.json({ data: school }, { status: 200 });
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
        studentIdTemplate?: string;
        studentIdPrefix?: string;
      };

      const prefix = body.studentIdPrefix?.trim().toUpperCase();
      const template = body.studentIdTemplate?.trim();

      if (!prefix) {
        return NextResponse.json(
          { error: "Student ID prefix is required" },
          { status: 400 }
        );
      }

      if (prefix.length > 10) {
        return NextResponse.json(
          { error: "Student ID prefix must not exceed 10 characters" },
          { status: 400 }
        );
      }

      if (!template) {
        return NextResponse.json(
          { error: "Student ID template is required" },
          { status: 400 }
        );
      }

      // Validate sequence token presence
      const hasSequenceToken = /\{SEQ:\d+\}/.test(template);
      if (!hasSequenceToken) {
        return NextResponse.json(
          { error: "Template must contain a sequence token (e.g. {SEQ:3})" },
          { status: 400 }
        );
      }

      const updatedSchool = await prisma.school.update({
        where: { id: schoolId },
        data: {
          studentIdPrefix: prefix,
          studentIdTemplate: template,
        },
        select: {
          id: true,
          name: true,
          studentIdTemplate: true,
          studentIdPrefix: true,
          _count: {
            select: {
              students: true,
            },
          },
        },
      });

      return NextResponse.json({ data: updatedSchool }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
