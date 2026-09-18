import { prisma } from "@/lib/prisma";

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export async function getAcademicSessions(schoolId: string) {
  return prisma.academicSession.findMany({
    where: { schoolId },
    include: {
      terms: {
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          enrollments: true,
          feeStructures: true,
          budgets: true,
          feePackages: true,
        },
      },
    },
    orderBy: [
      { isCurrent: "desc" },
      { name: "desc" },
    ],
  });
}

export async function getCurrentSession(schoolId: string) {
  return prisma.academicSession.findFirst({
    where: { schoolId, isCurrent: true },
    include: {
      terms: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function createAcademicSession(
  schoolId: string,
  data: {
    name: string;
    startDate?: Date | null;
    endDate?: Date | null;
    isCurrent?: boolean;
  }
) {
  const name = data.name.trim();
  if (!name) {
    throw new BadRequestError("Session name is required");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.academicSession.findUnique({
      where: {
        schoolId_name: { schoolId, name },
      },
    });

    if (existing) {
      throw new ConflictError(`An academic session named '${name}' already exists in this school`);
    }

    if (data.isCurrent) {
      // Deactivate all existing sessions and terms for this school
      await tx.academicSession.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false },
      });

      const schoolSessions = await tx.academicSession.findMany({
        where: { schoolId },
        select: { id: true },
      });
      if (schoolSessions.length > 0) {
        await tx.term.updateMany({
          where: { sessionId: { in: schoolSessions.map((s) => s.id) }, isCurrent: true },
          data: { isCurrent: false },
        });
      }
    }

    const session = await tx.academicSession.create({
      data: {
        schoolId,
        name,
        startDate: data.startDate,
        endDate: data.endDate,
        isCurrent: !!data.isCurrent,
      },
    });

    // Auto-seed three standard terms
    const standardTerms = [
      { name: "First Term", isCurrent: !!data.isCurrent },
      { name: "Second Term", isCurrent: false },
      { name: "Third Term", isCurrent: false },
    ];

    for (const st of standardTerms) {
      await tx.term.create({
        data: {
          sessionId: session.id,
          name: st.name,
          isCurrent: st.isCurrent,
        },
      });
    }

    return tx.academicSession.findUnique({
      where: { id: session.id },
      include: {
        terms: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  });
}

export async function updateAcademicSession(
  schoolId: string,
  sessionId: string,
  data: {
    name?: string;
    startDate?: Date | null;
    endDate?: Date | null;
  }
) {
  const session = await prisma.academicSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.schoolId !== schoolId) {
    throw new NotFoundError("Academic session not found");
  }

  const updateData: any = {};
  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) throw new BadRequestError("Session name cannot be empty");
    if (trimmed !== session.name) {
      const duplicate = await prisma.academicSession.findUnique({
        where: {
          schoolId_name: { schoolId, name: trimmed },
        },
      });
      if (duplicate) {
        throw new ConflictError(`An academic session named '${trimmed}' already exists`);
      }
      updateData.name = trimmed;
    }
  }

  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.endDate !== undefined) updateData.endDate = data.endDate;

  return prisma.academicSession.update({
    where: { id: sessionId },
    data: updateData,
    include: {
      terms: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function activateAcademicSession(schoolId: string, sessionId: string) {
  return prisma.$transaction(async (tx) => {
    const targetSession = await tx.academicSession.findUnique({
      where: { id: sessionId },
      include: { terms: { orderBy: { createdAt: "asc" } } },
    });

    if (!targetSession || targetSession.schoolId !== schoolId) {
      throw new NotFoundError("Academic session not found");
    }

    // 1. Deactivate all sessions for this school
    await tx.academicSession.updateMany({
      where: { schoolId, isCurrent: true },
      data: { isCurrent: false },
    });

    // 2. Activate target session
    await tx.academicSession.update({
      where: { id: sessionId },
      data: { isCurrent: true },
    });

    // 3. Deactivate all terms across all sessions of this school
    const allSchoolSessions = await tx.academicSession.findMany({
      where: { schoolId },
      select: { id: true },
    });
    const sessionIds = allSchoolSessions.map((s) => s.id);

    await tx.term.updateMany({
      where: { sessionId: { in: sessionIds }, isCurrent: true },
      data: { isCurrent: false },
    });

    // 4. Locate or provision "First Term" under target session and activate it
    let firstTerm =
      targetSession.terms.find((t) => t.name.toLowerCase().includes("first")) ||
      targetSession.terms[0];

    if (!firstTerm) {
      firstTerm = await tx.term.create({
        data: {
          sessionId: targetSession.id,
          name: "First Term",
          isCurrent: true,
        },
      });
    } else {
      await tx.term.update({
        where: { id: firstTerm.id },
        data: { isCurrent: true },
      });
    }

    return tx.academicSession.findUnique({
      where: { id: sessionId },
      include: {
        terms: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  });
}

export async function deleteAcademicSession(schoolId: string, sessionId: string) {
  const session = await prisma.academicSession.findUnique({
    where: { id: sessionId },
    include: {
      _count: {
        select: {
          enrollments: true,
          feeStructures: true,
          budgets: true,
          feePackages: true,
        },
      },
    },
  });

  if (!session || session.schoolId !== schoolId) {
    throw new NotFoundError("Academic session not found");
  }

  // RESTRICT Hard Deletion Policy
  const linkedTotal =
    session._count.enrollments +
    session._count.feeStructures +
    session._count.budgets +
    session._count.feePackages;

  if (linkedTotal > 0) {
    throw new ConflictError(
      `Cannot delete academic session '${session.name}': it is referenced by ${session._count.enrollments} enrollments, ${session._count.feeStructures} fee structures, ${session._count.budgets} budgets, and ${session._count.feePackages} packages.`
    );
  }

  return prisma.academicSession.delete({
    where: { id: sessionId },
  });
}

// ---------------------------------------------------------------------------
// Term-Level Operations
// ---------------------------------------------------------------------------

export async function createTerm(
  schoolId: string,
  sessionId: string,
  data: {
    name: string;
    startDate?: Date | null;
    endDate?: Date | null;
  }
) {
  const session = await prisma.academicSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.schoolId !== schoolId) {
    throw new NotFoundError("Academic session not found");
  }

  const name = data.name.trim();
  if (!name) throw new BadRequestError("Term name is required");

  const existing = await prisma.term.findUnique({
    where: {
      sessionId_name: { sessionId, name },
    },
  });

  if (existing) {
    throw new ConflictError(`A term named '${name}' already exists under this session`);
  }

  return prisma.term.create({
    data: {
      sessionId,
      name,
      startDate: data.startDate,
      endDate: data.endDate,
      isCurrent: false,
    },
  });
}

export async function updateTerm(
  schoolId: string,
  sessionId: string,
  termId: string,
  data: {
    name?: string;
    startDate?: Date | null;
    endDate?: Date | null;
  }
) {
  const session = await prisma.academicSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.schoolId !== schoolId) {
    throw new NotFoundError("Academic session not found");
  }

  const term = await prisma.term.findUnique({
    where: { id: termId },
  });

  if (!term || term.sessionId !== sessionId) {
    throw new NotFoundError("Term not found under this session");
  }

  const updateData: any = {};
  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) throw new BadRequestError("Term name cannot be empty");
    if (trimmed !== term.name) {
      const duplicate = await prisma.term.findUnique({
        where: {
          sessionId_name: { sessionId, name: trimmed },
        },
      });
      if (duplicate) {
        throw new ConflictError(`A term named '${trimmed}' already exists in this session`);
      }
      updateData.name = trimmed;
    }
  }

  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.endDate !== undefined) updateData.endDate = data.endDate;

  return prisma.term.update({
    where: { id: termId },
    data: updateData,
  });
}

export async function activateTerm(schoolId: string, sessionId: string, termId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.academicSession.findUnique({
      where: { id: sessionId },
      select: { id: true, schoolId: true, isCurrent: true },
    });

    if (!session || session.schoolId !== schoolId) {
      throw new NotFoundError("Academic session not found");
    }

    // Guard: Cannot activate a term within an inactive academic session
    if (!session.isCurrent) {
      throw new BadRequestError(
        "Cannot activate a term within an inactive academic session. Please activate the session first."
      );
    }

    const term = await tx.term.findUnique({
      where: { id: termId },
      select: { id: true, sessionId: true },
    });

    if (!term || term.sessionId !== sessionId) {
      throw new NotFoundError("Term not found under this session");
    }

    // Atomically deactivate other terms under this session and activate target term
    await tx.term.updateMany({
      where: { sessionId, isCurrent: true },
      data: { isCurrent: false },
    });

    return tx.term.update({
      where: { id: termId },
      data: { isCurrent: true },
    });
  });
}

export async function deleteTerm(schoolId: string, sessionId: string, termId: string) {
  const session = await prisma.academicSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.schoolId !== schoolId) {
    throw new NotFoundError("Academic session not found");
  }

  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: {
      _count: {
        select: {
          enrollments: true,
          feeStructures: true,
          budgets: true,
          feePackages: true,
        },
      },
    },
  });

  if (!term || term.sessionId !== sessionId) {
    throw new NotFoundError("Term not found under this session");
  }

  // RESTRICT Hard Deletion Policy
  const linkedTotal =
    term._count.enrollments +
    term._count.feeStructures +
    term._count.budgets +
    term._count.feePackages;

  if (linkedTotal > 0) {
    throw new ConflictError(
      `Cannot delete term '${term.name}': it is referenced by ${term._count.enrollments} enrollments, ${term._count.feeStructures} fee structures, ${term._count.budgets} budgets, and ${term._count.feePackages} packages.`
    );
  }

  return prisma.term.delete({
    where: { id: termId },
  });
}
