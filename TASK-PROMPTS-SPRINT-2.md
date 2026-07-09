# Agent Task Prompts — Sprint 2: Super Admin & School Management
# School Management System
# Prerequisites: Sprint 1 must be complete and tested before starting Sprint 2
# Paste each task prompt (between the === lines) directly into the agent

================================================================================
TASK-006 | Agent: Claude Opus | File: app/api/schools/route.ts
CREATE + LIST SCHOOLS
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Multi-tenant: every non-school table has schoolId
- Auth: custom JWT via withAuth() middleware
- Only SUPER_ADMIN can create or list all schools
- Prisma client: `@/lib/prisma` (named export `prisma`)
- Auth middleware: `@/lib/middleware/withAuth`

## EXISTING FILES

### lib/prisma.ts
```typescript
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
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
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

## RELEVANT PRISMA MODEL
```prisma
model School {
  id        String   @id @default(cuid())
  name      String
  address   String?
  email     String?
  phone     String?
  logoUrl   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## TASK
Create `app/api/schools/route.ts` with two handlers: POST and GET

## REQUIREMENTS

### POST /api/schools (Create school)
- Protected: SUPER_ADMIN only
- Body: `{ name, email, address, phone }`
- Validate: `name` is required → 400 if missing
- Validate: `email` format if provided
- Check for duplicate school email → 409 if exists
- Create school record
- Return created school → 201

### GET /api/schools (List all schools)
- Protected: SUPER_ADMIN only
- Support query params: `?search=` (filter by name), `?isActive=true/false`
- Return array of schools with `_count` of users and students
- Order by createdAt descending
- Return → 200

## ERROR HANDLING
- Wrap in try/catch → 500 on unexpected errors
- Never expose raw Prisma errors to client

## OUTPUT FORMAT
Provide only the complete `app/api/schools/route.ts` file.

================================================================================
TASK-007 | Agent: Claude Opus | File: app/api/schools/[id]/route.ts
GET + UPDATE + DEACTIVATE SCHOOL
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Auth: custom JWT via withAuth() middleware
- Only SUPER_ADMIN can view/update/deactivate schools
- Prisma client: `@/lib/prisma`, Auth middleware: `@/lib/middleware/withAuth`
- Same existing files as TASK-006 above

## RELEVANT PRISMA MODEL
```prisma
model School {
  id        String   @id @default(cuid())
  name      String
  address   String?
  email     String?
  phone     String?
  logoUrl   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
  students  Student[]
}
```

## TASK
Create `app/api/schools/[id]/route.ts` with three handlers: GET, PATCH, DELETE

## REQUIREMENTS

### GET /api/schools/:id
- Protected: SUPER_ADMIN only
- Return school with count of users, students, and classes
- 404 if school not found

### PATCH /api/schools/:id (Update school)
- Protected: SUPER_ADMIN only
- Body: any of `{ name, email, address, phone, logoUrl }`
- Only update provided fields (partial update)
- 404 if school not found
- Return updated school → 200

### DELETE /api/schools/:id (Soft delete — deactivate)
- Protected: SUPER_ADMIN only
- Do NOT hard delete — set `isActive = false`
- 404 if school not found
- 400 if school is already inactive
- Return `{ message: "School deactivated successfully" }` → 200

## OUTPUT FORMAT
Provide only the complete `app/api/schools/[id]/route.ts` file.

================================================================================
TASK-008 | Agent: Claude Opus | File: app/api/schools/[id]/admins/route.ts
CREATE SCHOOL ADMIN
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Auth: custom JWT via withAuth() middleware
- Only SUPER_ADMIN can create a school admin for a school
- When a school is created, the super admin assigns an admin user to it
- Prisma client: `@/lib/prisma`
- Auth utilities: `@/lib/auth` (hashPassword)
- Auth middleware: `@/lib/middleware/withAuth`

## RELEVANT PRISMA MODELS
```prisma
enum Role {
  SUPER_ADMIN
  SCHOOL_ADMIN
  TEACHER
  PARENT
  STUDENT
}

model User {
  id         String   @id @default(cuid())
  schoolId   String?
  email      String   @unique
  password   String
  firstName  String
  lastName   String
  phone      String?
  role       Role
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  school     School?  @relation(fields: [schoolId], references: [id])
}
```

## TASK
Create `app/api/schools/[id]/admins/route.ts` with POST and GET handlers

## REQUIREMENTS

### POST /api/schools/:id/admins (Create school admin)
- Protected: SUPER_ADMIN only
- Body: `{ firstName, lastName, email, phone, password }`
- Validate: firstName, lastName, email, password are required → 400
- Validate: password minimum 8 characters → 400
- Check school exists → 404 if not
- Check school is active → 400 if not
- Check email not already in use → 409 if taken
- Hash the password before saving
- Create User with role SCHOOL_ADMIN, linked to schoolId
- Return created user (WITHOUT password field) → 201

### GET /api/schools/:id/admins (List school admins)
- Protected: SUPER_ADMIN only
- Return all SCHOOL_ADMIN users for the given schoolId
- Exclude password from response
- Return → 200

## OUTPUT FORMAT
Provide only the complete `app/api/schools/[id]/admins/route.ts` file.

================================================================================
TASK-009 | Agent: Claude Opus | File: app/api/teachers/route.ts
CREATE + LIST TEACHERS
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Auth: custom JWT via withAuth() middleware
- SCHOOL_ADMIN creates and manages teachers within their school
- Every query MUST filter by `schoolId` from the JWT token — never trust schoolId from the request body
- Prisma client: `@/lib/prisma`
- Auth utilities: `@/lib/auth` (hashPassword)
- Middleware: `@/lib/middleware/withAuth`
- `(req as any).user` gives `{ userId, role, schoolId }` after withAuth

## RELEVANT PRISMA MODELS
```prisma
model User {
  id        String   @id @default(cuid())
  schoolId  String?
  email     String   @unique
  password  String
  firstName String
  lastName  String
  phone     String?
  role      Role
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  teacher   Teacher?
}

model Teacher {
  id            String   @id @default(cuid())
  userId        String   @unique
  schoolId      String
  employeeId    String?
  qualification String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id])
  classes       Class[]
}
```

## TASK
Create `app/api/teachers/route.ts` with POST and GET handlers

## REQUIREMENTS

### POST /api/teachers (Create teacher)
- Protected: SCHOOL_ADMIN only
- Get schoolId from `(req as any).user.schoolId` — not from body
- Body: `{ firstName, lastName, email, phone, password, employeeId, qualification }`
- Validate: firstName, lastName, email, password required → 400
- Check email not taken → 409
- Hash password
- Create User (role: TEACHER, schoolId from token) + Teacher record in a
  Prisma transaction
- Return teacher with nested user (no password) → 201

### GET /api/teachers (List school teachers)
- Protected: SCHOOL_ADMIN only
- Filter by schoolId from token (never from query params)
- Support `?search=` to filter by teacher name or email
- Support `?isActive=true/false`
- Return teachers with nested user info (no password)
- Order by createdAt descending
- Return → 200

## OUTPUT FORMAT
Provide only the complete `app/api/teachers/route.ts` file.

================================================================================
TASK-010 | Agent: Claude Opus | File: app/api/students/route.ts
CREATE + LIST STUDENTS
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Auth: custom JWT via withAuth() middleware
- SCHOOL_ADMIN creates and manages students
- schoolId always comes from JWT token — never from request body
- Auto-generate studentId in format: `STU/YYYY/NNN` (e.g. STU/2024/001)
- Prisma client: `@/lib/prisma`
- Middleware: `@/lib/middleware/withAuth`

## RELEVANT PRISMA MODEL
```prisma
model Student {
  id            String    @id @default(cuid())
  schoolId      String
  studentId     String    // e.g. STU/2024/001
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
  school        School    @relation(fields: [schoolId], references: [id])

  @@unique([schoolId, studentId])
}
```

## TASK
Create `app/api/students/route.ts` with POST and GET handlers

## REQUIREMENTS

### POST /api/students (Create student)
- Protected: SCHOOL_ADMIN only
- schoolId from token
- Body: `{ firstName, lastName, dateOfBirth, gender, address, guardianName, guardianPhone, guardianEmail }`
- Validate: firstName, lastName required → 400
- Auto-generate studentId:
  - Count existing students in this school
  - Format: `STU/${currentYear}/${padded count + 1}` e.g. `STU/2024/042`
- Create student record
- Return created student → 201

### GET /api/students (List students)
- Protected: SCHOOL_ADMIN, TEACHER
- Filter strictly by schoolId from token
- Support `?search=` (firstName, lastName, studentId)
- Support `?isActive=true/false`
- Support `?classId=` to filter by enrolled class
- Return students with their current class enrollment
- Order by firstName ascending
- Return → 200

## OUTPUT FORMAT
Provide only the complete `app/api/students/route.ts` file.

================================================================================
TASK-011 | Agent: Claude Opus | File: app/api/classes/route.ts
CREATE + LIST CLASSES
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Auth: custom JWT via withAuth() middleware
- SCHOOL_ADMIN manages classes, TEACHER can only view their own
- schoolId always from JWT token
- Prisma client: `@/lib/prisma`
- Middleware: `@/lib/middleware/withAuth`

## RELEVANT PRISMA MODELS
```prisma
model Class {
  id           String   @id @default(cuid())
  schoolId     String
  name         String   // e.g. "Grade 5A"
  level        String?  // e.g. "Grade 5"
  section      String?  // e.g. "A"
  teacherId    String?  // class teacher
  academicYear String   // e.g. "2024/2025"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  school       School   @relation(fields: [schoolId], references: [id])
  teacher      Teacher? @relation(fields: [teacherId], references: [id])
  enrollments  ClassEnrollment[]

  @@unique([schoolId, name, academicYear])
}

model ClassEnrollment {
  id         String   @id @default(cuid())
  studentId  String
  classId    String
  enrolledAt DateTime @default(now())

  student    Student  @relation(fields: [studentId], references: [id])
  class      Class    @relation(fields: [classId], references: [id])

  @@unique([studentId, classId])
}
```

## TASK
Create `app/api/classes/route.ts` with POST and GET handlers

## REQUIREMENTS

### POST /api/classes (Create class)
- Protected: SCHOOL_ADMIN only
- schoolId from token
- Body: `{ name, level, section, teacherId, academicYear }`
- Validate: name, academicYear required → 400
- Check for duplicate class name within same school + academicYear → 409
- If teacherId provided, verify teacher belongs to this school → 400 if not
- Create class
- Return created class with teacher info → 201

### GET /api/classes (List classes)
- Protected: SCHOOL_ADMIN, TEACHER
- SCHOOL_ADMIN: sees all classes in their school
- TEACHER: sees only classes where they are the assigned teacher
- Support `?academicYear=` filter
- Support `?search=` filter by name
- Return classes with teacher info and student count
- Return → 200

### POST /api/classes/:id/enroll (Enroll student — separate file)
Note: this will be in TASK-012, skip for now

## OUTPUT FORMAT
Provide only the complete `app/api/classes/route.ts` file.

================================================================================
TASK-012 | Agent: Claude Opus | File: app/api/classes/[id]/enroll/route.ts
ENROLL STUDENT IN CLASS
================================================================================

## ROLE
You are a senior Next.js 14 TypeScript developer building a multi-tenant
school management system.

## CONTEXT
- Stack: Next.js 14 (App Router), Prisma, PostgreSQL, TypeScript
- Auth: custom JWT via withAuth() middleware
- SCHOOL_ADMIN enrolls students into classes
- Must verify both student and class belong to the same school (from token)
- Prisma client: `@/lib/prisma`
- Middleware: `@/lib/middleware/withAuth`

## RELEVANT PRISMA MODELS
```prisma
model ClassEnrollment {
  id         String   @id @default(cuid())
  studentId  String
  classId    String
  enrolledAt DateTime @default(now())

  student    Student  @relation(fields: [studentId], references: [id])
  class      Class    @relation(fields: [classId], references: [id])

  @@unique([studentId, classId])
}
```

## TASK
Create `app/api/classes/[id]/enroll/route.ts` with POST and DELETE handlers

## REQUIREMENTS

### POST /api/classes/:id/enroll (Enroll student)
- Protected: SCHOOL_ADMIN only
- schoolId from token
- Body: `{ studentId }`
- Validate studentId present → 400
- Verify class exists and belongs to this school → 404
- Verify student exists and belongs to this school → 404
- Check student not already enrolled in this class → 409
- Create enrollment record
- Return enrollment with student info → 201

### DELETE /api/classes/:id/enroll (Remove student from class)
- Protected: SCHOOL_ADMIN only
- Body: `{ studentId }`
- Verify class and student belong to this school
- Check enrollment exists → 404 if not
- Delete enrollment record
- Return `{ message: "Student removed from class" }` → 200

## OUTPUT FORMAT
Provide only the complete `app/api/classes/[id]/enroll/route.ts` file.

================================================================================
## TESTING CHECKLIST (verify each task before moving to the next)
================================================================================

### TASK-006 — POST /api/schools
- [ ] 201 with valid name
- [ ] 400 if name is missing
- [ ] 409 if email already exists
- [ ] 403 if not SUPER_ADMIN
- [ ] GET returns all schools with _count

### TASK-007 — GET/PATCH/DELETE /api/schools/:id
- [ ] GET returns school with counts
- [ ] 404 for non-existent school
- [ ] PATCH updates only provided fields
- [ ] DELETE sets isActive = false (verify in DB — record still exists)
- [ ] 400 when trying to deactivate already inactive school

### TASK-008 — POST /api/schools/:id/admins
- [ ] 201 creates User with SCHOOL_ADMIN role
- [ ] Password is hashed in DB (not plaintext)
- [ ] Password not in response
- [ ] 409 if email already taken
- [ ] 404 if school not found
- [ ] GET returns all admins for school

### TASK-009 — POST + GET /api/teachers
- [ ] Creates User + Teacher record together (transaction)
- [ ] schoolId comes from token, not body
- [ ] Password is hashed
- [ ] Password not in response
- [ ] Search filter works
- [ ] Only sees teachers from own school

### TASK-010 — POST + GET /api/students
- [ ] studentId auto-generated correctly (STU/2024/001 format)
- [ ] Sequential — second student is STU/2024/002
- [ ] schoolId from token only
- [ ] Search by name and studentId works
- [ ] classId filter works
- [ ] TEACHER can list students, not create

### TASK-011 — POST + GET /api/classes
- [ ] 409 on duplicate name + academicYear in same school
- [ ] teacherId verified as belonging to school
- [ ] TEACHER only sees their own classes
- [ ] Student count included in response

### TASK-012 — Enroll/Remove student
- [ ] 409 if student already in class
- [ ] 404 if student from different school
- [ ] 404 if class from different school
- [ ] DELETE removes enrollment correctly
- [ ] Verify in DB after each operation

================================================================================
## POSTMAN QUICK TEST SEQUENCE
================================================================================

Run these in order after completing all tasks:

1. POST /api/auth/login            → get token (superadmin@sms.com)
2. POST /api/schools               → create "Test School"
3. POST /api/schools/:id/admins    → create admin for school
4. POST /api/auth/login            → login as school admin → get admin token
5. POST /api/teachers              → create teacher (use admin token)
6. POST /api/students              → create 2-3 students
7. POST /api/classes               → create a class, assign teacher
8. POST /api/classes/:id/enroll    → enroll students
9. GET  /api/classes               → verify teacher sees their class
10. GET /api/students?classId=     → verify students in class
