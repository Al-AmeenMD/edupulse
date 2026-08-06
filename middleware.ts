import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

const ROLE_REDIRECTS: Record<string, string> = {
  SUPER_ADMIN: "/super-admin/dashboard",
  SCHOOL_ADMIN: "/admin/dashboard",
  TEACHER: "/teacher/dashboard",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("edupulse_token")?.value;

  const isAuthRoute = pathname === "/login";
  const isProtectedRoute =
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/teacher");

  // Redirect unauthenticated users to /login
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from /login to their dashboard
  if (isAuthRoute && token) {
    try {
      const decoded = verifyToken(token);
      const redirectPath = ROLE_REDIRECTS[decoded.role];
      if (redirectPath) {
        return NextResponse.redirect(new URL(redirectPath, request.url));
      }
    } catch {
      // Invalid or expired token — allow visiting login page
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/admin/:path*",
    "/teacher/:path*",
    "/login",
  ],
};
