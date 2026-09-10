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
          include: {
            school: {
              select: {
                id: true,
                name: true,
                address: true,
                email: true,
                phone: true,
                logoUrl: true,
                studentIdPrefix: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                  select: {
                    students: true,
                    teachers: true,
                    classes: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });
      } else {
        const rawRows: any[] = await prisma.$queryRaw`
          SELECT 
            ps."createdAt" as "createdAt",
            s.id, s.name, s.address, s.email, s.phone, s."logoUrl" as "logoUrl",
            s."studentIdPrefix" as "studentIdPrefix", s."isActive" as "isActive",
            s."createdAt" as "schoolCreatedAt", s."updatedAt" as "schoolUpdatedAt",
            (SELECT COUNT(*)::int FROM students st WHERE st."schoolId" = s.id AND st."isActive" = true) as "studentCount",
            (SELECT COUNT(*)::int FROM users u WHERE u."schoolId" = s.id AND u.role = 'TEACHER') as "teacherCount",
            (SELECT COUNT(*)::int FROM classes c WHERE c."schoolId" = s.id) as "classCount"
          FROM proprietor_schools ps
          JOIN schools s ON ps."schoolId" = s.id
          WHERE ps."proprietorId" = ${proprietorId}
          ORDER BY ps."createdAt" DESC
        `;
        links = rawRows.map((r) => ({
          createdAt: r.createdAt,
          school: {
            id: r.id,
            name: r.name,
            address: r.address,
            email: r.email,
            phone: r.phone,
            logoUrl: r.logoUrl,
            studentIdPrefix: r.studentIdPrefix,
            isActive: r.isActive,
            createdAt: r.schoolCreatedAt,
            updatedAt: r.schoolUpdatedAt,
            _count: {
              students: r.studentCount || 0,
              teachers: r.teacherCount || 0,
              classes: r.classCount || 0,
            },
          },
        }));
      }

      const schools = links.map((link) => ({
        id: link.school.id,
        name: link.school.name,
        address: link.school.address,
        email: link.school.email,
        phone: link.school.phone,
        logoUrl: link.school.logoUrl,
        studentIdPrefix: link.school.studentIdPrefix,
        isActive: link.school.isActive,
        createdAt: link.school.createdAt,
        updatedAt: link.school.updatedAt,
        studentCount: link.school._count.students,
        teacherCount: link.school._count.teachers,
        classCount: link.school._count.classes,
        linkedAt: link.createdAt,
      }));

      return NextResponse.json({ data: schools }, { status: 200 });
    } catch (err: any) {
      console.error("GET /api/proprietor/schools error:", err);
      return NextResponse.json(
        { error: err?.message || "Internal server error" },
        { status: 500 }
      );
    }
  },
  ["PROPRIETOR" as Role]
);
