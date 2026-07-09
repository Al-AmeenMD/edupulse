# Agent Task Prompts — Sprint 1: Foundation
# School Management System
# Paste each task prompt (between the === lines) directly into the agent

================================================================================
TASK-001 | Agent: Claude Opus | File: lib/prisma.ts
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- We need a Prisma client singleton to avoid exhausting DB connections
  in development due to hot reloading

## TASK
Create the Prisma client singleton file at `lib/prisma.ts`

## REQUIREMENTS
- Use the global singleton pattern to prevent multiple instances in development
- Log only errors (not queries) to keep console clean
- Export as named export `prisma`
- Must work correctly in both development and production

## OUTPUT FORMAT
Provide only the complete `lib/prisma.ts` file. No explanation needed.

================================================================================
TASK-002 | Agent: Claude Opus | File: lib/auth.ts
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Auth is custom JWT — no NextAuth
- Passwords hashed with bcryptjs (12 rounds)
- JWT secret from process.env.JWT_SECRET
- Token payload: { userId: string, role: Role, schoolId: string | null }
- SUPER_ADMIN has schoolId = null
- Tokens expire in 7 days

## PRISMA ROLE ENUM
```typescript
enum Role {
  SUPER_ADMIN
  SCHOOL_ADMIN
  TEACHER
  PARENT
  STUDENT
}
```

## TASK
Create the auth utilities file at `lib/auth.ts`

## REQUIREMENTS
Implement and export these functions:
1. `hashPassword(password: string): Promise<string>`
2. `verifyPassword(password: string, hash: string): Promise<boolean>`
3. `signToken(payload: { userId, role, schoolId }): string`
4. `verifyToken(token: string): { userId, role, schoolId }`

## OUTPUT FORMAT
Provide only the complete `lib/auth.ts` file. No explanation needed.

================================================================================
TASK-003 | Agent: Claude Opus | File: lib/middleware/withAuth.ts
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Auth is custom JWT — token passed as `Authorization: Bearer <token>`
- Token payload: `{ userId: string, role: Role, schoolId: string | null }`
- Every protected API route uses this middleware

## EXISTING lib/auth.ts
```typescript
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
export function signToken(payload: { userId: string; role: Role; schoolId: string | null }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    userId: string; role: Role; schoolId: string | null;
  };
}
```

## TASK
Create the auth middleware at `lib/middleware/withAuth.ts`

## REQUIREMENTS
- Wrap any Next.js App Router API route handler
- Extract Bearer token from Authorization header
- Verify the token using verifyToken
- If no token: return 401
- If invalid token: return 401
- If role not in allowedRoles: return 403
- Attach decoded user to `(req as any).user` for use in the handler
- TypeScript — properly typed handler and decoded token

## USAGE EXAMPLE (for reference, don't include in output)
```typescript
export const POST = withAuth(async (req) => {
  const user = (req as any).user;
  // handler logic
}, ["SUPER_ADMIN"]);
```

## OUTPUT FORMAT
Provide only the complete `lib/middleware/withAuth.ts` file. No explanation needed.

================================================================================
TASK-004 | Agent: Claude Opus | File: app/api/auth/login/route.ts
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Auth is custom JWT — no NextAuth
- Prisma client is at `@/lib/prisma` (named export `prisma`)
- Auth utilities at `@/lib/auth` (verifyPassword, signToken)

## EXISTING PRISMA USER MODEL (relevant fields)
```prisma
model User {
  id          String   @id @default(cuid())
  schoolId    String?
  email       String   @unique
  password    String
  firstName   String
  lastName    String
  role        Role
  isActive    Boolean  @default(true)
  lastLoginAt DateTime?
}
```

## TASK
Create the login API endpoint at `app/api/auth/login/route.ts`

## REQUIREMENTS
- Method: POST
- Body: `{ email: string, password: string }`
- Validate that email and password are present → 400 if missing
- Find user by email
- If user not found or password wrong → 401 (same message for both, no user enumeration)
- If user is inactive (isActive = false) → 403 with "Account deactivated"
- Verify password with verifyPassword()
- Sign JWT with signToken() including userId, role, schoolId
- Update user's lastLoginAt to now
- Return token + safe user object (no password field)
- Wrap everything in try/catch → 500 on unexpected error

## RESPONSE FORMAT
```typescript
// Success 200
{
  token: string,
  user: {
    id, firstName, lastName, email, role, schoolId
  }
}
```

## OUTPUT FORMAT
Provide only the complete `app/api/auth/login/route.ts` file. No explanation needed.

================================================================================
TASK-005 | Agent: Claude Opus | File: prisma/seed.ts
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- We need a seed script to create the super admin account on first setup
- Super admin has no schoolId (null) — they manage all schools
- Prisma client is at `@/lib/prisma`
- Password hashing at `@/lib/auth` (hashPassword)

## EXISTING PRISMA USER MODEL
```prisma
enum Role {
  SUPER_ADMIN
  SCHOOL_ADMIN
  TEACHER
  PARENT
  STUDENT
}

model User {
  id          String    @id @default(cuid())
  schoolId    String?   // null for SUPER_ADMIN
  email       String    @unique
  password    String    // hashed
  firstName   String
  lastName    String
  phone       String?
  role        Role
  isActive    Boolean   @default(true)
  lastLoginAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

## TASK
Create the Prisma seed file at `prisma/seed.ts`

## REQUIREMENTS
- Use upsert (not create) so it's safe to run multiple times
- Super admin credentials:
  - email: `superadmin@sms.com`
  - password: `SuperAdmin@123` (hashed)
  - firstName: `Super`
  - lastName: `Admin`
  - role: `SUPER_ADMIN`
  - schoolId: null
- Log a clear success message when done
- Handle errors and log them
- Call `prisma.$disconnect()` in finally block

Also provide the addition needed in `package.json` to register the seed script:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

And the command to run it:
```bash
npx prisma db seed
```

## OUTPUT FORMAT
Provide the complete `prisma/seed.ts` file, the package.json addition,
and the run command. No further explanation needed.

================================================================================
## TESTING CHECKLIST (for you to verify each task)
================================================================================

After getting output from each task, verify:

### TASK-001 (Prisma singleton)
- [ ] Uses globalThis pattern
- [ ] Exported as named export `prisma`
- [ ] No multiple instance warnings in dev

### TASK-002 (Auth utilities)
- [ ] hashPassword returns a bcrypt hash
- [ ] verifyPassword returns true for correct password
- [ ] signToken returns a valid JWT string
- [ ] verifyToken throws on invalid/expired token

### TASK-003 (withAuth middleware)
- [ ] Returns 401 when no token provided
- [ ] Returns 401 when token is invalid
- [ ] Returns 403 when role not in allowedRoles
- [ ] Attaches user to req on success
- [ ] TypeScript has no errors

### TASK-004 (Login endpoint)
- [ ] POST /api/auth/login returns 400 if fields missing
- [ ] Returns 401 for wrong credentials
- [ ] Returns 403 for inactive user
- [ ] Returns token + user on success
- [ ] Password field NOT in response
- [ ] lastLoginAt updates in database

### TASK-005 (Seed script)
- [ ] `npx prisma db seed` runs without errors
- [ ] Super admin record exists in DB (check via Prisma Studio)
- [ ] Can login with superadmin@sms.com / SuperAdmin@123
- [ ] Safe to run multiple times (upsert)
