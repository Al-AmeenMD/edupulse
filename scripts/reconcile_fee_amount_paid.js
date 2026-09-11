require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function reconcileFees() {
  console.log("==========================================================");
  console.log("Fee.amountPaid & Status Reconciliation Script (GAP-002)");
  console.log("==========================================================\n");

  const fees = await prisma.fee.findMany({
    include: {
      payments: {
        where: { deletedAt: null },
        orderBy: { paidAt: "desc" },
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
          isActive: true,
        },
      },
      school: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
      feeStructure: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log(`Total fees scanned across entire database: ${fees.length}\n`);

  let reconciledCount = 0;
  let intactCount = 0;
  const reconciliations = [];

  const now = new Date();

  for (const fee of fees) {
    const activePayments = fee.payments;
    const computedAmountPaid = activePayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const amountDue = Number(fee.amountDue);
    const currentAmountPaid = Number(fee.amountPaid);
    const currentStatus = fee.status;

    let targetStatus = currentStatus;
    let targetPaidAt = fee.paidAt;

    if (currentStatus === "WAIVED") {
      targetStatus = "WAIVED";
      // WAIVED fee maintains status WAIVED
    } else {
      if (computedAmountPaid >= amountDue && amountDue > 0) {
        targetStatus = "PAID";
        targetPaidAt = activePayments[0]?.paidAt || fee.paidAt || now;
      } else if (computedAmountPaid > 0) {
        targetStatus = "PARTIAL";
        targetPaidAt = null;
      } else {
        const dueDate = new Date(fee.dueDate);
        if (dueDate < now) {
          targetStatus = "OVERDUE";
        } else {
          targetStatus = "PENDING";
        }
        targetPaidAt = null;
      }
    }

    const hasDivergence =
      Math.abs(currentAmountPaid - computedAmountPaid) > 0.001 ||
      currentStatus !== targetStatus;

    if (hasDivergence) {
      reconciledCount++;
      const beforeState = {
        feeId: fee.id,
        student: `${fee.student?.firstName} ${fee.student?.lastName} (${fee.student?.studentId})`,
        school: fee.school?.name,
        feeName: fee.feeStructure?.name,
        amountDue: amountDue,
        amountPaid: currentAmountPaid,
        status: currentStatus,
        activePaymentCount: activePayments.length,
      };

      await prisma.fee.update({
        where: { id: fee.id },
        data: {
          amountPaid: computedAmountPaid,
          status: targetStatus,
          paidAt: targetPaidAt,
        },
      });

      const afterState = {
        amountPaid: computedAmountPaid,
        status: targetStatus,
        paidAt: targetPaidAt,
      };

      reconciliations.push({ before: beforeState, after: afterState });
      console.log(`[RECONCILED] Fee ID: ${fee.id}`);
      console.log(`  Student: ${beforeState.student} | School: ${beforeState.school}`);
      console.log(`  Fee: ${beforeState.feeName} | Amount Due: ${beforeState.amountDue}`);
      console.log(`  Before -> amountPaid: ${beforeState.amountPaid}, status: ${beforeState.status}`);
      console.log(`  After  -> amountPaid: ${afterState.amountPaid}, status: ${afterState.status}\n`);
    } else {
      intactCount++;
    }
  }

  console.log("==========================================================");
  console.log("Reconciliation Summary");
  console.log("==========================================================");
  console.log(`Total Fees Inspected: ${fees.length}`);
  console.log(`Already Intact / Accurate: ${intactCount}`);
  console.log(`Divergent Fees Reconciled: ${reconciledCount}`);
  console.log("==========================================================\n");

  await prisma.$disconnect();
  await pool.end();
  return { total: fees.length, reconciledCount, reconciliations };
}

if (require.main === module) {
  reconcileFees()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Reconciliation error:", err);
      process.exit(1);
    });
}

module.exports = { reconcileFees };
