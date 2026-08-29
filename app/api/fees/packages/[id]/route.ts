import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ---------------------------------------------------------------------------
// GET /api/fees/packages/:id — Get single fee package details
// ---------------------------------------------------------------------------
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

      const { id } = await context.params;

      const pkg = await prisma.feePackage.findFirst({
        where: { id, schoolId },
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

      let total = new Prisma.Decimal(0);
      pkg.items.forEach((item) => {
        if (item.feeStructure?.amount) {
          total = total.add(new Prisma.Decimal(item.feeStructure.amount));
        }
      });

      return NextResponse.json(
        {
          data: {
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
          },
        },
        { status: 200 }
      );
    } catch (err) {
      console.error("GET /api/fees/packages/[id] error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);

// ---------------------------------------------------------------------------
// PATCH /api/fees/packages/:id — Update a fee package
// ---------------------------------------------------------------------------
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

      const { id } = await context.params;

      const existingPackage = await prisma.feePackage.findFirst({
        where: { id, schoolId },
        include: { items: true },
      });

      if (!existingPackage) {
        return NextResponse.json(
          { error: "Fee package not found" },
          { status: 404 }
        );
      }

      const body = (await req.json()) as {
        name?: string;
        description?: string;
        academicYear?: string;
        term?: string;
        feeStructureIds?: string[];
      };

      const updatedName = body.name !== undefined ? body.name.trim() : existingPackage.name;
      const updatedDescription = body.description !== undefined ? body.description.trim() || null : existingPackage.description;
      const updatedAcademicYear = body.academicYear !== undefined ? body.academicYear.trim() : existingPackage.academicYear;
      const updatedTerm = body.term !== undefined ? body.term.trim() || null : existingPackage.term;

      if (!updatedName) {
        return NextResponse.json({ error: "Package name cannot be empty" }, { status: 400 });
      }

      if (!updatedAcademicYear) {
        return NextResponse.json({ error: "Academic year cannot be empty" }, { status: 400 });
      }

      // If feeStructureIds provided, validate them
      let structureIdsToSet: string[] | null = null;
      if (body.feeStructureIds !== undefined) {
        if (!Array.isArray(body.feeStructureIds) || body.feeStructureIds.length === 0) {
          return NextResponse.json(
            { error: "At least one fee structure is required in the package" },
            { status: 400 }
          );
        }

        structureIdsToSet = Array.from(new Set(body.feeStructureIds.map((sid) => sid.trim()).filter(Boolean)));
        if (structureIdsToSet.length === 0) {
          return NextResponse.json(
            { error: "No valid fee structure IDs provided" },
            { status: 400 }
          );
        }

        const validStructures = await prisma.feeStructure.findMany({
          where: {
            id: { in: structureIdsToSet },
            schoolId,
          },
          select: {
            id: true,
            name: true,
            academicYear: true,
            term: true,
          },
        });

        if (validStructures.length !== structureIdsToSet.length) {
          return NextResponse.json(
            { error: "One or more selected fee structures do not exist or belong to another school" },
            { status: 400 }
          );
        }

        // Verify session compatibility
        const incompatibleYear = validStructures.find((s) => s.academicYear !== updatedAcademicYear);
        if (incompatibleYear) {
          return NextResponse.json(
            {
              error: `Fee structure '${incompatibleYear.name}' belongs to session '${incompatibleYear.academicYear}', which is incompatible with package session '${updatedAcademicYear}'`,
            },
            { status: 400 }
          );
        }

        // Verify term compatibility if term specified
        if (updatedTerm && updatedTerm !== "ALL") {
          const incompatibleTerm = validStructures.find((s) => s.term && s.term !== updatedTerm);
          if (incompatibleTerm) {
            return NextResponse.json(
              {
                error: `Fee structure '${incompatibleTerm.name}' belongs to '${incompatibleTerm.term}', which is incompatible with package term '${updatedTerm}'`,
              },
              { status: 400 }
            );
          }
        }
      }

      // Check name uniqueness if name/year/term changed
      if (
        updatedName !== existingPackage.name ||
        updatedAcademicYear !== existingPackage.academicYear ||
        updatedTerm !== existingPackage.term
      ) {
        const conflict = await prisma.feePackage.findFirst({
          where: {
            schoolId,
            name: { equals: updatedName, mode: "insensitive" },
            academicYear: updatedAcademicYear,
            term: updatedTerm,
            id: { not: id },
          },
        });

        if (conflict) {
          return NextResponse.json(
            { error: "A fee package with this name already exists for this academic session and term" },
            { status: 409 }
          );
        }
      }

      // Execute update in transaction
      const updatedPkg = await prisma.$transaction(async (tx) => {
        // Update package header
        const pkg = await tx.feePackage.update({
          where: { id },
          data: {
            name: updatedName,
            description: updatedDescription,
            academicYear: updatedAcademicYear,
            term: updatedTerm,
          },
        });

        // Update items if specified
        if (structureIdsToSet !== null) {
          await tx.feePackageItem.deleteMany({
            where: { packageId: id },
          });

          await tx.feePackageItem.createMany({
            data: structureIdsToSet.map((structId) => ({
              packageId: id,
              feeStructureId: structId,
            })),
          });
        }

        return tx.feePackage.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                feeStructure: true,
              },
            },
          },
        });
      });

      if (!updatedPkg) {
        return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
      }

      let total = new Prisma.Decimal(0);
      updatedPkg.items.forEach((item) => {
        if (item.feeStructure?.amount) {
          total = total.add(new Prisma.Decimal(item.feeStructure.amount));
        }
      });

      return NextResponse.json(
        {
          data: {
            id: updatedPkg.id,
            name: updatedPkg.name,
            description: updatedPkg.description,
            academicYear: updatedPkg.academicYear,
            term: updatedPkg.term,
            totalAmount: total.toFixed(2),
            structuresCount: updatedPkg.items.length,
            createdAt: updatedPkg.createdAt,
            updatedAt: updatedPkg.updatedAt,
            items: updatedPkg.items,
          },
        },
        { status: 200 }
      );
    } catch (err) {
      console.error("PATCH /api/fees/packages/[id] error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);

// ---------------------------------------------------------------------------
// DELETE /api/fees/packages/:id — Delete a fee package
// ---------------------------------------------------------------------------
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

      const { id } = await context.params;

      const pkg = await prisma.feePackage.findFirst({
        where: { id, schoolId },
      });

      if (!pkg) {
        return NextResponse.json(
          { error: "Fee package not found" },
          { status: 404 }
        );
      }

      await prisma.feePackage.delete({
        where: { id },
      });

      return NextResponse.json(
        {
          data: {
            message: "Fee package deleted successfully",
          },
        },
        { status: 200 }
      );
    } catch (err) {
      console.error("DELETE /api/fees/packages/[id] error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
