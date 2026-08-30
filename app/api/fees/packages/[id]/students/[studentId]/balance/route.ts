import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
    studentId: string;
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

      const { id: packageId, studentId } = await context.params;

      if (!packageId || !studentId) {
        return NextResponse.json(
          { error: "Package ID and Student ID are required" },
          { status: 400 }
        );
      }

      // Fetch package
      const pkg = await prisma.feePackage.findFirst({
        where: { id: packageId, schoolId },
        include: {
          items: {
            include: {
              feeStructure: true,
            },
          },
        },
      });

      if (!pkg) {
        return NextResponse.json(
          { error: "Fee package not found" },
          { status: 404 }
        );
      }

      // Fetch student
      const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          admissionLevel: true,
          classEnrollments: {
            select: { class: { select: { id: true, name: true } } },
            take: 1,
            orderBy: { enrolledAt: "desc" },
          },
        },
      });

      if (!student) {
        return NextResponse.json(
          { error: "Student not found" },
          { status: 404 }
        );
      }

      const bundledStructureIds = pkg.items.map((it) => it.feeStructureId);

      // Fetch student's assigned fees for this package's fee structures
      const fees = await prisma.fee.findMany({
        where: {
          schoolId,
          studentId,
          feeStructureId: { in: bundledStructureIds },
        },
        include: {
          feeStructure: true,
        },
      });

      if (fees.length === 0) {
        return NextResponse.json(
          { error: "No assigned fee records found for this student and fee package" },
          { status: 404 }
        );
      }

      let totalDue = new Prisma.Decimal(0);
      let totalPaid = new Prisma.Decimal(0);
      let totalRemaining = new Prisma.Decimal(0);

      const components = pkg.items.map((item) => {
        const matchingFee = fees.find((f) => f.feeStructureId === item.feeStructureId);
        if (!matchingFee) {
          return {
            feeId: null,
            feeStructureId: item.feeStructureId,
            name: item.feeStructure?.name || "Unknown Structure",
            type: item.feeStructure?.type || "MISCELLANEOUS",
            amountDue: new Prisma.Decimal(item.feeStructure?.amount || 0).toFixed(2),
            amountPaid: "0.00",
            remainingBalance: new Prisma.Decimal(item.feeStructure?.amount || 0).toFixed(2),
            status: "UNASSIGNED",
            isAssigned: false,
          };
        }

        const due = new Prisma.Decimal(matchingFee.amountDue);
        const paid = new Prisma.Decimal(matchingFee.amountPaid);
        const rem = matchingFee.status === "WAIVED"
          ? new Prisma.Decimal(0)
          : due.sub(paid).greaterThan(0)
          ? due.sub(paid)
          : new Prisma.Decimal(0);

        totalDue = totalDue.add(due);
        totalPaid = totalPaid.add(paid);
        totalRemaining = totalRemaining.add(rem);

        return {
          feeId: matchingFee.id,
          feeStructureId: matchingFee.feeStructureId,
          name: matchingFee.feeStructure.name,
          type: matchingFee.feeStructure.type,
          amountDue: due.toFixed(2),
          amountPaid: paid.toFixed(2),
          remainingBalance: rem.toFixed(2),
          status: matchingFee.status,
          isAssigned: true,
        };
      });

      return NextResponse.json(
        {
          data: {
            package: {
              id: pkg.id,
              name: pkg.name,
              academicYear: pkg.academicYear,
              term: pkg.term,
              totalAmount: new Prisma.Decimal(
                pkg.items.reduce((s, it) => s + Number(it.feeStructure?.amount || 0), 0)
              ).toFixed(2),
            },
            student: {
              id: student.id,
              studentId: student.studentId,
              firstName: student.firstName,
              lastName: student.lastName,
              admissionLevel: student.admissionLevel,
              className: student.classEnrollments[0]?.class?.name || null,
            },
            components,
            totalDue: totalDue.toFixed(2),
            totalPaid: totalPaid.toFixed(2),
            totalRemaining: totalRemaining.toFixed(2),
          },
        },
        { status: 200 }
      );
    } catch (err: any) {
      console.error("GET /api/fees/packages/[id]/students/[studentId]/balance error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
