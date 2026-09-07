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

      // MODE 1: School-Wide Summary Across All Classes (classId omitted)
      if (!classId) {
        const allClasses = await prisma.class.findMany({
          where: { schoolId },
          select: { id: true, name: true, level: true },
          orderBy: { name: "asc" },
        });

        const allEnrollments = await prisma.classEnrollment.findMany({
          where: { class: { schoolId } },
          select: { classId: true, studentId: true },
        });

        const enrolledCountByClass = new Map<string, number>();
        const totalEnrolledSet = new Set<string>();
        for (const en of allEnrollments) {
          totalEnrolledSet.add(en.studentId);
          enrolledCountByClass.set(
            en.classId,
            (enrolledCountByClass.get(en.classId) || 0) + 1
          );
        }

        const allAttendance = await prisma.attendance.findMany({
          where: {
            schoolId,
            date: { gte: startDate, lte: endDate },
          },
          select: {
            classId: true,
            studentId: true,
            status: true,
          },
        });

        let totalSchoolPresent = 0;
        let totalSchoolAbsent = 0;
        let totalSchoolLate = 0;
        let totalSchoolExcused = 0;

        const countsByClass = new Map<
          string,
          { present: number; absent: number; late: number; excused: number }
        >();

        for (const rec of allAttendance) {
          let c = countsByClass.get(rec.classId);
          if (!c) {
            c = { present: 0, absent: 0, late: 0, excused: 0 };
            countsByClass.set(rec.classId, c);
          }
          switch (rec.status) {
            case "PRESENT":
              c.present++;
              totalSchoolPresent++;
              break;
            case "ABSENT":
              c.absent++;
              totalSchoolAbsent++;
              break;
            case "LATE":
              c.late++;
              totalSchoolLate++;
              break;
            case "EXCUSED":
              c.excused++;
              totalSchoolExcused++;
              break;
          }
        }

        const totalSchoolDays =
          totalSchoolPresent +
          totalSchoolAbsent +
          totalSchoolLate +
          totalSchoolExcused;

        const overallAttendanceRate =
          totalSchoolDays > 0
            ? Math.round(
                ((totalSchoolPresent + totalSchoolLate + totalSchoolExcused) /
                  totalSchoolDays) *
                  100
              )
            : 0;

        const classSummaries = allClasses.map((cls) => {
          const c = countsByClass.get(cls.id) || {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          };
          const classTotalDays = c.present + c.absent + c.late + c.excused;
          const rate =
            classTotalDays > 0
              ? Math.round(
                  ((c.present + c.late + c.excused) / classTotalDays) * 100
                )
              : 0;

          return {
            classId: cls.id,
            className: cls.name,
            level: cls.level || null,
            enrolledStudents: enrolledCountByClass.get(cls.id) || 0,
            totalDays: classTotalDays,
            present: c.present,
            absent: c.absent,
            late: c.late,
            excused: c.excused,
            attendanceRate: rate,
          };
        });

        return NextResponse.json(
          {
            data: {
              period: {
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
              },
              schoolOverview: {
                totalStudents: totalEnrolledSet.size,
                totalDays: totalSchoolDays,
                present: totalSchoolPresent,
                absent: totalSchoolAbsent,
                late: totalSchoolLate,
                excused: totalSchoolExcused,
                overallAttendanceRate,
              },
              classes: classSummaries,
            },
          },
          { status: 200 }
        );
      }

      // MODE 2: Single-Class Attendance Summary (classId provided)
      const classRecord = await prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true, name: true, level: true },
      });

      if (!classRecord) {
        return NextResponse.json(
          { error: "Class not found or does not belong to this school" },
          { status: 404 }
        );
      }

      // Fetch active enrollments
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

      // Fetch attendance records for the class
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

      // Map of student details
      const studentMap = new Map<
        string,
        { id: string; studentId: string; firstName: string; lastName: string }
      >();

      for (const en of enrollments) {
        studentMap.set(en.student.id, en.student);
      }

      // Preserve historical students who had attendance in this class during date range
      const extraStudentIds = Array.from(attendanceByStudent.keys()).filter(
        (id) => !studentMap.has(id)
      );

      if (extraStudentIds.length > 0) {
        const extraStudents = await prisma.student.findMany({
          where: { id: { in: extraStudentIds } },
          select: { id: true, studentId: true, firstName: true, lastName: true },
        });
        for (const s of extraStudents) {
          studentMap.set(s.id, s);
        }
      }

      // Build student summary list
      const students = Array.from(studentMap.values()).map((student) => {
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
          code: student.studentId,
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
            className: classRecord.name,
            level: classRecord.level || null,
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
