import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { validateProprietorSchoolAccess } from "@/lib/auth/proprietor";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ---------------------------------------------------------------------------
// GET /api/schools/:id/proprietor — Get all linked Proprietors for a school
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (req, context) => {
    try {
      const { id: schoolId } = (await context.params) as Awaited<RouteContext["params"]>;

      if (req.user.role === "SCHOOL_ADMIN" && req.user.schoolId !== schoolId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (req.user.role === "PROPRIETOR") {
        const hasAccess = await validateProprietorSchoolAccess(req.user.userId, schoolId);
        if (!hasAccess) {
          return NextResponse.json({ error: "Forbidden: You do not own this school" }, { status: 403 });
        }
      }

      let proprietors: any[] = [];
      if (prisma.proprietorSchool) {
        const links = await prisma.proprietorSchool.findMany({
          where: { schoolId },
          include: {
            proprietor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true,
              },
            },
          },
        });
        proprietors = links.map((l) => l.proprietor);
      } else {
        proprietors = await prisma.$queryRaw`
          SELECT 
            u.id, u."firstName" as "firstName", u."lastName" as "lastName",
            u.email, u.phone, u.role, u."isActive" as "isActive", u."createdAt" as "createdAt"
          FROM proprietor_schools ps
          JOIN users u ON ps."proprietorId" = u.id
          WHERE ps."schoolId" = ${schoolId}
        `;
      }

      return NextResponse.json({ data: proprietors }, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PROPRIETOR]
);

// ---------------------------------------------------------------------------
// POST /api/schools/:id/proprietor — Link an existing or new Proprietor (SUPER_ADMIN)
// ---------------------------------------------------------------------------
export const POST = withAuth(
  async (req, context) => {
    try {
      const { id: schoolId } = (await context.params) as Awaited<RouteContext["params"]>;

      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true, name: true },
      });

      if (!school) {
        return NextResponse.json({ error: "School not found" }, { status: 404 });
      }

      const body = (await req.json()) as {
        proprietorId?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        password?: string;
      };

      let targetProprietorId = body.proprietorId?.trim();

      if (!targetProprietorId) {
        const email = body.email?.trim().toLowerCase();
        const firstName = body.firstName?.trim();
        const lastName = body.lastName?.trim();
        const phone = body.phone?.trim() || undefined;
        const password = body.password;

        if (!email) {
          return NextResponse.json(
            { error: "Either proprietorId or email is required" },
            { status: 400 }
          );
        }

        // Search if existing Proprietor user exists by email
        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true },
        });

        if (existingUser) {
          if (existingUser.role !== "PROPRIETOR") {
            return NextResponse.json(
              { error: "User exists but is not a Proprietor account" },
              { status: 400 }
            );
          }
          targetProprietorId = existingUser.id;
        } else {
          // Create a new PROPRIETOR user
          if (!firstName || !lastName || !password) {
            return NextResponse.json(
              { error: "First name, last name, email, and password are required to create a new Proprietor" },
              { status: 400 }
            );
          }

          if (password.length < 8) {
            return NextResponse.json(
              { error: "Password must be at least 8 characters" },
              { status: 400 }
            );
          }

          const hashedPassword = await hashPassword(password);

          const newProprietor = await prisma.user.create({
            data: {
              firstName,
              lastName,
              email,
              phone,
              password: hashedPassword,
              role: Role.PROPRIETOR,
              schoolId: null, // Proprietors use ProprietorSchool join table
            },
            select: { id: true },
          });

          targetProprietorId = newProprietor.id;
        }
      }

      // Link Proprietor to School in ProprietorSchool join table
      if (prisma.proprietorSchool) {
        const existingLink = await prisma.proprietorSchool.findUnique({
          where: {
            proprietorId_schoolId: {
              proprietorId: targetProprietorId,
              schoolId,
            },
          },
        });

        if (!existingLink) {
          await prisma.proprietorSchool.create({
            data: {
              proprietorId: targetProprietorId,
              schoolId,
            },
          });
        }
      } else {
        const existingRaw: any[] = await prisma.$queryRaw`
          SELECT id FROM proprietor_schools WHERE "proprietorId" = ${targetProprietorId} AND "schoolId" = ${schoolId} LIMIT 1
        `;
        if (existingRaw.length === 0) {
          const genId = `c${Date.now()}${Math.random().toString(36).substring(2, 7)}`;
          await prisma.$executeRaw`
            INSERT INTO proprietor_schools (id, "proprietorId", "schoolId", "createdAt", "updatedAt")
            VALUES (${genId}, ${targetProprietorId}, ${schoolId}, NOW(), NOW())
          `;
        }
      }

      const linkedProprietor = await prisma.user.findUnique({
        where: { id: targetProprietorId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      return NextResponse.json({ data: linkedProprietor }, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SUPER_ADMIN]
);
