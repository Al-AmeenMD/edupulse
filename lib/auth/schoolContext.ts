import { Role } from "@prisma/client";
import { validateProprietorSchoolAccess } from "@/lib/auth/proprietor";

export async function resolveSchoolContext(
  user: { userId: string; role: Role; schoolId: string | null },
  explicitSchoolId?: string | null
): Promise<string> {
  if (user.role === Role.SUPER_ADMIN) {
    if (!explicitSchoolId) {
      throw new Error("schoolId is required for Super Admin operations");
    }
    return explicitSchoolId;
  }

  if (user.role === Role.PROPRIETOR) {
    if (!explicitSchoolId) {
      throw new Error("schoolId is required for Proprietor operations");
    }
    const hasAccess = await validateProprietorSchoolAccess(user.userId, explicitSchoolId);
    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this school");
    }
    return explicitSchoolId;
  }

  if (!user.schoolId) {
    throw new Error("School context not found in user credentials");
  }
  return user.schoolId;
}
