import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

/**
 * Helper to parse a "YYYY-MM-DD" string into a UTC Date.
 * Returns null if the string is invalid.
 */
function parseDateParam(value: string): Date | null {
  const parts = value.split("-");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(Date.UTC(year, month, day));

  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date to "YYYY-MM-DD" string in UTC.
 */
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

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
      const classId = searchParams.get("classId");
      const startDateParam = searchParams.get("startDate");
      const endDateParam = searchParams.get("endDate");

      // classId is required
      if (!classId) {
        return NextResponse.json(
          { error: "classId is required" },
          { status: 400 }
        );
      }

      // Verify class exists and belongs to this school
      const classRecord = await prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true },
      });

      if (!classRecord) {
        return NextResponse.json(
          { error: "Class not found or does not belong to this school" },
          { status: 404 }
        );
      }

      // Determine the date range — default to the current month
      let startDate: Date;
      let endDate: Date;

      if (startDateParam) {
        const parsed = parseDateParam(startDateParam);
        if (!parsed) {
          return NextResponse.json(
            { error: "Invalid startDate format, expected YYYY-MM-DD" },
            { status: 400 }
          );
        }
        startDate = parsed;
      } else {
        const now = new Date();
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      }

      if (endDateParam) {
        const parsed = parseDateParam(endDateParam);
        if (!parsed) {
          return NextResponse.json(
            { error: "Invalid endDate format, expected YYYY-MM-DD" },
            { status: 400 }
          );
        }
        endDate = parsed;
      } else {
        const now = new Date();
        // Last day of the current month
        endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      }

      // Fetch all students enrolled in this class
      const enrollments = await prisma.classEnrollment.findMany({
        where: { classId },
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Fetch attendance records for the class within the date range
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          schoolId,
          classId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          studentId: true,
          status: true,
        },
      });

      // Group attendance counts by studentId
      const attendanceByStudent = new Map<
        string,
        { present: number; absent: number; late: number; excused: number }
      >();

      for (const record of attendanceRecords) {
        let counts = attendanceByStudent.get(record.studentId);
        if (!counts) {
          counts = { present: 0, absent: 0, late: 0, excused: 0 };
          attendanceByStudent.set(record.studentId, counts);
        }

        switch (record.status) {
          case "PRESENT":
            counts.present++;
            break;
          case "ABSENT":
            counts.absent++;
            break;
          case "LATE":
            counts.late++;
            break;
          case "EXCUSED":
            counts.excused++;
            break;
        }
      }

      // Build per-student summary
      const students = enrollments.map((enrollment) => {
        const student = enrollment.student;
        const counts = attendanceByStudent.get(student.id) || {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };

        const totalDays =
          counts.present + counts.absent + counts.late + counts.excused;

        const attendanceRate =
          totalDays > 0
            ? Math.round(
                ((counts.present + counts.late + counts.excused) / totalDays) *
                  100
              )
            : 0;

        return {
          studentId: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          totalDays,
          present: counts.present,
          absent: counts.absent,
          late: counts.late,
          excused: counts.excused,
          attendanceRate,
        };
      });

      return NextResponse.json(
        {
          data: {
            classId,
            period: {
              startDate: formatDate(startDate),
              endDate: formatDate(endDate),
            },
            students,
          },
        },
        { status: 200 }
      );
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.TEACHER, Role.SCHOOL_ADMIN]
);
