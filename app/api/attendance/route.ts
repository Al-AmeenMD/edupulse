import { AttendanceStatus, Role } from "@prisma/client";
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
        classId?: string;
        date?: string;
        attendance?: Array<{
          studentId?: string;
          status?: string;
          note?: string;
        }>;
      };

      const classId = body.classId?.trim();
      const date = body.date?.trim();
      const attendance = body.attendance;

      if (!classId || !date || !attendance || !Array.isArray(attendance)) {
        return NextResponse.json(
          { error: "classId, date, and attendance array are required" },
          { status: 400 }
        );
      }

      if (attendance.length === 0) {
        return NextResponse.json(
          { error: "attendance array must not be empty" },
          { status: 400 }
        );
      }

      // Validate each status
      const validStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
      for (const item of attendance) {
        if (!item.studentId || !item.status) {
          return NextResponse.json(
            { error: "Each attendance record must contain studentId and status" },
            { status: 400 }
          );
        }
        if (!validStatuses.includes(item.status)) {
          return NextResponse.json(
            { error: `Invalid status: ${item.status}. Must be one of PRESENT, ABSENT, LATE, EXCUSED` },
            { status: 400 }
          );
        }
      }

      // Parse date to UTC Date object to avoid local timezone shifts
      const dateParts = date.split("-");
      if (dateParts.length !== 3) {
        return NextResponse.json(
          { error: "Invalid date format, expected YYYY-MM-DD" },
          { status: 400 }
        );
      }
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const dateOnly = new Date(Date.UTC(year, month, day));

      if (isNaN(dateOnly.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }

      // Verify class exists and belongs to this school
      const classRecord = await prisma.class.findUnique({
        where: { id: classId },
        select: { schoolId: true, teacherId: true },
      });

      if (!classRecord || classRecord.schoolId !== schoolId) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }

      let targetTeacherId: string;

      if (req.user.role === Role.TEACHER) {
        const teacher = await prisma.teacher.findUnique({
          where: { userId: req.user.userId },
          select: { id: true },
        });

        if (!teacher) {
          return NextResponse.json(
            { error: "Teacher record not found" },
            { status: 404 }
          );
        }

        if (classRecord.teacherId !== teacher.id) {
          return NextResponse.json(
            { error: "Forbidden: You are not the assigned teacher for this class" },
            { status: 403 }
          );
        }

        targetTeacherId = teacher.id;
      } else {
        // For SCHOOL_ADMIN
        if (!classRecord.teacherId) {
          return NextResponse.json(
            { error: "Cannot mark attendance: No teacher is assigned to this class" },
            { status: 400 }
          );
        }
        targetTeacherId = classRecord.teacherId;
      }

      // Get enrolled student IDs for this class
      const enrollments = await prisma.classEnrollment.findMany({
        where: { classId },
        select: { studentId: true },
      });
      const enrolledStudentIds = new Set(enrollments.map((e) => e.studentId));

      // Verify each student in the array is enrolled in this class
      for (const item of attendance) {
        if (!item.studentId || !enrolledStudentIds.has(item.studentId)) {
          return NextResponse.json(
            { error: `Student with ID ${item.studentId} is not enrolled in this class` },
            { status: 400 }
          );
        }
      }

      // Prepare upsert operations inside a transaction
      const operations = attendance.map((item) => {
        const studentId = item.studentId!;
        const status = item.status as AttendanceStatus;
        const note = item.note?.trim() || null;

        return prisma.attendance.upsert({
          where: {
            schoolId_studentId_classId_date: {
              schoolId,
              studentId,
              classId,
              date: dateOnly,
            },
          },
          update: {
            status,
            note,
            teacherId: targetTeacherId,
          },
          create: {
            schoolId,
            studentId,
            classId,
            teacherId: targetTeacherId,
            date: dateOnly,
            status,
            note,
          },
        });
      });

      const savedRecords = await prisma.$transaction(operations);

      return NextResponse.json({ data: savedRecords }, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.TEACHER, Role.SCHOOL_ADMIN]
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
      const classId = searchParams.get("classId");
      const dateParam = searchParams.get("date");
      const studentIdParam = searchParams.get("studentId");
      const statusParam = searchParams.get("status");
      const startDateParam = searchParams.get("startDate");
      const endDateParam = searchParams.get("endDate");

      if (!classId) {
        return NextResponse.json(
          { error: "classId is required" },
          { status: 400 }
        );
      }

      // Verify class belongs to this school
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

      const where: any = {
        schoolId,
        classId,
      };

      if (dateParam) {
        const parts = dateParam.split("-");
        if (parts.length === 3) {
          const d = new Date(
            Date.UTC(
              parseInt(parts[0], 10),
              parseInt(parts[1], 10) - 1,
              parseInt(parts[2], 10)
            )
          );
          if (!isNaN(d.getTime())) {
            where.date = d;
          }
        }
      }

      if (studentIdParam) {
        where.studentId = studentIdParam;
      }

      if (statusParam) {
        const validStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
        if (validStatuses.includes(statusParam)) {
          where.status = statusParam;
        }
      }

      // Date range filtering
      if (startDateParam || endDateParam) {
        const dateFilter: any = {};
        if (startDateParam) {
          const parts = startDateParam.split("-");
          if (parts.length === 3) {
            const d = new Date(
              Date.UTC(
                parseInt(parts[0], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2], 10)
              )
            );
            if (!isNaN(d.getTime())) {
              dateFilter.gte = d;
            }
          }
        }
        if (endDateParam) {
          const parts = endDateParam.split("-");
          if (parts.length === 3) {
            const d = new Date(
              Date.UTC(
                parseInt(parts[0], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2], 10)
              )
            );
            if (!isNaN(d.getTime())) {
              dateFilter.lte = d;
            }
          }
        }
        if (Object.keys(dateFilter).length > 0) {
          where.date = {
            ...where.date,
            ...dateFilter,
          };
        }
      }

      const attendanceRecords = await prisma.attendance.findMany({
        where,
        orderBy: {
          date: "desc",
        },
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
              level: true,
              section: true,
            },
          },
        },
      });

      return NextResponse.json({ data: attendanceRecords }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.TEACHER, Role.SCHOOL_ADMIN]
);
