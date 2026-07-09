import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { verifyToken } from "@/lib/auth";

type AuthUser = {
  userId: string;
  role: Role;
  schoolId: string | null;
};

type AuthenticatedRequest = NextRequest & {
  user: AuthUser;
};

type RouteContext = {
  params: Record<string, string | string[]>;
};

type Handler = (
  req: AuthenticatedRequest,
  context: RouteContext
) => Promise<NextResponse>;

export function withAuth(handler: Handler, allowedRoles?: Role[]) {
  return async (req: NextRequest, context: RouteContext) => {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const decoded = verifyToken(token);

      if (allowedRoles && !allowedRoles.includes(decoded.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      (req as AuthenticatedRequest).user = decoded;

      return handler(req as AuthenticatedRequest, context);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  };
}
