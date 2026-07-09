# Project: EduPulse — School Management System

## Overview
A multi-tenant SaaS school management system. Each school is a tenant.
Built to scale from MVP (attendance + fees) to full portal system (report cards, parent/student portals).
Project folder: `edupulse/`

---

## Stack
- **Framework:** Next.js 14 (App Router), TypeScript
- **ORM:** Prisma (with directUrl configured for Supabase)
- **Database:** PostgreSQL (Supabase — Session Pooler, eu-west-1)
- **Auth:** JWT (bcryptjs + jsonwebtoken) — custom, no NextAuth
- **Styling:** Tailwind CSS
- **File Storage:** Cloudinary
- **Email:** Resend
- **Deployment:** Vercel (frontend) + Supabase (DB)

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
├── types/
│   └── index.ts
├── constants/
│   └── index.ts
├── hooks/
└── middleware.ts
```

---

## Prisma Schema (Complete)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
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

### lib/prisma.ts
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

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

### app/api/auth/login/route.ts
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.password))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!user.isActive) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    schoolId: user.schoolId,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    },
  });
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

---

## Current Sprint
**Sprint 2 — Super Admin & School Management**

## Active Tasks
- TASK-006: POST + GET /api/schools
- TASK-007: GET + PATCH + DELETE /api/schools/:id
- TASK-008: POST + GET /api/schools/:id/admins
- TASK-009: POST + GET /api/teachers
- TASK-010: POST + GET /api/students
- TASK-011: POST + GET /api/classes
- TASK-012: Enroll/Remove student from class

---

## Super Admin Credentials (for testing)
- Email: superadmin@sms.com
- Password: SuperAdmin@123
- Role: SUPER_ADMIN
- schoolId: null
