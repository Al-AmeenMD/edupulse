import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async (req) => {
    try {
      const proprietorId = req.user.userId;

      let links: any[] = [];

      if (prisma.proprietorSchool) {
        links = await prisma.proprietorSchool.findMany({
          where: { proprietorId },
          select: {
            schoolId: true,
            school: {
              select: {
                id: true,
                name: true,
                studentIdPrefix: true,
              },
            },
          },
        });
      } else {
        const rawRows: any[] = await prisma.$queryRaw`
          SELECT s.id as "schoolId", s.name, s."studentIdPrefix" as "studentIdPrefix"
          FROM proprietor_schools ps
          JOIN schools s ON ps."schoolId" = s.id
          WHERE ps."proprietorId" = ${proprietorId}
        `;
        links = rawRows.map((r) => ({
          schoolId: r.schoolId,
          school: {
            id: r.schoolId,
            name: r.name,
            studentIdPrefix: r.studentIdPrefix,
          },
        }));
      }

      const schoolIds = links.map((l) => l.schoolId);

      if (schoolIds.length === 0) {
        return NextResponse.json(
          {
            totalSchools: 0,
            totalStudents: 0,
            totalRevenueCollected: 0,
            totalOutstandingBalance: 0,
            overallAttendanceRate: 0,
            schools: [],
          },
          { status: 200 }
        );
      }

      // 2. Aggregate Standalone Payments across owned schools
      const standalonePaymentAgg = await prisma.payment.aggregate({
        where: { schoolId: { in: schoolIds }, packagePaymentId: null, deletedAt: null },
        _sum: { amount: true },
      });
      const standaloneRevenue = Number(standalonePaymentAgg._sum.amount || 0);

      // 3. Aggregate Package Payments across owned schools
      const packagePaymentAgg = await prisma.packagePayment.aggregate({
        where: { schoolId: { in: schoolIds }, deletedAt: null },
        _sum: { amount: true },
      });
      const packageRevenue = Number(packagePaymentAgg._sum.amount || 0);

      const totalRevenueCollected = standaloneRevenue + packageRevenue;

      // 4. Aggregate Outstanding Fees across owned schools
      const feeRecords = await prisma.fee.findMany({
        where: { schoolId: { in: schoolIds }, status: { in: ["PENDING", "OVERDUE", "PARTIAL"] } },
        select: { amountDue: true, amountPaid: true, schoolId: true },
      });

      let totalOutstandingBalance = 0;
      const feeBalanceBySchool = new Map<string, number>();

      for (const f of feeRecords) {
        const bal = Math.max(0, Number(f.amountDue) - Number(f.amountPaid));
        totalOutstandingBalance += bal;

        const currentSBal = feeBalanceBySchool.get(f.schoolId) || 0;
        feeBalanceBySchool.set(f.schoolId, currentSBal + bal);
      }

      // 5. Aggregate Total Expenses across owned schools
      const expenseAgg = await prisma.expense.aggregate({
        where: { schoolId: { in: schoolIds }, deletedAt: null },
        _sum: { amount: true },
      });
      const totalExpensesIncurred = Number(expenseAgg._sum.amount || 0);
      const netOperatingPosition = totalRevenueCollected - totalExpensesIncurred;

      // 6. Aggregate Total Students enrolled
      const totalStudents = await prisma.student.count({
        where: { schoolId: { in: schoolIds }, isActive: true },
      });

      // 7. Aggregate Attendance across owned schools
      const attendanceRecords = await prisma.attendance.findMany({
        where: { schoolId: { in: schoolIds } },
        select: { status: true, schoolId: true },
      });

      let totalPresent = 0;
      let totalLate = 0;
      let totalExcused = 0;
      let totalAbsent = 0;

      const attendanceBySchool = new Map<
        string,
        { present: number; late: number; excused: number; absent: number }
      >();

      for (const rec of attendanceRecords) {
        let sc = attendanceBySchool.get(rec.schoolId);
        if (!sc) {
          sc = { present: 0, late: 0, excused: 0, absent: 0 };
          attendanceBySchool.set(rec.schoolId, sc);
        }

        switch (rec.status) {
          case "PRESENT":
            totalPresent++;
            sc.present++;
            break;
          case "LATE":
            totalLate++;
            sc.late++;
            break;
          case "EXCUSED":
            totalExcused++;
            sc.excused++;
            break;
          case "ABSENT":
            totalAbsent++;
            sc.absent++;
            break;
        }
      }

      const totalDaysAll = totalPresent + totalLate + totalExcused + totalAbsent;
      const overallAttendanceRate =
        totalDaysAll > 0
          ? Math.round(((totalPresent + totalLate + totalExcused) / totalDaysAll) * 100)
          : 0;

      // 8. Build per-school breakdown list
      const schoolBreakdowns = await Promise.all(
        links.map(async (l) => {
          const sId = l.schoolId;

          const sStandaloneAgg = await prisma.payment.aggregate({
            where: { schoolId: sId, packagePaymentId: null, deletedAt: null },
            _sum: { amount: true },
          });
          const sPkgAgg = await prisma.packagePayment.aggregate({
            where: { schoolId: sId, deletedAt: null },
            _sum: { amount: true },
          });
          const sRev = Number(sStandaloneAgg._sum.amount || 0) + Number(sPkgAgg._sum.amount || 0);

          const sBal = feeBalanceBySchool.get(sId) || 0;

          const sExpAgg = await prisma.expense.aggregate({
            where: { schoolId: sId, deletedAt: null },
            _sum: { amount: true },
          });
          const sExpenses = Number(sExpAgg._sum.amount || 0);
          const sNetPosition = sRev - sExpenses;

          const sStudents = await prisma.student.count({
            where: { schoolId: sId, isActive: true },
          });

          const sAdmins = await prisma.user.count({
            where: { schoolId: sId, role: Role.SCHOOL_ADMIN, isActive: true },
          });

          const att = attendanceBySchool.get(sId) || { present: 0, late: 0, excused: 0, absent: 0 };
          const sDays = att.present + att.late + att.excused + att.absent;
          const sAttRate =
            sDays > 0 ? Math.round(((att.present + att.late + att.excused) / sDays) * 100) : 0;

          return {
            id: sId,
            name: l.school.name,
            code: l.school.studentIdPrefix || "SCH",
            city: null,
            state: null,
            status: "ACTIVE",
            schoolAdminCount: sAdmins,
            totalStudents: sStudents,
            totalRevenueCollected: sRev,
            totalOutstandingBalance: sBal,
            totalExpensesIncurred: sExpenses,
            netOperatingPosition: sNetPosition,
            attendanceRate: sAttRate,
          };
        })
      );

      return NextResponse.json(
        {
          totalSchools: schoolIds.length,
          totalStudents,
          totalRevenueCollected,
          totalOutstandingBalance,
          totalExpensesIncurred,
          netOperatingPosition,
          overallAttendanceRate,
          schools: schoolBreakdowns,
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
  ["PROPRIETOR" as Role]
);
