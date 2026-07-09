import { Role } from "@prisma/client";

export type AuthUser = {
  userId: string;
  role: Role;
  schoolId: string | null;
};

export type ApiResponse<T> = {
  data?: T;
  error?: string;
};
