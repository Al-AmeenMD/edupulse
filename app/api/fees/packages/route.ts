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
      const rawSession = searchParams.get("sessionId")?.trim() || searchParams.get("academicYear")?.trim();
      const rawTerm = searchParams.get("termId")?.trim() || searchParams.get("term")?.trim();

      const whereClause: Prisma.FeePackageWhereInput = {
        schoolId,
      };

      if (rawSession && rawSession !== "ALL") {
        whereClause.OR = [
          { sessionId: rawSession },
          { session: { name: rawSession } },
        ];
      }

      if (rawTerm && rawTerm !== "ALL") {
        whereClause.AND = [
          ...(Array.isArray(whereClause.AND) ? whereClause.AND : whereClause.AND ? [whereClause.AND] : []),
          {
            OR: [
              { termId: rawTerm },
              { term: { name: rawTerm } },
            ],
          },
        ];
      }

      const packages = await prisma.feePackage.findMany({
        where: whereClause,
        include: {
          session: true,
          term: true,
          items: {
            include: {
              feeStructure: {
                include: {
                  session: true,
                  term: true,
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
          sessionId: pkg.sessionId,
          termId: pkg.termId,
          academicYear: pkg.session?.name || "N/A",
          term: pkg.term?.name || null,
          session: pkg.session,
          termObj: pkg.term,
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
                  academicYear: it.feeStructure.session?.name || "N/A",
                  term: it.feeStructure.term?.name || null,
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
        sessionId?: string;
        academicYear?: string;
        termId?: string;
        term?: string;
        feeStructureIds?: string[];
      };

      const name = body.name?.trim();
      const description = body.description?.trim() || null;
      const rawSession = body.sessionId?.trim() || body.academicYear?.trim();
      const rawTerm = body.termId?.trim() || body.term?.trim() || null;
      const feeStructureIds = body.feeStructureIds;

      if (!name) {
        return NextResponse.json({ error: "Package name is required" }, { status: 400 });
      }

      if (!rawSession) {
        return NextResponse.json({ error: "Academic session is required" }, { status: 400 });
      }

      if (!Array.isArray(feeStructureIds) || feeStructureIds.length === 0) {
        return NextResponse.json(
          { error: "At least one fee structure is required in the package" },
          { status: 400 }
        );
      }

      // Resolve academic session
      const session = await prisma.academicSession.findFirst({
        where: {
          schoolId,
          OR: [{ id: rawSession }, { name: rawSession }],
        },
        include: { terms: true },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Academic session not found in this school" },
          { status: 404 }
        );
      }
      const sessionId = session.id;

      let termId: string | null = null;
      if (rawTerm) {
        const foundTerm = session.terms.find(
          (t) =>
            t.id === rawTerm ||
            t.name.toLowerCase() === rawTerm.toLowerCase() ||
            (rawTerm === "1" && t.name.includes("First")) ||
            (rawTerm === "2" && t.name.includes("Second")) ||
            (rawTerm === "3" && t.name.includes("Third"))
        );
        termId = foundTerm ? foundTerm.id : null;
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
          sessionId,
          termId,
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
        include: {
          session: true,
          term: true,
        },
      });

      if (validStructures.length !== uniqueStructureIds.length) {
        return NextResponse.json(
          { error: "One or more selected fee structures do not exist or belong to another school" },
          { status: 400 }
        );
      }

      // Check academic session compatibility
      const incompatibleSession = validStructures.find((s) => s.sessionId !== sessionId);
      if (incompatibleSession) {
        return NextResponse.json(
          {
            error: `Fee structure '${incompatibleSession.name}' belongs to session '${incompatibleSession.session.name}', which is incompatible with package session '${session.name}'`,
          },
          { status: 400 }
        );
      }

      // If package has a specific term, verify term compatibility
      if (termId) {
        const incompatibleTerm = validStructures.find((s) => s.termId && s.termId !== termId);
        if (incompatibleTerm) {
          return NextResponse.json(
            {
              error: `Fee structure '${incompatibleTerm.name}' belongs to a different term, which is incompatible with package term`,
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
            sessionId,
            termId,
            items: {
              create: uniqueStructureIds.map((structId) => ({
                feeStructureId: structId,
              })),
            },
          },
          include: {
            session: true,
            term: true,
            items: {
              include: {
                feeStructure: {
                  include: {
                    session: true,
                    term: true,
                  },
                },
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
            sessionId: newPackage.sessionId,
            termId: newPackage.termId,
            academicYear: newPackage.session.name,
            term: newPackage.term?.name || null,
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
