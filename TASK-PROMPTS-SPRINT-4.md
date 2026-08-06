# Agent Task Prompts — Sprint 4: Frontend
# School Management System — EduPulse
# Prerequisites: Sprints 1, 2, and 3 must be complete
# Paste each task prompt (between the === lines) directly into the agent
# Always paste CONTEXT.md first before each task

================================================================================
TASK-019 | Agent: Claude Opus | File: app/(auth)/login/page.tsx
LOGIN PAGE
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building a multi-tenant school management system called EduPulse.

## CONTEXT
- Stack: Next.js 16.2.3 (App Router), TypeScript, Tailwind CSS v4, React 19
- Auth: custom JWT — login hits POST /api/auth/login
- On success: store token in localStorage as "edupulse_token"
- Store user object in localStorage as "edupulse_user"
- After login, redirect based on role:
  - SUPER_ADMIN → /super-admin/dashboard
  - SCHOOL_ADMIN → /admin/dashboard
  - TEACHER → /teacher/dashboard
- On failure: show error message inline
- This is a client component — use "use client"

## LOGIN API
```
POST /api/auth/login
Body: { email: string, password: string }
Success response: { token: string, user: { id, firstName, lastName, email, role, schoolId } }
Error response: { error: string }
```

## DESIGN REQUIREMENTS
- Clean, professional login page suitable for a school management system
- EduPulse branding — name and tagline "Manage your school with ease"
- Two-column layout on desktop: left side branding/illustration, right side form
- Single column on mobile
- Form fields: Email, Password (with show/hide toggle)
- Submit button with loading state
- Error message display below form
- Tailwind CSS v4 for all styling — no external UI libraries
- Color scheme: professional blues and whites — not dark mode

## REQUIREMENTS
- "use client" directive at top
- useState for email, password, error, loading, showPassword
- Form submission calls POST /api/auth/login
- Loading spinner on submit button while fetching
- Clear error message on failed login
- Redirect using next/navigation useRouter after success
- No default Next.js styles — clean slate

## OUTPUT FORMAT
Provide only the complete `app/(auth)/login/page.tsx` file.

================================================================================
TASK-020 | Agent: Claude Opus | File: middleware.ts
ROUTE PROTECTION MIDDLEWARE
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript developer building a multi-tenant
school management system called EduPulse.

## CONTEXT
- Stack: Next.js 16.2.3 (App Router), TypeScript
- Auth: custom JWT stored in localStorage as "edupulse_token"
- Token payload: { userId, role, schoolId }
- JWT_SECRET from process.env.JWT_SECRET
- Three portal routes to protect:
  - /super-admin/* → SUPER_ADMIN only
  - /admin/*       → SCHOOL_ADMIN only
  - /teacher/*     → TEACHER only

## TASK
Replace the placeholder `middleware.ts` at the project root with a proper
route protection middleware.

## REQUIREMENTS
- Use Next.js middleware (runs at the edge)
- Since token is in localStorage (client-side), middleware cannot read it directly
- Instead: check for token in cookies (set cookie on login) OR redirect all
  protected routes to login and let client-side auth handle the rest
- Recommended approach: redirect unauthenticated users to /login
  for all protected routes — client-side layouts handle role checking
- Also handle: if user is on /login and already authenticated, redirect to
  their dashboard (check cookie if available)
- Config matcher should cover all three portal route groups

## NOTE ON CLIENT-SIDE AUTH
Since JWT is in localStorage, the middleware cannot verify it server-side.
The middleware acts as a first line of defence. Each layout component will
do the actual role verification client-side by reading localStorage.

## OUTPUT FORMAT
Provide only the complete `middleware.ts` file.

================================================================================
TASK-021 | Agent: Claude Opus | Files: app/(super-admin)/layout.tsx + dashboard/page.tsx
SUPER ADMIN LAYOUT + DASHBOARD
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building EduPulse — a multi-tenant school management system.

## CONTEXT
- Stack: Next.js 16.2.3 (App Router), TypeScript, Tailwind CSS v4, React 19
- Auth: JWT in localStorage as "edupulse_token" and "edupulse_user"
- Super admin has no schoolId — manages all schools in the system
- This layout wraps all super-admin pages

## APIS AVAILABLE
```
GET /api/schools              → list all schools (requires SUPER_ADMIN token)
GET /api/schools?search=      → search schools
GET /api/schools?isActive=    → filter by active status
```

## TASK
Create two files:

### 1. app/(super-admin)/layout.tsx
- "use client" directive
- On mount: read "edupulse_user" from localStorage
- If no user or role !== SUPER_ADMIN → redirect to /login
- Sidebar navigation with links:
  - Dashboard (/super-admin/dashboard)
  - Schools (/super-admin/schools)
- Top navbar: show "Super Admin" label + user's name + logout button
- Logout: clear localStorage → redirect to /login
- Responsive: collapsible sidebar on mobile

### 2. app/(super-admin)/dashboard/page.tsx
- "use client" directive
- Fetch GET /api/schools on mount with token from localStorage
- Show stats cards:
  - Total Schools
  - Active Schools
  - Inactive Schools
- Show a table of recent schools (last 5) with columns:
  Name, Email, Status (active/inactive badge), Date Created, Actions
- Actions: View button linking to /super-admin/schools/:id
- Loading skeleton while fetching
- Empty state if no schools

## DESIGN REQUIREMENTS
- Consistent with login page — professional blues and whites
- Sidebar: dark blue (#1e3a5f) with white text
- Content area: light grey background (#f8fafc)
- Stats cards: white with subtle shadow
- Clean data table with hover states
- Status badge: green for active, red for inactive

## OUTPUT FORMAT
Provide both files clearly labelled.

================================================================================
TASK-022 | Agent: Claude Opus | Files: app/(super-admin)/schools/page.tsx + [id]/page.tsx
SCHOOLS MANAGEMENT PAGES
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building EduPulse — a multi-tenant school management system.

## CONTEXT
- Same stack and auth as TASK-021
- Super admin manages all schools from these pages

## APIS AVAILABLE
```
GET    /api/schools                    → list schools (?search=, ?isActive=)
POST   /api/schools                    → create school { name, email, address, phone }
GET    /api/schools/:id                → get single school with _count
PATCH  /api/schools/:id               → update school
DELETE /api/schools/:id               → deactivate school
GET    /api/schools/:id/admins        → list school admins
POST   /api/schools/:id/admins        → create school admin
```

## TASK
Create two files:

### 1. app/(super-admin)/schools/page.tsx — Schools List
- Table of all schools with columns:
  Name, Email, Phone, Students, Teachers, Status, Actions
- Search bar to filter by name
- Filter toggle: All / Active / Inactive
- "Add School" button → opens modal
- Add School modal: form with Name, Email, Address, Phone fields
- After creating school: show "Create Admin" prompt in same modal flow
- Create Admin form: First Name, Last Name, Email, Password
- Each row: Edit button (inline edit), Deactivate button
- Confirmation dialog before deactivating
- Loading and error states

### 2. app/(super-admin)/schools/[id]/page.tsx — School Detail
- School name, email, address, phone — editable inline
- Stats: total teachers, students, classes
- Tabs: Overview | Admins
- Admins tab: table of school admins with name, email, status
- Add Admin button on admins tab
- Back button to /super-admin/schools

## OUTPUT FORMAT
Provide both files clearly labelled.

================================================================================
TASK-023 | Agent: Claude Opus | Files: app/(admin)/layout.tsx + dashboard/page.tsx
SCHOOL ADMIN LAYOUT + DASHBOARD
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building EduPulse — a multi-tenant school management system.

## CONTEXT
- Same stack and auth as above
- School admin is scoped to one school
- schoolId comes from the user object in localStorage

## APIS AVAILABLE
```
GET /api/teachers              → list teachers in school
GET /api/students              → list students in school
GET /api/classes               → list classes in school
GET /api/fees?status=PENDING   → list pending fees
GET /api/fees?status=OVERDUE   → list overdue fees
```

## TASK
Create two files:

### 1. app/(admin)/layout.tsx
- "use client" directive
- On mount: read "edupulse_user" from localStorage
- If no user or role !== SCHOOL_ADMIN → redirect to /login
- Sidebar navigation:
  - Dashboard (/admin/dashboard)
  - Teachers (/admin/teachers)
  - Students (/admin/students)
  - Classes (/admin/classes)
  - Fees (/admin/fees)
- Top navbar: school name + admin's name + logout
- Responsive sidebar

### 2. app/(admin)/dashboard/page.tsx
- Stats cards:
  - Total Teachers
  - Total Students
  - Total Classes
  - Pending Fees (count)
  - Overdue Fees (count)
- Recent students table (last 5): Name, Student ID, Class, Enrolled Date
- Overdue fees table (last 5): Student Name, Fee Name, Amount Due, Due Date
- Loading skeletons while fetching
- Empty states

## OUTPUT FORMAT
Provide both files clearly labelled.

================================================================================
TASK-024 | Agent: Claude Opus | File: app/(admin)/teachers/page.tsx
TEACHERS MANAGEMENT PAGE
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building EduPulse.

## CONTEXT
- Same stack and auth as above
- School admin manages teachers

## APIS AVAILABLE
```
GET  /api/teachers              → list teachers (?search=, ?isActive=)
POST /api/teachers              → create teacher
  Body: { firstName, lastName, email, phone, password, employeeId, qualification }
```

## TASK
Create `app/(admin)/teachers/page.tsx`

## REQUIREMENTS
- Table of teachers: Name, Email, Phone, Employee ID, Qualification, Status, Actions
- Search bar
- "Add Teacher" button → opens modal
- Add Teacher modal form:
  - First Name, Last Name, Email, Phone
  - Employee ID, Qualification
  - Password (auto-generate or manual entry with show/hide)
- Success toast after creating
- Loading and error states
- Empty state with "No teachers yet" message

## OUTPUT FORMAT
Provide only the complete `app/(admin)/teachers/page.tsx` file.

================================================================================
TASK-025 | Agent: Claude Opus | File: app/(admin)/students/page.tsx
STUDENTS MANAGEMENT PAGE
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building EduPulse.

## CONTEXT
- Same stack and auth as above
- studentId is auto-generated by the API (STU/YYYY/NNN format)

## APIS AVAILABLE
```
GET  /api/students              → list students (?search=, ?isActive=, ?classId=)
POST /api/students              → create student
  Body: { firstName, lastName, dateOfBirth, gender, address,
          guardianName, guardianPhone, guardianEmail }
GET  /api/classes               → list classes (for class filter dropdown)
```

## TASK
Create `app/(admin)/students/page.tsx`

## REQUIREMENTS
- Table: Student ID, Name, Gender, Guardian, Class, Enrolled Date, Status, Actions
- Search bar (by name or student ID)
- Class filter dropdown
- "Add Student" button → opens modal
- Add Student modal form:
  - First Name, Last Name
  - Date of Birth, Gender (dropdown: Male/Female/Other)
  - Address
  - Guardian Name, Guardian Phone, Guardian Email
- Show generated studentId in success message
- Loading and error states
- Empty state

## OUTPUT FORMAT
Provide only the complete `app/(admin)/students/page.tsx` file.

================================================================================
TASK-026 | Agent: Claude Opus | File: app/(admin)/classes/page.tsx
CLASSES MANAGEMENT PAGE
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building EduPulse.

## CONTEXT
- Same stack and auth as above

## APIS AVAILABLE
```
GET  /api/classes               → list classes (?search=, ?academicYear=)
POST /api/classes               → create class
  Body: { name, level, section, academicYear, teacherId }
GET  /api/teachers              → list teachers (for teacher assignment dropdown)
POST /api/classes/:id/enroll    → enroll student { studentId }
DELETE /api/classes/:id/enroll  → remove student { studentId }
GET  /api/students?classId=     → list students in class
```

## TASK
Create `app/(admin)/classes/page.tsx`

## REQUIREMENTS
- Table: Class Name, Level, Academic Year, Teacher, Students Count, Actions
- "Add Class" button → opens modal
- Add Class modal:
  - Name, Level, Section
  - Academic Year (e.g. 2025/2026)
  - Assign Teacher dropdown (populated from GET /api/teachers)
- Click a class row → expand to show enrolled students
- Enroll Student button in expanded view → dropdown of available students
- Remove student button per enrolled student
- Loading and error states

## OUTPUT FORMAT
Provide only the complete `app/(admin)/classes/page.tsx` file.

================================================================================
TASK-027 | Agent: Claude Opus | Files: app/(teacher)/layout.tsx + dashboard/page.tsx
TEACHER LAYOUT + DASHBOARD
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building EduPulse.

## CONTEXT
- Same stack and auth as above
- Teacher is scoped to their own classes only

## APIS AVAILABLE
```
GET /api/classes                → returns only teacher's own classes
GET /api/attendance?classId=    → attendance records for a class
GET /api/attendance/summary?classId= → attendance summary stats
```

## TASK
Create two files:

### 1. app/(teacher)/layout.tsx
- "use client" directive
- On mount: check role === TEACHER, else redirect to /login
- Sidebar navigation:
  - Dashboard (/teacher/dashboard)
  - My Classes (/teacher/classes)
  - Attendance (/teacher/attendance)
- Top navbar: teacher's name + logout

### 2. app/(teacher)/dashboard/page.tsx
- Welcome message: "Good morning, [firstName]"
- Stats cards:
  - My Classes (count)
  - Today's Attendance (marked/not marked indicator)
- My Classes list: class name, student count, academic year
- Quick action button: "Mark Attendance" per class

## OUTPUT FORMAT
Provide both files clearly labelled.

================================================================================
TASK-028 | Agent: Claude Opus | File: app/(teacher)/attendance/page.tsx
ATTENDANCE MARKING PAGE
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building EduPulse.

## CONTEXT
- Same stack and auth as above
- Teacher marks attendance for their classes

## APIS AVAILABLE
```
GET  /api/classes                    → teacher's classes
GET  /api/students?classId=          → students in a class
GET  /api/attendance?classId=&date=  → existing attendance for date
POST /api/attendance                 → mark attendance
  Body: { classId, date, attendance: [{ studentId, status, note }] }
GET  /api/attendance/summary?classId= → attendance summary
```

## TASK
Create `app/(teacher)/attendance/page.tsx`

## REQUIREMENTS
- Step 1: Select class from dropdown
- Step 2: Select date (default today)
- Step 3: Show student list with attendance options per student:
  - Radio buttons or button group: PRESENT / ABSENT / LATE / EXCUSED
  - Optional note field per student
  - Pre-fill if attendance already marked for this date (from GET)
- "Submit Attendance" button → POST /api/attendance
- Success message after submit
- Summary section below: show attendance rate for selected class this month
- Loading states throughout

## OUTPUT FORMAT
Provide only the complete `app/(teacher)/attendance/page.tsx` file.

================================================================================
TASK-029 | Agent: Claude Opus | File: app/(admin)/fees/page.tsx
FEES MANAGEMENT PAGE
================================================================================

## ROLE
You are a senior Next.js 16 TypeScript + Tailwind CSS v4 frontend developer
building EduPulse.

## CONTEXT
- Same stack and auth as above
- School admin manages all fee operations

## APIS AVAILABLE
```
GET  /api/fees                         → list fees (?status=, ?studentId=)
GET  /api/fees/structures              → list fee structures
POST /api/fees/structures              → create fee structure
POST /api/fees                         → assign fee (single or bulk)
POST /api/fees/:id/payments            → record payment
PATCH /api/fees/:id                    → waive fee
GET  /api/students                     → list students (for assignment)
GET  /api/classes                      → list classes (for bulk assignment)
```

## TASK
Create `app/(admin)/fees/page.tsx`

## REQUIREMENTS

### Tabs: Fee Structures | Student Fees

### Fee Structures Tab
- Table: Name, Type, Amount, Academic Year, Term, Due Date, Assigned Count
- "Create Structure" button → modal with:
  Name, Type (dropdown of FeeType), Amount, Academic Year, Term, Due Date
- "Assign Fee" button per structure → modal:
  - Option 1: Single student (student search dropdown)
  - Option 2: Entire class (class dropdown)

### Student Fees Tab
- Table: Student Name, Fee Name, Amount Due, Amount Paid, Status badge, Due Date, Actions
- Filter by status (All / Pending / Paid / Overdue / Partial / Waived)
- Search by student name
- Actions per fee:
  - "Record Payment" button → modal:
    Amount, Method (cash/bank_transfer/card), Reference
  - "Waive" button → confirmation dialog
- Status badges: color coded
  - PENDING → yellow
  - PAID → green
  - OVERDUE → red
  - PARTIAL → blue
  - WAIVED → grey

## OUTPUT FORMAT
Provide only the complete `app/(admin)/fees/page.tsx` file.

================================================================================
## TESTING CHECKLIST (verify each page before moving to the next)
================================================================================

### TASK-019 — Login Page
- [ ] Page renders at http://localhost:3000/login
- [ ] Form submits and calls POST /api/auth/login
- [ ] Loading state shows on submit button
- [ ] Error message shows on wrong credentials
- [ ] Super admin redirects to /super-admin/dashboard
- [ ] School admin redirects to /admin/dashboard
- [ ] Teacher redirects to /teacher/dashboard
- [ ] Token saved in localStorage

### TASK-020 — Middleware
- [ ] /super-admin/* redirects to /login when not authenticated
- [ ] /admin/* redirects to /login when not authenticated
- [ ] /teacher/* redirects to /login when not authenticated
- [ ] /login accessible without auth

### TASK-021 — Super Admin Layout + Dashboard
- [ ] Redirects to /login if not SUPER_ADMIN
- [ ] Sidebar shows correct links
- [ ] Logout clears localStorage and redirects
- [ ] Dashboard shows school stats
- [ ] Recent schools table loads

### TASK-022 — Schools Management
- [ ] Schools list loads with search and filter
- [ ] Add school modal works
- [ ] Create admin flow works after school creation
- [ ] Deactivate confirmation dialog shows
- [ ] School detail page loads with tabs

### TASK-023 — Admin Layout + Dashboard
- [ ] Redirects to /login if not SCHOOL_ADMIN
- [ ] Stats cards load correctly
- [ ] Recent students and overdue fees tables load

### TASK-024 — Teachers Page
- [ ] Teachers table loads
- [ ] Search works
- [ ] Add teacher modal submits correctly
- [ ] Success toast shows

### TASK-025 — Students Page
- [ ] Students table loads with Student ID column
- [ ] Class filter dropdown works
- [ ] Add student modal submits correctly
- [ ] Generated studentId shown in success message

### TASK-026 — Classes Page
- [ ] Classes table loads
- [ ] Add class modal with teacher dropdown works
- [ ] Click row expands student list
- [ ] Enroll student works
- [ ] Remove student works

### TASK-027 — Teacher Layout + Dashboard
- [ ] Redirects to /login if not TEACHER
- [ ] Shows only teacher's own classes
- [ ] Quick mark attendance button navigates correctly

### TASK-028 — Attendance Page
- [ ] Class and date selectors work
- [ ] Student list loads for selected class
- [ ] Pre-fills existing attendance if already marked
- [ ] Submit marks attendance via API
- [ ] Summary stats show below

### TASK-029 — Fees Page
- [ ] Tabs switch between Fee Structures and Student Fees
- [ ] Create structure modal works
- [ ] Assign fee modal works (single + bulk)
- [ ] Record payment modal works
- [ ] Waive confirmation dialog works
- [ ] Status badges are color coded correctly
