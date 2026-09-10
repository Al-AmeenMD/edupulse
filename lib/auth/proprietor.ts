import { prisma } from "@/lib/prisma";

/**
 * Validates whether a PROPRIETOR user has ownership/governance access to a specific school.
 * Queries the ProprietorSchool join table directly per request.
 *
 * @param userId - The ID of the calling User (must be role = PROPRIETOR)
 * @param schoolId - The target School ID to validate
 * @returns Promise<boolean> - true if linked, false otherwise
 */
export async function validateProprietorSchoolAccess(
  userId: string,
  schoolId: string
): Promise<boolean> {
  if (!userId || !schoolId) return false;

  if (prisma.proprietorSchool) {
    const link = await prisma.proprietorSchool.findUnique({
      where: {
        proprietorId_schoolId: {
          proprietorId: userId,
          schoolId,
        },
      },
      select: { id: true },
    });
    return !!link;
  }

  const rawLinks: any[] = await prisma.$queryRaw`
    SELECT id FROM proprietor_schools WHERE "proprietorId" = ${userId} AND "schoolId" = ${schoolId} LIMIT 1
  `;
  return rawLinks.length > 0;
}
