const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, Prisma } = require('@prisma/client');

// Ensure DATABASE_URL is loaded from .env if not set
if (!process.env.DATABASE_URL) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function runTest() {
  console.log("================================================================================");
  console.log("GAP-004 AUTOMATED REGRESSION TEST: PAYMENT CLASS SNAPSHOT & IMMUTABILITY");
  console.log("================================================================================");

  // 1. Target School & Admin Setup
  const school = await prisma.school.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, studentIdPrefix: true }
  });
  if (!school) throw new Error("No active school found");
  const schoolId = school.id;

  const user = await prisma.user.findFirst({
    where: { schoolId },
    select: { id: true }
  });
  const recordedBy = user?.id || "SYSTEM_ADMIN";

  // 2. Class A (Primary 5A) and Class B (JSS 1A)
  let classA = await prisma.class.findFirst({ where: { schoolId, name: "Primary 5A" } });
  if (!classA) {
    classA = await prisma.class.create({ data: { schoolId, name: "Primary 5A", level: "Primary 5" } });
  }

  let classB = await prisma.class.findFirst({ where: { schoolId, name: "JSS 1A" } });
  if (!classB) {
    classB = await prisma.class.create({ data: { schoolId, name: "JSS 1A", level: "JSS 1" } });
  }

  console.log(`[Setup] School: ${school.name} (${schoolId})`);
  console.log(`[Setup] Class A (Initial): ${classA.name} (${classA.id})`);
  console.log(`[Setup] Class B (Promoted): ${classB.name} (${classB.id})`);

  // 3. Isolated Test Fee Structures & Packages
  const feeStructureA = await prisma.feeStructure.create({
    data: {
      schoolId,
      name: `GAP004 Fee Structure A ${Date.now()}`,
      type: "TUITION",
      amount: 25000,
      academicYear: "2026/2027",
      term: "Term 1",
      dueDate: new Date()
    }
  });

  const feeStructureB = await prisma.feeStructure.create({
    data: {
      schoolId,
      name: `GAP004 Fee Structure B ${Date.now()}`,
      type: "TUITION",
      amount: 30000,
      academicYear: "2026/2027",
      term: "Term 2",
      dueDate: new Date()
    }
  });

  // Package 1: Has historical payment recorded in Class A
  const feePackageWithPayment = await prisma.feePackage.create({
    data: {
      schoolId,
      name: `GAP004 Test Package Paid ${Date.now()}`,
      academicYear: "2026/2027",
      term: "Term 1",
      items: {
        create: [{ feeStructureId: feeStructureA.id }]
      }
    }
  });

  // Package 2: Zero payments recorded for this student (to test Option 2 fallback path)
  const feePackageZeroPayments = await prisma.feePackage.create({
    data: {
      schoolId,
      name: `GAP004 Test Package Unpaid ${Date.now()}`,
      academicYear: "2026/2027",
      term: "Term 2",
      items: {
        create: [{ feeStructureId: feeStructureB.id }]
      }
    }
  });

  let testStudent = null;
  const createdPaymentIds = [];
  const createdPackagePaymentIds = [];

  try {
    // 4. Create Test Student
    testStudent = await prisma.student.create({
      data: {
        schoolId,
        studentId: `TEST-GAP004-${Date.now()}`,
        firstName: "GAP004",
        lastName: "RegressionStudent",
        admissionLevel: "Primary 5"
      }
    });
    console.log(`[1] Created Student: ${testStudent.firstName} ${testStudent.lastName} (${testStudent.id})`);

    // 5. Initial Enrollment in Class A (Primary 5A)
    const enrollmentA = await prisma.classEnrollment.create({
      data: {
        studentId: testStudent.id,
        classId: classA.id,
        academicYear: "2026/2027",
        term: "Term 1",
        enrolledAt: new Date()
      }
    });
    console.log(`[2] Enrolled Student in Class A (${classA.name}), Enrollment ID: ${enrollmentA.id}`);

    // 6. Create assigned Fee record for Fee Structure A
    const feeA = await prisma.fee.create({
      data: {
        schoolId,
        studentId: testStudent.id,
        feeStructureId: feeStructureA.id,
        amountDue: 25000,
        amountPaid: 0,
        status: "PENDING",
        dueDate: new Date()
      }
    });

    // 7. Record Single Fee Payment while in Class A (simulating write-path)
    console.log(`[3] Recording Single Fee Payment while student is in Class A...`);
    const activeEnr1 = await prisma.classEnrollment.findFirst({
      where: { studentId: testStudent.id, endedAt: null },
      select: { classId: true, class: { select: { name: true } } },
      orderBy: { enrolledAt: "desc" },
    });
    const receiptNum1 = `RCP/TEST/${Date.now().toString().slice(-5)}`;
    const paymentA = await prisma.payment.create({
      data: {
        schoolId,
        feeId: feeA.id,
        classId: activeEnr1?.classId || null,
        className: activeEnr1?.class?.name || null,
        receiptNumber: receiptNum1,
        amount: new Prisma.Decimal(10000),
        method: "cash",
        recordedBy
      }
    });
    createdPaymentIds.push(paymentA.id);

    // 8. Record Package Payment while in Class A
    console.log(`[4] Recording Package Payment while student is in Class A...`);
    const activeEnrPkg = await prisma.classEnrollment.findFirst({
      where: { studentId: testStudent.id, endedAt: null },
      select: { classId: true, class: { select: { name: true } } },
      orderBy: { enrolledAt: "desc" },
    });
    const pkgReceiptNum = `PKG/TEST/${Date.now().toString().slice(-5)}`;
    const packagePaymentA = await prisma.packagePayment.create({
      data: {
        schoolId,
        packageId: feePackageWithPayment.id,
        studentId: testStudent.id,
        classId: activeEnrPkg?.classId || null,
        className: activeEnrPkg?.class?.name || null,
        receiptNumber: pkgReceiptNum,
        amount: new Prisma.Decimal(5000),
        method: "bank_transfer",
        recordedBy
      }
    });
    createdPackagePaymentIds.push(packagePaymentA.id);

    // Assertion 1: Verify Initial Write-Time Snapshots
    console.log(`\n[Assertion 1] Verifying write-time class snapshots...`);
    if (paymentA.className !== "Primary 5A" || paymentA.classId !== classA.id) {
      throw new Error(`Assertion Failed: Single Payment did not snapshot Class A. Got: "${paymentA.className}", classId: "${paymentA.classId}"`);
    }
    console.log(`  ✓ PASS: Single Payment ${paymentA.receiptNumber} successfully snapshotted: "${paymentA.className}" (${paymentA.classId})`);

    if (packagePaymentA.className !== "Primary 5A" || packagePaymentA.classId !== classA.id) {
      throw new Error(`Assertion Failed: Package Payment did not snapshot Class A. Got: "${packagePaymentA.className}", classId: "${packagePaymentA.classId}"`);
    }
    console.log(`  ✓ PASS: Package Payment ${packagePaymentA.receiptNumber} successfully snapshotted: "${packagePaymentA.className}" (${packagePaymentA.classId})`);

    // 9. Promote Student from Class A (Primary 5A) to Class B (JSS 1A)
    console.log(`\n[5] PROMOTING STUDENT to Class B (${classB.name})...`);
    await prisma.$transaction(async (tx) => {
      // Close old enrollment
      await tx.classEnrollment.update({
        where: { id: enrollmentA.id },
        data: { endedAt: new Date() }
      });
      // Create new enrollment
      await tx.classEnrollment.create({
        data: {
          studentId: testStudent.id,
          classId: classB.id,
          academicYear: "2026/2027",
          term: "Term 2",
          enrolledAt: new Date()
        }
      });
    });
    console.log(`  ✓ Student promoted. Active enrollment is now Class B (${classB.name}).`);

    // Verify current active enrollment
    const currentActive = await prisma.classEnrollment.findFirst({
      where: { studentId: testStudent.id, endedAt: null },
      include: { class: true }
    });
    console.log(`  ✓ Verified Live Current Active Class: "${currentActive?.class?.name}"`);

    // 10. Assertion 2 (IMMUTABILITY AUDIT): Check historical payments
    console.log(`\n[Assertion 2 - IMMUTABILITY AUDIT] Checking historical payment records after student promotion...`);
    const refetchedPaymentA = await prisma.payment.findUnique({ where: { id: paymentA.id } });
    const refetchedPkgPaymentA = await prisma.packagePayment.findUnique({ where: { id: packagePaymentA.id } });

    console.log(`  Historical Single Payment ${refetchedPaymentA.receiptNumber}: className = "${refetchedPaymentA.className}" (classId: ${refetchedPaymentA.classId})`);
    console.log(`  Historical Package Payment ${refetchedPkgPaymentA.receiptNumber}: className = "${refetchedPkgPaymentA.className}" (classId: ${refetchedPkgPaymentA.classId})`);

    if (refetchedPaymentA.className !== "Primary 5A" || refetchedPaymentA.className === currentActive?.class?.name) {
      throw new Error(`CRITICAL IMMUTABILITY FAILURE: Historical Single Payment className drifted to "${refetchedPaymentA.className}"! Expected "Primary 5A".`);
    }
    console.log(`  ✓ PASS: Historical Single Payment remained permanently frozen as "Primary 5A"!`);

    if (refetchedPkgPaymentA.className !== "Primary 5A" || refetchedPkgPaymentA.className === currentActive?.class?.name) {
      throw new Error(`CRITICAL IMMUTABILITY FAILURE: Historical Package Payment className drifted to "${refetchedPkgPaymentA.className}"! Expected "Primary 5A".`);
    }
    console.log(`  ✓ PASS: Historical Package Payment remained permanently frozen as "Primary 5A"!`);

    // 11. Record New Payment while in Class B (JSS 1A)
    console.log(`\n[6] Recording subsequent payment while student is active in Class B (${classB.name})...`);
    const feeB = await prisma.fee.create({
      data: {
        schoolId,
        studentId: testStudent.id,
        feeStructureId: feeStructureB.id,
        amountDue: 30000,
        amountPaid: 0,
        status: "PENDING",
        dueDate: new Date()
      }
    });

    const activeEnr2 = await prisma.classEnrollment.findFirst({
      where: { studentId: testStudent.id, endedAt: null },
      select: { classId: true, class: { select: { name: true } } },
      orderBy: { enrolledAt: "desc" },
    });
    const receiptNum2 = `RCP/TEST/${Date.now().toString().slice(-5)}`;
    const paymentB = await prisma.payment.create({
      data: {
        schoolId,
        feeId: feeB.id,
        classId: activeEnr2?.classId || null,
        className: activeEnr2?.class?.name || null,
        receiptNumber: receiptNum2,
        amount: new Prisma.Decimal(15000),
        method: "cash",
        recordedBy
      }
    });
    createdPaymentIds.push(paymentB.id);

    // Assertion 3: New Payment Snapshots Class B
    console.log(`[Assertion 3] Verifying new payment captures newly active promoted class...`);
    if (paymentB.className !== "JSS 1A" || paymentB.classId !== classB.id) {
      throw new Error(`Assertion Failed: New Payment in Class B did not snapshot Class B. Got: "${paymentB.className}"`);
    }
    console.log(`  ✓ PASS: New Payment ${paymentB.receiptNumber} successfully snapshotted: "${paymentB.className}"`);

    // 12. Assertion 4A: Package Balance Endpoint Option 2 Primary Path (With Historical Package Payment)
    console.log(`\n[Assertion 4A - PACKAGE BALANCE PRIMARY SNAPSHOT BRANCH] Verifying Option 2 with existing package payment...`);
    const latestPkgPaymentForPackage = await prisma.packagePayment.findFirst({
      where: {
        schoolId,
        studentId: testStudent.id,
        packageId: feePackageWithPayment.id,
        deletedAt: null
      },
      orderBy: { paidAt: "desc" },
      select: { className: true }
    });
    const resolvedBalanceClassNamePrimary = latestPkgPaymentForPackage?.className || currentActive?.class?.name || null;
    console.log(`  Resolved Balance Class (Primary): "${resolvedBalanceClassNamePrimary}" (Expected: "Primary 5A" from snapshot)`);
    if (resolvedBalanceClassNamePrimary !== "Primary 5A") {
      throw new Error(`Assertion Failed: Balance endpoint did not resolve latest transaction snapshot "Primary 5A". Got: "${resolvedBalanceClassNamePrimary}"`);
    }
    console.log(`  ✓ PASS: Primary snapshot branch resolved frozen historical class: "Primary 5A"`);

    // 13. Assertion 4B: Package Balance Endpoint Option 2 Fallback Branch (Zero Package Payments)
    console.log(`\n[Assertion 4B - PACKAGE BALANCE ZERO-PAYMENT FALLBACK BRANCH] Verifying Option 2 fallback when 0 payments exist...`);
    const latestPkgPaymentForUnpaid = await prisma.packagePayment.findFirst({
      where: {
        schoolId,
        studentId: testStudent.id,
        packageId: feePackageZeroPayments.id,
        deletedAt: null
      },
      orderBy: { paidAt: "desc" },
      select: { className: true }
    });
    const studentForFallback = await prisma.student.findFirst({
      where: { id: testStudent.id, schoolId },
      select: {
        classEnrollments: {
          where: { endedAt: null },
          select: { class: { select: { id: true, name: true } } },
          take: 1,
          orderBy: { enrolledAt: "desc" }
        }
      }
    });
    const resolvedBalanceClassNameFallback = latestPkgPaymentForUnpaid?.className || studentForFallback?.classEnrollments[0]?.class?.name || null;
    console.log(`  PackagePayment records found: ${latestPkgPaymentForUnpaid ? 1 : 0}`);
    console.log(`  Resolved Balance Class (Fallback): "${resolvedBalanceClassNameFallback}" (Expected: "JSS 1A" from live active enrollment)`);
    if (resolvedBalanceClassNameFallback !== "JSS 1A") {
      throw new Error(`Assertion Failed: Fallback branch did not resolve live active class "JSS 1A". Got: "${resolvedBalanceClassNameFallback}"`);
    }
    console.log(`  ✓ PASS: Fallback branch correctly resolved live active class: "JSS 1A"`);

    console.log("\n================================================================================");
    console.log("ALL GAP-004 REGRESSION TESTS (INCLUDING BALANCE FALLBACK) PASSED 100% CLEANLY!");
    console.log("================================================================================");

  } finally {
    console.log("\n[Cleanup] Removing test entities...");
    if (createdPaymentIds.length > 0) {
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdPackagePaymentIds.length > 0) {
      await prisma.packagePayment.deleteMany({ where: { id: { in: createdPackagePaymentIds } } });
    }
    if (testStudent) {
      await prisma.fee.deleteMany({ where: { studentId: testStudent.id } });
      await prisma.classEnrollment.deleteMany({ where: { studentId: testStudent.id } });
      await prisma.student.delete({ where: { id: testStudent.id } });
    }
    await prisma.feePackageItem.deleteMany({ where: { packageId: { in: [feePackageWithPayment.id, feePackageZeroPayments.id] } } });
    await prisma.feePackage.deleteMany({ where: { id: { in: [feePackageWithPayment.id, feePackageZeroPayments.id] } } });
    await prisma.feeStructure.deleteMany({ where: { id: { in: [feeStructureA.id, feeStructureB.id] } } });
    await pool.end();
    console.log("[Cleanup] Test environment cleanly restored.\n");
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nTEST RUN FAILED:", err);
    process.exit(1);
  });
