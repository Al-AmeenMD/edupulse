import { ReactNode } from "react";

export interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  schoolId?: string | null;
  schoolName?: string | null;
  mustChangePassword?: boolean;
}

export type ShellTheme = "navy" | "indigo";
