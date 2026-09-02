import { Fee, Payment, PackagePayment, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const VALID_PAYMENT_METHODS = ["cash", "bank_transfer", "card"] as const;
export type PaymentMethod = (typeof VALID_PAYMENT_METHODS)[number];

export class FeePaymentError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "FeePaymentError";
    this.statusCode = statusCode;
  }
}

export interface SinglePaymentParams {
  schoolId: string;
  feeId: string;
  amount: number | Prisma.Decimal;
  method: string;
  reference?: string | null;
  recordedBy: string;
  packagePaymentId?: string | null;
  customReceiptNumber?: string;
}

export interface SinglePaymentResult {
  payment: Payment;
  updatedFee: Fee;
}

export interface PackagePaymentAllocationItem {
  feeId: string;
  amount: number | Prisma.Decimal;
}

export interface RecordPackagePaymentParams {
  schoolId: string;
  packageId: string;
  studentId: string;
  amount: number | Prisma.Decimal;
  method: string;
  reference?: string | null;
  note?: string | null;
  recordedBy: string;
  allocations?: PackagePaymentAllocationItem[];
}

export interface PackagePaymentExecutionResult {
  packagePayment: PackagePayment;
  payments: Payment[];
  summary: {
    totalAllocated: string;
    componentsSettled: number;
    componentsPartial: number;
  };
}

/**
 * Validates payment method against permitted enum values.
 */
export function validatePaymentMethod(method: string): string {
  const normalized = method?.trim().toLowerCase();
  if (!VALID_PAYMENT_METHODS.includes(normalized as PaymentMethod)) {
    throw new FeePaymentError(
      `Invalid payment method: ${method}. Must be one of ${VALID_PAYMENT_METHODS.join(", ")}`,
      400
    );
  }
  return normalized;
}

/**
 * Core atomic single-fee payment handler.
 * Can be executed as a standalone single payment or as a sub-operation within a package payment.
 */
export async function recordSingleFeePaymentCore(
  params: SinglePaymentParams,
  tx: Prisma.TransactionClient
): Promise<SinglePaymentResult> {
  const {
    schoolId,
    feeId,
    amount,
    method,
    reference,
    recordedBy,
    packagePaymentId,
    customReceiptNumber,
  } = params;

  const validMethod = validatePaymentMethod(method);

  const paymentAmount = new Prisma.Decimal(amount);
  if (paymentAmount.lessThanOrEqualTo(0) || paymentAmount.isNaN()) {
    throw new FeePaymentError("amount must be a positive number", 400);
  }

  // Verify fee exists and belongs to school
  const fee = await tx.fee.findUnique({
    where: { id: feeId },
    select: {
      id: true,
      schoolId: true,
      amountDue: true,
      amountPaid: true,
      status: true,
    },
  });

  if (!fee || fee.schoolId !== schoolId) {
    throw new FeePaymentError("Fee not found", 404);
  }

  if (fee.status === "PAID") {
    throw new FeePaymentError("This fee has already been fully paid", 400);
  }

  if (fee.status === "WAIVED") {
    throw new FeePaymentError("This fee has been waived and cannot accept payments", 400);
  }

  const amountDue = new Prisma.Decimal(fee.amountDue);
  const currentPaid = new Prisma.Decimal(fee.amountPaid);
  const newAmountPaid = currentPaid.add(paymentAmount);

  if (newAmountPaid.greaterThan(amountDue)) {
    const remaining = amountDue.sub(currentPaid);
    throw new FeePaymentError(
      `Payment would exceed amount due. Remaining balance is ${remaining.toFixed(2)}`,
      400
    );
  }

  let newStatus: "PAID" | "PARTIAL" | "PENDING";
  let paidAt: Date | null = null;

  if (newAmountPaid.greaterThanOrEqualTo(amountDue)) {
    newStatus = "PAID";
    paidAt = new Date();
  } else if (newAmountPaid.greaterThan(0)) {
    newStatus = "PARTIAL";
  } else {
    newStatus = "PENDING";
  }

  let receiptNumber = customReceiptNumber;
  if (!receiptNumber) {
    const school = await tx.school.findUnique({
      where: { id: schoolId },
      select: { studentIdPrefix: true },
    });
    const prefix = (school?.studentIdPrefix || "SCH").toUpperCase();
    const year = new Date().getFullYear().toString();
    const currentCount = await tx.payment.count({ where: { schoolId } });
    const seq = currentCount + 1;
    receiptNumber = `RCP/${prefix}/${year}/${String(seq).padStart(5, "0")}`;
  }

  const newPayment = await tx.payment.create({
    data: {
      schoolId,
      feeId,
      packagePaymentId: packagePaymentId || null,
      receiptNumber,
      amount: paymentAmount,
      method: validMethod,
      reference: reference?.trim() || null,
      recordedBy,
    },
  });

  const feeUpdate = await tx.fee.update({
    where: { id: feeId },
    data: {
      amountPaid: newAmountPaid,
      status: newStatus,
      paidAt,
    },
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
        },
      },
      feeStructure: {
        select: {
          id: true,
          name: true,
          type: true,
          academicYear: true,
          term: true,
        },
      },
    },
  });

  return { payment: newPayment, updatedFee: feeUpdate };
}

/**
 * Master atomic package payment execution engine.
 * Creates PackagePayment header and underlying Payment rows with wholesale transaction retry.
 */
export async function recordPackagePayment(
  params: RecordPackagePaymentParams,
  txClient?: Prisma.TransactionClient
): Promise<PackagePaymentExecutionResult> {
  const {
    schoolId,
    packageId,
    studentId,
    amount,
    method,
    reference,
    note,
    recordedBy,
    allocations,
  } = params;

  const validMethod = validatePaymentMethod(method);
  const totalPaymentAmount = new Prisma.Decimal(amount);

  if (totalPaymentAmount.lessThanOrEqualTo(0) || totalPaymentAmount.isNaN()) {
    throw new FeePaymentError("amount must be a positive number", 400);
  }

  // Look up school prefix
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, studentIdPrefix: true },
  });
  if (!school) throw new FeePaymentError("School not found", 404);
  const prefix = (school.studentIdPrefix || "SCH").toUpperCase();
  const year = new Date().getFullYear().toString();

  // Validate package belongs to school
  const pkg = await prisma.feePackage.findFirst({
    where: { id: packageId, schoolId },
    include: {
      items: {
        include: {
          feeStructure: true,
        },
      },
    },
  });

  if (!pkg) {
    throw new FeePaymentError("Fee package not found", 404);
  }

  if (pkg.items.length === 0) {
    throw new FeePaymentError("This fee package has no bundled fee structures", 400);
  }

  // Validate student belongs to school
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!student) {
    throw new FeePaymentError("Student not found", 404);
  }

  const bundledStructureIds = pkg.items.map((it) => it.feeStructureId);

  // Fetch student's actual assigned fees matching the package
  const studentFees = await prisma.fee.findMany({
    where: {
      schoolId,
      studentId,
      feeStructureId: { in: bundledStructureIds },
    },
    include: {
      feeStructure: true,
    },
  });

  if (studentFees.length === 0) {
    throw new FeePaymentError("No assigned fee records found for this student and fee package", 404);
  }

  // Compute remaining balances for each package item (assigned active fees only)
  interface ComponentState {
    feeId: string | null;
    feeStructureId: string;
    feeStructure: { id: string; name: string; amount: any; dueDate?: any };
    fee: (typeof studentFees)[0] | null;
    remaining: Prisma.Decimal;
    isAssigned: boolean;
  }

  const componentMap = new Map<string, ComponentState>();
  let totalOutstanding = new Prisma.Decimal(0);

  for (const item of pkg.items) {
    const matchingFee = studentFees.find((f) => f.feeStructureId === item.feeStructureId);
    if (!matchingFee) {
      const state: ComponentState = {
        feeId: null,
        feeStructureId: item.feeStructureId,
        feeStructure: item.feeStructure,
        fee: null,
        remaining: new Prisma.Decimal(0), // Unassigned component is non-payable
        isAssigned: false,
      };
      componentMap.set(item.feeStructureId, state);
    } else if (matchingFee.status === "WAIVED") {
      const state: ComponentState = {
        feeId: matchingFee.id,
        feeStructureId: item.feeStructureId,
        feeStructure: matchingFee.feeStructure,
        fee: matchingFee,
        remaining: new Prisma.Decimal(0),
        isAssigned: true,
      };
      componentMap.set(matchingFee.id, state);
      componentMap.set(item.feeStructureId, state);
    } else {
      const due = new Prisma.Decimal(matchingFee.amountDue);
      const paid = new Prisma.Decimal(matchingFee.amountPaid);
      const rem = due.sub(paid);
      const posRem = rem.greaterThan(0) ? rem : new Prisma.Decimal(0);
      const state: ComponentState = {
        feeId: matchingFee.id,
        feeStructureId: item.feeStructureId,
        feeStructure: matchingFee.feeStructure,
        fee: matchingFee,
        remaining: posRem,
        isAssigned: true,
      };
      componentMap.set(matchingFee.id, state);
      componentMap.set(item.feeStructureId, state);
      totalOutstanding = totalOutstanding.add(posRem);
    }
  }

  if (totalPaymentAmount.greaterThan(totalOutstanding)) {
    throw new FeePaymentError(
      `Payment amount exceeds total package outstanding balance (${totalOutstanding.toFixed(2)})`,
      400
    );
  }

  // Determine allocations
  const resolvedAllocations: Array<{ feeStructureId: string; feeId: string; amount: Prisma.Decimal }> = [];

  if (!allocations || allocations.length === 0) {
    // Allocations omitted: only allowed if amount exactly matches total outstanding
    if (!totalPaymentAmount.equals(totalOutstanding)) {
      throw new FeePaymentError("Partial package payments require explicit per-component allocations", 400);
    }

    // Auto-settle each assigned active component
    const processedStructureIds = new Set<string>();
    for (const item of componentMap.values()) {
      if (item.isAssigned && item.feeId && !processedStructureIds.has(item.feeStructureId)) {
        processedStructureIds.add(item.feeStructureId);
        if (item.remaining.greaterThan(0)) {
          resolvedAllocations.push({
            feeStructureId: item.feeStructureId,
            feeId: item.feeId,
            amount: item.remaining,
          });
        }
      }
    }
  } else {
    // Manual allocations provided
    let sumAllocations = new Prisma.Decimal(0);

    for (const alloc of allocations) {
      const allocAmt = new Prisma.Decimal(alloc.amount || 0);
      if (allocAmt.lessThan(0)) {
        throw new FeePaymentError("Allocation amounts cannot be negative", 400);
      }

      const lookupKey = alloc.feeId || (alloc as any).feeStructureId;
      const comp = componentMap.get(lookupKey);
      if (!comp) {
        throw new FeePaymentError(`Fee component '${lookupKey}' does not belong to this package`, 400);
      }

      if (!comp.isAssigned || !comp.feeId) {
        throw new FeePaymentError(
          `Component '${comp.feeStructure.name}' has not been assigned to this student yet — assign it individually first`,
          400
        );
      }

      if (allocAmt.greaterThan(comp.remaining)) {
        throw new FeePaymentError(
          `Allocation for '${comp.feeStructure.name}' exceeds remaining balance (${comp.remaining.toFixed(2)})`,
          400
        );
      }

      sumAllocations = sumAllocations.add(allocAmt);
      resolvedAllocations.push({
        feeStructureId: comp.feeStructureId,
        feeId: comp.feeId,
        amount: allocAmt,
      });
    }

    if (!sumAllocations.equals(totalPaymentAmount)) {
      throw new FeePaymentError(
        `Sum of component allocations (${sumAllocations.toFixed(2)}) must equal total payment amount (${totalPaymentAmount.toFixed(2)})`,
        400
      );
    }
  }

  // Filter components with positive allocation (> 0) to skip creating 0-amount payments
  const positiveAllocations = resolvedAllocations.filter((a) => a.amount.greaterThan(0));

  const runWithTransaction = async (tx: Prisma.TransactionClient): Promise<PackagePaymentExecutionResult> => {
    // 1. Generate PackagePayment.receiptNumber
    const pkgCount = await tx.packagePayment.count({ where: { schoolId } });
    const pkgSeq = pkgCount + 1;
    const pkgReceiptNumber = `PKG/RCP/${prefix}/${year}/${String(pkgSeq).padStart(5, "0")}`;

    // 2. Create PackagePayment header
    const packagePayment = await tx.packagePayment.create({
      data: {
        schoolId,
        packageId,
        studentId,
        receiptNumber: pkgReceiptNumber,
        amount: totalPaymentAmount,
        method: validMethod,
        reference: reference?.trim() || null,
        note: note?.trim() || null,
        recordedBy,
      },
    });

    // 3. Create component Payment rows against existing assigned fees
    const basePaymentCount = await tx.payment.count({ where: { schoolId } });
    const createdPayments: Payment[] = [];
    let componentsSettled = 0;
    let componentsPartial = 0;

    for (let i = 0; i < positiveAllocations.length; i++) {
      const alloc = positiveAllocations[i];
      const compSeq = basePaymentCount + 1 + i;
      const compReceiptNumber = `RCP/${prefix}/${year}/${String(compSeq).padStart(5, "0")}`;

      const { payment, updatedFee } = await recordSingleFeePaymentCore(
        {
          schoolId,
          feeId: alloc.feeId,
          amount: alloc.amount,
          method: validMethod,
          reference: reference?.trim() || null,
          recordedBy,
          packagePaymentId: packagePayment.id,
          customReceiptNumber: compReceiptNumber,
        },
        tx
      );

      createdPayments.push(payment);
      if (updatedFee.status === "PAID") componentsSettled++;
      else if (updatedFee.status === "PARTIAL") componentsPartial++;
    }

    return {
      packagePayment,
      payments: createdPayments,
      summary: {
        totalAllocated: totalPaymentAmount.toFixed(2),
        componentsSettled,
        componentsPartial,
      },
    };
  };

  if (txClient) {
    return runWithTransaction(txClient);
  }

  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(runWithTransaction, { maxWait: 10000, timeout: 20000 });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        console.log(`[Package Payment Collision Handled] Caught P2002 on attempt ${attempt + 1}. Retrying...`);
        if (attempt === MAX_RETRIES - 1) throw err;
        continue;
      }
      throw err;
    }
  }

  throw new FeePaymentError("Transaction failed after maximum retries", 500);
}
