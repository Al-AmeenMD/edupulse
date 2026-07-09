# Project: EduPulse — School Management System

## Overview
A multi-tenant SaaS school management system. Each school is a tenant.
Built to scale from MVP (attendance + fees) to full portal system (report cards, parent/student portals).
Project folder: `edupulse/`

---

## Stack (Actual — Verified by Codebase Analysis)
- **Framework:** Next.js 16.2.3 (App Router), TypeScript
- **React:** 19.2.4
- **ORM:** Prisma 7.7.0 with `@prisma/adapter-pg` (driver adapter pattern)
- **Database:** PostgreSQL (Supabase — Session Pooler, eu-west-1)
- **Auth:** JWT (bcryptjs 3.0.3 + jsonwebtoken 9.0.3) — custom, no NextAuth
- **Styling:** Tailwind CSS v4 + @tailwindcss/postcss
- **File Storage:** Cloudinary (not yet integrated)
- **Email:** Resend (not yet integrated)
- **Deployment:** Vercel (frontend) + Supabase (DB)

---

## Critical Prisma Note
This project uses **Prisma 7 with the driver adapter pattern** — NOT the old url/directUrl in schema.prisma.

### prisma/schema.prisma datasource (correct)
```prisma
datasource db {
  provider = "postgresql"
}
```

### prisma.config.ts (handles connection)
```typescript
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
});
```

### lib/prisma.ts (uses pg Pool adapter)
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter, log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

---

## Architecture Rules — READ BEFORE EVERY TASK

### Multi-Tenancy
- Every table (except `schools` and super admin `users`) has a `schoolId` column
- Every database query MUST filter by `schoolId` — no exceptions
- `schoolId` always comes from the JWT token — NEVER from the request body
- A data leak between tenants is a critical bug

### Auth & Roles
```
SUPER_ADMIN  → schoolId = null, manages all schools
SCHOOL_ADMIN → scoped to one school
TEACHER      → scoped to one school
PARENT       → future (v2)
STUDENT      → future (v2)
```

### API Protection
- All protected routes use `withAuth(allowedRoles[])` middleware
- Auth token is JWT passed as `Authorization: Bearer <token>` header
- Token payload: `{ userId, role, schoolId }`
- Access user in handler via `(req as any).user`

### Error Handling Convention
```typescript
// Success
return NextResponse.json({ data: result }, { status: 200 });

// Created
return NextResponse.json({ data: result }, { status: 201 });

// Bad request
return NextResponse.json({ error: "Message here" }, { status: 400 });

// Unauthorized
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Forbidden
return NextResponse.json({ error: "Forbidden" }, { status: 403 });

// Not found
return NextResponse.json({ error: "Not found" }, { status: 404 });

// Conflict
return NextResponse.json({ error: "Already exists" }, { status: 409 });

// Server error
return NextResponse.json({ error: "Internal server error" }, { status: 500 });
```

### Code Conventions
- All API routes live in `app/api/...`
- Use `async/await`, never `.then()`
- Always wrap DB calls in try/catch
- Never expose password field in API responses
- Use Prisma's `select` to whitelist returned fields
- All money/amount fields use `Decimal` type in Prisma
- Use Prisma transactions when creating related records together
- Always `.trim()` and `.toLowerCase()` on user string inputs
- schoolId ALWAYS from JWT token, never from request body

---

## Folder Structure
```
edupulse/
├── app/
│   ├── (auth)/login/
│   ├── (super-admin)/dashboard/, schools/
│   ├── (admin)/dashboard/, teachers/, students/, classes/, fees/
│   ├── (teacher)/dashboard/, attendance/, classes/
│   └── api/
│       ├── auth/login/
│       ├── schools/
│       │   └── [id]/
│       │       └── admins/
│       ├── students/
│       │   └── [id]/
│       ├── teachers/
│       │   └── [id]/
│       ├── classes/
│       │   └── [id]/
│       │       └── enroll/
│       ├── attendance/
│       └── fees/
│           ├── structures/
│           └── [id]/
│               └── payments/
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   └── layouts/
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   └── middleware/
│       ├── withAuth.ts
│       └── withTenant.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── prisma.config.ts
├── types/
│   └── index.ts
├── constants/
│   └── index.ts
├── hooks/
│   ├── useAuth.ts
│   └── useTenant.ts
└── middleware.ts
```

---

## Prisma Schema (Complete)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model School {
  id            String    @id @default(cuid())
  name          String
  address       String?
  email         String?
  phone         String?
  logoUrl       String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  users         User[]
  students      Student[]
  classes       Class[]
  attendance    Attendance[]
  fees          Fee[]
  feeStructures FeeStructure[]
  subjects      Subject[]

  @@map("schools")
}

enum Role {
  SUPER_ADMIN
  SCHOOL_ADMIN
  TEACHER
  PARENT
  STUDENT
}

model User {
  id            String    @id @default(cuid())
  schoolId      String?
  email         String    @unique
  password      String
  firstName     String
  lastName      String
  phone         String?
  avatarUrl     String?
  role          Role
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  school        School?   @relation(fields: [schoolId], references: [id])
  teacher       Teacher?
  sessions      Session[]

  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model Teacher {
  id            String    @id @default(cuid())
  userId        String    @unique
  schoolId      String
  employeeId    String?
  qualification String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user            User             @relation(fields: [userId], references: [id])
  classes         Class[]
  attendance      Attendance[]
  subjectTeachers SubjectTeacher[]

  @@map("teachers")
}

model Student {
  id            String    @id @default(cuid())
  schoolId      String
  studentId     String
  firstName     String
  lastName      String
  dateOfBirth   DateTime?
  gender        String?
  address       String?
  avatarUrl     String?
  guardianName  String?
  guardianPhone String?
  guardianEmail String?
  isActive      Boolean   @default(true)
  enrolledAt    DateTime  @default(now())
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  school           School            @relation(fields: [schoolId], references: [id])
  classEnrollments ClassEnrollment[]
  attendance       Attendance[]
  fees             Fee[]

  @@unique([schoolId, studentId])
  @@map("students")
}

model Class {
  id           String   @id @default(cuid())
  schoolId     String
  name         String
  level        String?
  section      String?
  teacherId    String?
  academicYear String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  school          School            @relation(fields: [schoolId], references: [id])
  teacher         Teacher?          @relation(fields: [teacherId], references: [id])
  enrollments     ClassEnrollment[]
  attendance      Attendance[]
  subjectTeachers SubjectTeacher[]

  @@unique([schoolId, name, academicYear])
  @@map("classes")
}

model ClassEnrollment {
  id         String   @id @default(cuid())
  studentId  String
  classId    String
  enrolledAt DateTime @default(now())

  student Student @relation(fields: [studentId], references: [id])
  class   Class   @relation(fields: [classId], references: [id])

  @@unique([studentId, classId])
  @@map("class_enrollments")
}

model Subject {
  id        String   @id @default(cuid())
  schoolId  String
  name      String
  code      String?
  createdAt DateTime @default(now())

  school          School           @relation(fields: [schoolId], references: [id])
  subjectTeachers SubjectTeacher[]

  @@unique([schoolId, code])
  @@map("subjects")
}

model SubjectTeacher {
  id        String @id @default(cuid())
  teacherId String
  classId   String
  subjectId String

  teacher Teacher @relation(fields: [teacherId], references: [id])
  class   Class   @relation(fields: [classId], references: [id])
  subject Subject @relation(fields: [subjectId], references: [id])

  @@unique([teacherId, classId, subjectId])
  @@map("subject_teachers")
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

model Attendance {
  id        String           @id @default(cuid())
  schoolId  String
  studentId String
  classId   String
  teacherId String
  date      DateTime         @db.Date
  status    AttendanceStatus
  note      String?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  school  School  @relation(fields: [schoolId], references: [id])
  student Student @relation(fields: [studentId], references: [id])
  class   Class   @relation(fields: [classId], references: [id])
  teacher Teacher @relation(fields: [teacherId], references: [id])

  @@unique([schoolId, studentId, classId, date])
  @@map("attendance")
}

enum FeeStatus {
  PENDING
  PAID
  OVERDUE
  PARTIAL
  WAIVED
}

enum FeeType {
  TUITION
  TRANSPORT
  UNIFORM
  EXAM
  MISCELLANEOUS
}

model FeeStructure {
  id           String   @id @default(cuid())
  schoolId     String
  name         String
  type         FeeType
  amount       Decimal  @db.Decimal(10, 2)
  academicYear String
  term         String?
  dueDate      DateTime
  createdAt    DateTime @default(now())

  school School @relation(fields: [schoolId], references: [id])
  fees   Fee[]

  @@map("fee_structures")
}

model Fee {
  id             String    @id @default(cuid())
  schoolId       String
  studentId      String
  feeStructureId String
  amountDue      Decimal   @db.Decimal(10, 2)
  amountPaid     Decimal   @default(0) @db.Decimal(10, 2)
  status         FeeStatus @default(PENDING)
  paidAt         DateTime?
  dueDate        DateTime
  note           String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  school       School       @relation(fields: [schoolId], references: [id])
  student      Student      @relation(fields: [studentId], references: [id])
  feeStructure FeeStructure @relation(fields: [feeStructureId], references: [id])
  payments     Payment[]

  @@map("fees")
}

model Payment {
  id         String   @id @default(cuid())
  feeId      String
  amount     Decimal  @db.Decimal(10, 2)
  method     String
  reference  String?
  recordedBy String
  paidAt     DateTime @default(now())

  fee Fee @relation(fields: [feeId], references: [id])

  @@map("payments")
}
```

---

## Existing Utility Files

### lib/auth.ts
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

export function signToken(payload: {
  userId: string;
  role: Role;
  schoolId: string | null;
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    userId: string;
    role: Role;
    schoolId: string | null;
  };
}
```

### lib/middleware/withAuth.ts
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { Role } from "@prisma/client";

type Handler = (req: NextRequest, context: any) => Promise<NextResponse>;

export function withAuth(handler: Handler, allowedRoles?: Role[]) {
  return async (req: NextRequest, context: any) => {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const decoded = verifyToken(token);
      if (allowedRoles && !allowedRoles.includes(decoded.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      (req as any).user = decoded;
      return handler(req, context);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  };
}
```

---

## Completed Tasks
- TASK-000: Folder structure ✅
- TASK-001: Prisma client singleton ✅
- TASK-002: Auth utilities ✅
- TASK-003: withAuth middleware ✅
- TASK-004: Login API endpoint ✅
- TASK-005: Super admin seed script ✅
- TASK-006: POST + GET /api/schools ✅
- TASK-007: GET + PATCH + DELETE /api/schools/:id ✅
- TASK-008: POST + GET /api/schools/:id/admins ✅

---

## Known Bugs to Fix
- [ ] GET /api/schools/:id returns admins instead of school details
- [ ] app/page.tsx still shows default Next.js template — redirect to /login
- [ ] app/layout.tsx metadata still says "Create Next App"
- [ ] proxy.ts at root is orphaned — delete it
- [ ] ._* and .DS_Store files should be added to .gitignore

---

## Current Sprint
**Sprint 2 — Super Admin & School Management (Resuming)**

## Active Tasks
- TASK-009: POST + GET /api/teachers
- TASK-010: POST + GET /api/students
- TASK-011: POST + GET /api/classes
- TASK-012: Enroll/Remove student from class

---

## Test Credentials
- **Super Admin:** superadmin@sms.com / SuperAdmin@123 (schoolId: null)
- **School Admin:** admin@greenfield.com / Admin@12345 (schoolId: your-school-id)
- **School:** Greenfield Academy (save the id for testing)