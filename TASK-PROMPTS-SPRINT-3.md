# Agent Task Prompts — Sprint 3: Attendance & Fees
# School Management System — EduPulse
# Prerequisites: Sprint 1 and Sprint 2 must be complete and tested
# Paste each task prompt (between the === lines) directly into the agent

================================================================================
TASK-013 | Agent: Claude Opus | File: app/api/attendance/route.ts
MARK + LIST ATTENDANCE
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript developer building a multi-tenant
school management system called EduPulse.

## CONTEXT
- Stack: Next.js 16.2.3 (App Router), Prisma 7 with @prisma/adapter-pg, TypeScript
- Multi-tenant: every query MUST filter by schoolId from JWT token
- Auth middleware: withAuth() HOC, user accessed via `(req as any).user`
- Prisma client: `@/lib/prisma` (named export `prisma`)
- Auth middleware: `@/lib/middleware/withAuth`

## CRITICAL PRISMA NOTE
This project uses Prisma 7 with driver adapter pattern.
Do NOT use url/directUrl in schema. The prisma client is already
configured in lib/prisma.ts with @prisma/adapter-pg.

## RELEVANT PRISMA MODELS
```prisma
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

model Teacher {
  id       String @id @default(cuid())
  userId   String @unique
  schoolId String
}

model ClassEnrollment {
  id        String  @id @default(cuid())
  studentId String
  classId   String
}
```

## EXISTING UTILITY FILES

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

## TASK
Create `app/api/attendance/route.ts` with POST and GET handlers.

## REQUIREMENTS

### POST /api/attendance (Mark attendance)
- Protected: TEACHER and SCHOOL_ADMIN
- schoolId from token — never from body
- For TEACHER: get their Teacher record via userId from token
- Body:
```json
{
  "classId": "string",
  "date": "2026-07-09",
  "attendance": [
    { "studentId": "id1", "status": "PRESENT", "note": "" },
    { "studentId": "id2", "status": "ABSENT", "note": "sick" }
  ]
}
```
- Validate: classId, date, attendance array required → 400
- Validate: attendance array must not be empty → 400
- Validate: each status must be one of PRESENT, ABSENT, LATE, EXCUSED → 400
- Verify class belongs to this school → 404
- For TEACHER: verify they are the assigned teacher of this class → 403
- For each student in the array:
  - Verify student is enrolled in this class
  - Use upsert — if attendance already exists for that student+class+date, update it
- Use Prisma transaction to save all attendance records at once
- Return saved attendance records → 201

### GET /api/attendance (List attendance)
- Protected: TEACHER and SCHOOL_ADMIN
- schoolId from token
- Support query params:
  - `?classId=` (required filter)
  - `?date=` (filter by specific date e.g. 2026-07-09)
  - `?studentId=` (filter by student)
  - `?status=` (filter by PRESENT/ABSENT/LATE/EXCUSED)
  - `?startDate=` and `?endDate=` (date range filter)
- Return attendance records with student name and class name
- Order by date descending
- Return → 200

## ERROR HANDLING
- Wrap in try/catch → 500 on unexpected errors
- Never expose raw Prisma errors

## OUTPUT FORMAT
Provide only the complete `app/api/attendance/route.ts` file.

================================================================================
TASK-014 | Agent: Claude Opus | File: app/api/attendance/summary/route.ts
ATTENDANCE SUMMARY BY CLASS
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript developer building a multi-tenant
school management system called EduPulse.

## CONTEXT
- Same stack and auth as TASK-013 above
- This endpoint provides attendance summary statistics for dashboards

## RELEVANT PRISMA MODELS
```prisma
model Attendance {
  id        String           @id @default(cuid())
  schoolId  String
  studentId String
  classId   String
  teacherId String
  date      DateTime         @db.Date
  status    AttendanceStatus
  note      String?
}

model Student {
  id        String @id @default(cuid())
  schoolId  String
  firstName String
  lastName  String
  studentId String
}
```

## TASK
Create `app/api/attendance/summary/route.ts` with a GET handler.

## REQUIREMENTS

### GET /api/attendance/summary
- Protected: TEACHER and SCHOOL_ADMIN
- schoolId from token
- Required query param: `?classId=`
- Optional: `?startDate=` and `?endDate=` (defaults to current month)
- Return per-student summary:
```json
{
  "data": {
    "classId": "...",
    "period": { "startDate": "...", "endDate": "..." },
    "students": [
      {
        "studentId": "...",
        "firstName": "Ahmad",
        "lastName": "Muhammad",
        "totalDays": 20,
        "present": 18,
        "absent": 1,
        "late": 1,
        "excused": 0,
        "attendanceRate": 90
      }
    ]
  }
}
```
- attendanceRate = (present + late + excused) / totalDays * 100
- 400 if classId missing
- 404 if class not found or not in school

## OUTPUT FORMAT
Provide only the complete `app/api/attendance/summary/route.ts` file.

================================================================================
TASK-015 | Agent: Claude Opus | File: app/api/fees/structures/route.ts
CREATE + LIST FEE STRUCTURES
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript developer building a multi-tenant
school management system called EduPulse.

## CONTEXT
- Same stack and auth as above
- SCHOOL_ADMIN creates fee structures (templates) for their school
- Fee structures define the amount and type — individual student fees are
  created from these structures in TASK-016

## RELEVANT PRISMA MODELS
```prisma
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
}
```

## TASK
Create `app/api/fees/structures/route.ts` with POST and GET handlers.

## REQUIREMENTS

### POST /api/fees/structures (Create fee structure)
- Protected: SCHOOL_ADMIN only
- schoolId from token
- Body:
```json
{
  "name": "First Term Tuition 2025/2026",
  "type": "TUITION",
  "amount": 50000,
  "academicYear": "2025/2026",
  "term": "First Term",
  "dueDate": "2026-01-31"
}
```
- Validate: name, type, amount, academicYear, dueDate required → 400
- Validate: type must be one of FeeType enum values → 400
- Validate: amount must be a positive number → 400
- Validate: dueDate must be a valid date → 400
- Create fee structure
- Return created structure → 201

### GET /api/fees/structures (List fee structures)
- Protected: SCHOOL_ADMIN only
- Filter by schoolId from token
- Support `?academicYear=` filter
- Support `?type=` filter
- Support `?term=` filter
- Return structures with count of assigned fees
- Order by createdAt descending
- Return → 200

## OUTPUT FORMAT
Provide only the complete `app/api/fees/structures/route.ts` file.

================================================================================
TASK-016 | Agent: Claude Opus | File: app/api/fees/route.ts
ASSIGN FEES TO STUDENTS + LIST FEES
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript developer building a multi-tenant
school management system called EduPulse.

## CONTEXT
- Same stack and auth as above
- SCHOOL_ADMIN assigns fees to students based on a fee structure
- Can assign to one student or bulk assign to all students in a class

## RELEVANT PRISMA MODELS
```prisma
enum FeeStatus {
  PENDING
  PAID
  OVERDUE
  PARTIAL
  WAIVED
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
}
```

## TASK
Create `app/api/fees/route.ts` with POST and GET handlers.

## REQUIREMENTS

### POST /api/fees (Assign fee to student/s)
- Protected: SCHOOL_ADMIN only
- schoolId from token
- Body option 1 — single student:
```json
{
  "feeStructureId": "...",
  "studentId": "..."
}
```
- Body option 2 — bulk assign to entire class:
```json
{
  "feeStructureId": "...",
  "classId": "..."
}
```
- Validate: feeStructureId required → 400
- Validate: either studentId OR classId required → 400
- Verify feeStructure belongs to this school → 404
- For single student: verify student belongs to school → 404
- For class bulk: get all enrolled students in the class, skip any
  student who already has a fee for this feeStructureId (no duplicates)
- Set amountDue from feeStructure.amount
- Set dueDate from feeStructure.dueDate
- Set status to PENDING
- Use Prisma transaction for bulk creates
- Return created fee(s) → 201

### GET /api/fees (List fees)
- Protected: SCHOOL_ADMIN only
- Filter by schoolId from token
- Support query params:
  - `?studentId=` filter by student
  - `?status=` filter by PENDING/PAID/OVERDUE/PARTIAL/WAIVED
  - `?feeStructureId=` filter by structure
  - `?academicYear=` filter by year
- Return fees with student name and fee structure details
- Order by dueDate ascending (overdue first)
- Return → 200

## OUTPUT FORMAT
Provide only the complete `app/api/fees/route.ts` file.

================================================================================
TASK-017 | Agent: Claude Opus | File: app/api/fees/[id]/payments/route.ts
RECORD PAYMENT
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript developer building a multi-tenant
school management system called EduPulse.

## CONTEXT
- Same stack and auth as above
- SCHOOL_ADMIN records payments against a student's fee
- Payments are additive — a student can make multiple partial payments
- Fee status updates automatically based on total paid vs amount due

## RELEVANT PRISMA MODELS
```prisma
model Fee {
  id         String    @id @default(cuid())
  schoolId   String
  studentId  String
  amountDue  Decimal   @db.Decimal(10, 2)
  amountPaid Decimal   @default(0) @db.Decimal(10, 2)
  status     FeeStatus @default(PENDING)
  paidAt     DateTime?
  updatedAt  DateTime  @updatedAt
  payments   Payment[]
}

model Payment {
  id         String   @id @default(cuid())
  feeId      String
  amount     Decimal  @db.Decimal(10, 2)
  method     String
  reference  String?
  recordedBy String   // userId of admin who recorded
  paidAt     DateTime @default(now())

  fee Fee @relation(fields: [feeId], references: [id])
}
```

## TASK
Create `app/api/fees/[id]/payments/route.ts` with POST and GET handlers.

## REQUIREMENTS

### POST /api/fees/:id/payments (Record payment)
- Protected: SCHOOL_ADMIN only
- schoolId from token
- recordedBy = userId from token
- Body:
```json
{
  "amount": 25000,
  "method": "cash",
  "reference": "RCP-001",
  "note": "First installment"
}
```
- Validate: amount, method required → 400
- Validate: amount must be positive number → 400
- Validate: method must be one of: cash, bank_transfer, card → 400
- Verify fee exists and belongs to this school → 404
- Check fee is not already fully PAID or WAIVED → 400
- Create payment record
- Update fee:
  - Add payment amount to amountPaid
  - Recalculate status:
    - amountPaid >= amountDue → PAID, set paidAt to now
    - amountPaid > 0 → PARTIAL
    - amountPaid === 0 → PENDING
  - If new amountPaid would exceed amountDue → 400 (overpayment)
- Use Prisma transaction for payment + fee update
- Return updated fee with payment → 201

### GET /api/fees/:id/payments (List payments for a fee)
- Protected: SCHOOL_ADMIN only
- Verify fee belongs to this school → 404
- Return all payments for this fee
- Include fee details and student name
- Order by paidAt descending
- Return → 200

## OUTPUT FORMAT
Provide only the complete `app/api/fees/[id]/payments/route.ts` file.

================================================================================
TASK-018 | Agent: Claude Opus | File: app/api/fees/[id]/route.ts
GET + UPDATE + WAIVE FEE
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript developer building a multi-tenant
school management system called EduPulse.

## CONTEXT
- Same stack and auth as above
- SCHOOL_ADMIN can view, update notes, or waive a student's fee

## RELEVANT PRISMA MODELS
```prisma
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
  updatedAt      DateTime  @updatedAt

  student      Student      @relation(...)
  feeStructure FeeStructure @relation(...)
  payments     Payment[]
}
```

## TASK
Create `app/api/fees/[id]/route.ts` with GET and PATCH handlers.

## REQUIREMENTS

### GET /api/fees/:id
- Protected: SCHOOL_ADMIN only
- Verify fee belongs to this school → 404
- Return fee with:
  - Student details (firstName, lastName, studentId)
  - Fee structure details (name, type, academicYear, term)
  - All payments
- Return → 200

### PATCH /api/fees/:id (Update or waive fee)
- Protected: SCHOOL_ADMIN only
- Body: any of `{ note, status }`
- If status = WAIVED:
  - Only allowed if fee is PENDING or PARTIAL
  - Cannot waive a fully PAID fee → 400
  - Set status to WAIVED
- If status = OVERDUE:
  - Only allowed if fee is PENDING or PARTIAL
  - Set status to OVERDUE
- Cannot manually set status to PAID (only payments do that)
- Can always update note
- Return updated fee → 200

## OUTPUT FORMAT
Provide only the complete `app/api/fees/[id]/route.ts` file.

================================================================================
## TESTING CHECKLIST (verify each task before moving to the next)
================================================================================

### TASK-013 — POST + GET /api/attendance
- [ ] 201 when teacher marks attendance for their class
- [ ] Upsert works — marking same date again updates existing records
- [ ] 403 when teacher tries to mark attendance for a class they don't teach
- [ ] 400 on missing classId, date, or attendance array
- [ ] 400 on invalid status value
- [ ] 401 on no token
- [ ] GET returns attendance filtered by classId
- [ ] GET date filter works
- [ ] GET status filter works

### TASK-014 — GET /api/attendance/summary
- [ ] Returns per-student summary with correct counts
- [ ] attendanceRate calculated correctly
- [ ] 400 if classId missing
- [ ] Date range filter works
- [ ] Defaults to current month if no dates provided

### TASK-015 — POST + GET /api/fees/structures
- [ ] 201 on valid fee structure creation
- [ ] 400 on missing required fields
- [ ] 400 on invalid FeeType
- [ ] 400 on negative amount
- [ ] GET returns all structures for school
- [ ] academicYear filter works
- [ ] type filter works

### TASK-016 — POST + GET /api/fees
- [ ] 201 assigning fee to single student
- [ ] 201 bulk assigning to entire class
- [ ] Skips students who already have fee for same structure
- [ ] 404 on wrong feeStructureId
- [ ] 400 if neither studentId nor classId provided
- [ ] GET returns fees with student and structure details
- [ ] Status filter works

### TASK-017 — POST /api/fees/:id/payments
- [ ] 201 on valid payment
- [ ] Fee amountPaid updates correctly
- [ ] Status changes to PARTIAL on partial payment
- [ ] Status changes to PAID when fully paid
- [ ] paidAt set when status becomes PAID
- [ ] 400 on overpayment attempt
- [ ] 400 on already PAID fee
- [ ] 400 on invalid method
- [ ] GET returns all payments for fee

### TASK-018 — GET + PATCH /api/fees/:id
- [ ] GET returns fee with student, structure and payments
- [ ] PATCH can update note
- [ ] PATCH can waive PENDING fee
- [ ] PATCH can waive PARTIAL fee
- [ ] 400 when trying to waive PAID fee
- [ ] Cannot manually set status to PAID

================================================================================
## POSTMAN/BRUNO QUICK TEST SEQUENCE
================================================================================

Run these in order after completing all tasks:

1.  POST /api/auth/login (admin)           → get admin_token
2.  POST /api/auth/login (teacher)         → get teacher_token
3.  POST /api/attendance                   → teacher marks attendance
4.  GET  /api/attendance?classId=          → view attendance
5.  GET  /api/attendance/summary?classId=  → view summary stats
6.  POST /api/fees/structures              → create fee structure
7.  GET  /api/fees/structures              → list structures
8.  POST /api/fees (single student)        → assign to Ahmad
9.  POST /api/fees (bulk class)            → assign to whole class
10. GET  /api/fees                         → list all fees
11. POST /api/fees/:id/payments            → record partial payment
12. POST /api/fees/:id/payments            → record final payment
13. GET  /api/fees/:id                     → verify status = PAID
14. PATCH /api/fees/:id (waive another)    → waive a different fee
