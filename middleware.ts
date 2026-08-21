import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyTokenAsync } from "@/lib/auth";

const ROLE_REDIRECTS: Record<string, string> = {
  SUPER_ADMIN: "/super-admin/dashboard",
  SCHOOL_ADMIN: "/admin/dashboard",
  TEACHER: "/teacher/dashboard",
  FINANCE_ADMIN: "/admin/finance-dashboard",
};

const ROUTE_ROLE_MAP: Array<{ prefix: string; allowedRoles: string[] }> = [
  { prefix: "/super-admin", allowedRoles: ["SUPER_ADMIN"] },
  { prefix: "/admin/finance-dashboard", allowedRoles: ["FINANCE_ADMIN", "SCHOOL_ADMIN"] },
  { prefix: "/admin", allowedRoles: ["SCHOOL_ADMIN"] },
  { prefix: "/teacher", allowedRoles: ["TEACHER"] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("edupulse_token")?.value;

  const isAuthRoute = pathname === "/login";
  const matchedRoute = ROUTE_ROLE_MAP.find((r) => pathname.startsWith(r.prefix));

  // Protected Routes Role Enforcement
  if (matchedRoute) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const decoded = await verifyTokenAsync(token);
      if (!matchedRoute.allowedRoles.includes(decoded.role)) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    } catch {
      // Cryptographic signature verification failed or token expired — redirect to /login
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Redirect authenticated users away from /login to their respective dashboard
  if (isAuthRoute && token) {
    try {
      const decoded = await verifyTokenAsync(token);
      const redirectPath = ROLE_REDIRECTS[decoded.role];
      if (redirectPath) {
        return NextResponse.redirect(new URL(redirectPath, request.url));
      }
    } catch {
      // Invalid or expired token — allow rendering login page
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
