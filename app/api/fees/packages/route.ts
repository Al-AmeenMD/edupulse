import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/fees/packages — List fee packages
// ---------------------------------------------------------------------------
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
      const academicYear = searchParams.get("academicYear")?.trim();
      const term = searchParams.get("term")?.trim();

      const whereClause: Prisma.FeePackageWhereInput = {
        schoolId,
        ...(academicYear && academicYear !== "ALL" ? { academicYear } : {}),
        ...(term && term !== "ALL" ? { term } : {}),
      };

      const packages = await prisma.feePackage.findMany({
        where: whereClause,
        include: {
          items: {
            include: {
              feeStructure: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  amount: true,
                  academicYear: true,
                  term: true,
                  dueDate: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Format response with calculated totalAmount
      const formattedPackages = packages.map((pkg) => {
        let total = new Prisma.Decimal(0);
        pkg.items.forEach((item) => {
          if (item.feeStructure?.amount) {
            total = total.add(new Prisma.Decimal(item.feeStructure.amount));
          }
        });

        return {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          academicYear: pkg.academicYear,
          term: pkg.term,
          totalAmount: total.toFixed(2),
          structuresCount: pkg.items.length,
          createdAt: pkg.createdAt,
          updatedAt: pkg.updatedAt,
          items: pkg.items.map((it) => ({
            id: it.id,
            feeStructureId: it.feeStructureId,
            feeStructure: it.feeStructure
              ? {
                  ...it.feeStructure,
                  amount: new Prisma.Decimal(it.feeStructure.amount).toFixed(2),
                }
              : null,
          })),
        };
      });

      return NextResponse.json({ data: formattedPackages }, { status: 200 });
    } catch (err) {
      console.error("GET /api/fees/packages error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);

// ---------------------------------------------------------------------------
// POST /api/fees/packages — Create a fee package
// ---------------------------------------------------------------------------
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
        name?: string;
        description?: string;
        academicYear?: string;
        term?: string;
        feeStructureIds?: string[];
      };

      const name = body.name?.trim();
      const description = body.description?.trim() || null;
      const academicYear = body.academicYear?.trim();
      const term = body.term?.trim() || null;
      const feeStructureIds = body.feeStructureIds;

      if (!name) {
        return NextResponse.json({ error: "Package name is required" }, { status: 400 });
      }

      if (!academicYear) {
        return NextResponse.json({ error: "Academic year is required" }, { status: 400 });
      }

      if (!Array.isArray(feeStructureIds) || feeStructureIds.length === 0) {
        return NextResponse.json(
          { error: "At least one fee structure is required in the package" },
          { status: 400 }
        );
      }

      // Deduplicate structure IDs
      const uniqueStructureIds = Array.from(new Set(feeStructureIds.map((id) => id.trim()).filter(Boolean)));
      if (uniqueStructureIds.length === 0) {
        return NextResponse.json(
          { error: "No valid fee structure IDs provided" },
          { status: 400 }
        );
      }

      // Check for duplicate package in same school/session/term
      const existingPackage = await prisma.feePackage.findFirst({
        where: {
          schoolId,
          name: { equals: name, mode: "insensitive" },
          academicYear,
          term,
        },
      });

      if (existingPackage) {
        return NextResponse.json(
          { error: "A fee package with this name already exists for this academic session and term" },
          { status: 409 }
        );
      }

      // Verify all fee structures exist, belong to this school, and have compatible session/term
      const validStructures = await prisma.feeStructure.findMany({
        where: {
          id: { in: uniqueStructureIds },
          schoolId,
        },
        select: {
          id: true,
          name: true,
          academicYear: true,
          term: true,
          amount: true,
        },
      });

      if (validStructures.length !== uniqueStructureIds.length) {
        return NextResponse.json(
          { error: "One or more selected fee structures do not exist or belong to another school" },
          { status: 400 }
        );
      }

      // Check academic year compatibility
      const incompatibleYear = validStructures.find((s) => s.academicYear !== academicYear);
      if (incompatibleYear) {
        return NextResponse.json(
          {
            error: `Fee structure '${incompatibleYear.name}' belongs to session '${incompatibleYear.academicYear}', which is incompatible with package session '${academicYear}'`,
          },
          { status: 400 }
        );
      }

      // If package has a specific term, verify term compatibility
      if (term && term !== "ALL") {
        const incompatibleTerm = validStructures.find((s) => s.term && s.term !== term);
        if (incompatibleTerm) {
          return NextResponse.json(
            {
              error: `Fee structure '${incompatibleTerm.name}' belongs to '${incompatibleTerm.term}', which is incompatible with package term '${term}'`,
            },
            { status: 400 }
          );
        }
      }

      // Create package & items in transaction
      const newPackage = await prisma.$transaction(async (tx) => {
        const createdPkg = await tx.feePackage.create({
          data: {
            schoolId,
            name,
            description,
            academicYear,
            term,
            items: {
              create: uniqueStructureIds.map((structId) => ({
                feeStructureId: structId,
              })),
            },
          },
          include: {
            items: {
              include: {
                feeStructure: true,
              },
            },
          },
        });

        return createdPkg;
      });

      let total = new Prisma.Decimal(0);
      newPackage.items.forEach((item) => {
        if (item.feeStructure?.amount) {
          total = total.add(new Prisma.Decimal(item.feeStructure.amount));
        }
      });

      return NextResponse.json(
        {
          data: {
            id: newPackage.id,
            name: newPackage.name,
            description: newPackage.description,
            academicYear: newPackage.academicYear,
            term: newPackage.term,
            totalAmount: total.toFixed(2),
            structuresCount: newPackage.items.length,
            createdAt: newPackage.createdAt,
            updatedAt: newPackage.updatedAt,
            items: newPackage.items,
          },
        },
        { status: 201 }
      );
    } catch (err) {
      console.error("POST /api/fees/packages error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
