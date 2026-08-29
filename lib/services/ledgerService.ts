import { FeeType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LedgerEntryType = "PAYMENT" | "EXPENSE" | "BUDGET_CHANGE";
export type LedgerDirection = "IN" | "OUT" | null;

export interface NormalizedLedgerEntry {
  id: string;
  sourceId: string;
  type: LedgerEntryType;
  direction: LedgerDirection;
  occurredAt: string;
  description: string;
  category: string;
  amount: string;
  reference: string | null;
  method: string | null;
  recordedBy: string;
  metadata: {
    studentId?: string;
    studentName?: string;
    academicYear?: string;
    term?: string;
    previousAmount?: string | null;
    newAmount?: string | null;
    expenseDate?: string;
  };
}

export interface UnifiedLedgerSummary {
  totalInflow: string;
  totalOutflow: string;
  netCashFlow: string;
  totalBudgeted: string;
  counts: {
    payments: number;
    expenses: number;
    budgetChanges: number;
    total: number;
  };
}

export interface UnifiedLedgerPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface UnifiedLedgerResponse {
  data: {
    entries: NormalizedLedgerEntry[];
    summary: UnifiedLedgerSummary;
    pagination: UnifiedLedgerPagination;
  };
}

export interface LedgerQueryOptions {
  type?: "ALL" | "PAYMENT" | "EXPENSE" | "BUDGET_CHANGE";
  startDate?: string;
  endDate?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortOrder?: "desc" | "asc";
}

const VALID_FEE_TYPES = Object.values(FeeType);

/**
 * Unified Financial Ledger Service
 * Performs read-only projection across Payment, Expense, and BudgetAuditLog.
 */
export async function getUnifiedLedger(
  schoolId: string,
  options: LedgerQueryOptions = {}
): Promise<UnifiedLedgerResponse> {
  const typeFilter = options.type || "ALL";
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const sortOrder = options.sortOrder === "asc" ? "asc" : "desc";
  const search = options.search?.trim() || "";
  const category = options.category?.trim() || "";
  const startDate = options.startDate?.trim() || "";
  const endDate = options.endDate?.trim() || "";

  // ---------------------------------------------------------------------------
  // 1. Date Range Handling (Exact Calendar Boundaries)
  // ---------------------------------------------------------------------------
  const startOfRange = startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined;
  const endOfRange = endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined;

  // ---------------------------------------------------------------------------
  // 2. Source Flags
  // ---------------------------------------------------------------------------
  const includePayments = typeFilter === "ALL" || typeFilter === "PAYMENT";
  const includeExpenses = typeFilter === "ALL" || typeFilter === "EXPENSE";
  const includeBudgets = typeFilter === "ALL" || typeFilter === "BUDGET_CHANGE";

  // ---------------------------------------------------------------------------
  // 3. Construct Where Clauses with Tenant Isolation
  // ---------------------------------------------------------------------------
  const paymentWhere: Prisma.PaymentWhereInput = { schoolId };
  const expenseWhere: Prisma.ExpenseWhereInput = { schoolId, deletedAt: null };
  const budgetAuditWhere: Prisma.BudgetAuditLogWhereInput = {
    budget: { schoolId },
  };

  // Date filters
  if (startOfRange || endOfRange) {
    paymentWhere.paidAt = {
      ...(startOfRange ? { gte: startOfRange } : {}),
      ...(endOfRange ? { lte: endOfRange } : {}),
    };
    budgetAuditWhere.changedAt = {
      ...(startOfRange ? { gte: startOfRange } : {}),
      ...(endOfRange ? { lte: endOfRange } : {}),
    };
  }

  if (startDate || endDate) {
    expenseWhere.expenseDate = {
      ...(startDate ? { gte: new Date(`${startDate}T00:00:00.000Z`) } : {}),
      ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
    };
  }

  // Category filters
  if (category && category !== "ALL") {
    const isFeeTypeMatch = VALID_FEE_TYPES.includes(category.toUpperCase() as FeeType);
    const isBudgetCategory =
      category.toLowerCase() === "budget allocation" ||
      category.toLowerCase() === "budget";

    if (isFeeTypeMatch) {
      paymentWhere.fee = {
        feeStructure: { type: category.toUpperCase() as FeeType },
      };
    } else {
      // Incompatible category for Payment
      paymentWhere.id = "__no_matching_payment_category__";
    }

    if (!isBudgetCategory && !isFeeTypeMatch) {
      expenseWhere.category = { equals: category, mode: "insensitive" };
    } else if (isFeeTypeMatch) {
      // Allow if an expense category literally matches the fee type string
      expenseWhere.category = { equals: category, mode: "insensitive" };
    } else {
      // Incompatible category for Expense
      expenseWhere.id = "__no_matching_expense_category__";
    }

    if (isBudgetCategory) {
      // Budget audits match
    } else {
      // Incompatible category for Budget Audit
      budgetAuditWhere.id = "__no_matching_budget_category__";
    }
  }

  // Search filters
  if (search) {
    paymentWhere.OR = [
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
      { method: { contains: search, mode: "insensitive" } },
      { fee: { student: { firstName: { contains: search, mode: "insensitive" } } } },
      { fee: { student: { lastName: { contains: search, mode: "insensitive" } } } },
      { fee: { student: { studentId: { contains: search, mode: "insensitive" } } } },
      { fee: { feeStructure: { name: { contains: search, mode: "insensitive" } } } },
    ];

    expenseWhere.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];

    budgetAuditWhere.OR = [
      { budget: { academicYear: { contains: search, mode: "insensitive" } } },
      { budget: { term: { contains: search, mode: "insensitive" } } },
    ];
  }

  // ---------------------------------------------------------------------------
  // 4. Parallel Counts & Financial Aggregations
  // ---------------------------------------------------------------------------
  const [
    paymentCount,
    expenseCount,
    budgetAuditCount,
    paymentsAgg,
    expensesAgg,
    activeBudgets,
  ] = await Promise.all([
    includePayments ? prisma.payment.count({ where: paymentWhere }) : 0,
    includeExpenses ? prisma.expense.count({ where: expenseWhere }) : 0,
    includeBudgets ? prisma.budgetAuditLog.count({ where: budgetAuditWhere }) : 0,
    includePayments
      ? prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } })
      : { _sum: { amount: null } },
    includeExpenses
      ? prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } })
      : { _sum: { amount: null } },
    prisma.budget.findMany({
      where: { schoolId },
      select: { amount: true },
    }),
  ]);

  const totalItems = paymentCount + expenseCount + budgetAuditCount;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  // Financial summary computation
  const totalInflowDecimal = new Prisma.Decimal(paymentsAgg._sum.amount || 0);
  const totalOutflowDecimal = new Prisma.Decimal(expensesAgg._sum.amount || 0);
  const netCashFlowDecimal = totalInflowDecimal.sub(totalOutflowDecimal);
  const totalBudgetedDecimal = activeBudgets.reduce(
    (sum, b) => sum.add(new Prisma.Decimal(b.amount)),
    new Prisma.Decimal(0)
  );

  // ---------------------------------------------------------------------------
  // 5. Data Retrieval with Bounded Window Slicing
  // ---------------------------------------------------------------------------
  let rawPayments: any[] = [];
  let rawExpenses: any[] = [];
  let rawBudgetAudits: any[] = [];

  if (typeFilter === "PAYMENT") {
    rawPayments = await prisma.payment.findMany({
      where: paymentWhere,
      orderBy: [{ paidAt: sortOrder }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        fee: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
            feeStructure: { select: { id: true, name: true, type: true, academicYear: true, term: true } },
          },
        },
      },
    });
  } else if (typeFilter === "EXPENSE") {
    rawExpenses = await prisma.expense.findMany({
      where: expenseWhere,
      orderBy: [{ expenseDate: sortOrder }, { createdAt: sortOrder }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    });
  } else if (typeFilter === "BUDGET_CHANGE") {
    rawBudgetAudits = await prisma.budgetAuditLog.findMany({
      where: budgetAuditWhere,
      orderBy: [{ changedAt: sortOrder }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        budget: { select: { id: true, academicYear: true, term: true } },
      },
    });
  } else {
    // type === "ALL": Multi-stream query with bounded window take (page * limit)
    const windowSize = page * limit;
    [rawPayments, rawExpenses, rawBudgetAudits] = await Promise.all([
      includePayments
        ? prisma.payment.findMany({
            where: paymentWhere,
            orderBy: [{ paidAt: sortOrder }, { id: "desc" }],
            take: windowSize,
            include: {
              fee: {
                include: {
                  student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
                  feeStructure: { select: { id: true, name: true, type: true, academicYear: true, term: true } },
                },
              },
            },
          })
        : [],
      includeExpenses
        ? prisma.expense.findMany({
            where: expenseWhere,
            orderBy: [{ expenseDate: sortOrder }, { createdAt: sortOrder }, { id: "desc" }],
            take: windowSize,
          })
        : [],
      includeBudgets
        ? prisma.budgetAuditLog.findMany({
            where: budgetAuditWhere,
            orderBy: [{ changedAt: sortOrder }, { id: "desc" }],
            take: windowSize,
            include: {
              budget: { select: { id: true, academicYear: true, term: true } },
            },
          })
        : [],
    ]);
  }

  // ---------------------------------------------------------------------------
  // 6. Batch Resolve RecordedBy / ChangedBy User Names (Tenant-Scoped)
  // ---------------------------------------------------------------------------
  const userIds = new Set<string>();
  rawPayments.forEach((p) => { if (p.recordedBy) userIds.add(p.recordedBy); });
  rawExpenses.forEach((e) => { if (e.recordedBy) userIds.add(e.recordedBy); });
  rawBudgetAudits.forEach((b) => { if (b.changedBy) userIds.add(b.changedBy); });

  const users = userIds.size > 0
    ? await prisma.user.findMany({
        where: {
          id: { in: Array.from(userIds) },
          schoolId,
        },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];

  const userMap = new Map(
    users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()])
  );

  // ---------------------------------------------------------------------------
  // 7. Normalization
  // ---------------------------------------------------------------------------
  const normalizedPayments: NormalizedLedgerEntry[] = rawPayments.map((p) => {
    const amtDecimal = new Prisma.Decimal(p.amount);
    const student = p.fee?.student;
    const structure = p.fee?.feeStructure;
    const studentName = student ? `${student.firstName} ${student.lastName}`.trim() : "Student";
    const studentId = student?.studentId || "";
    const structureName = structure?.name || "Fee";

    return {
      id: `PAYMENT_${p.id}`,
      sourceId: p.id,
      type: "PAYMENT",
      direction: "IN",
      occurredAt: p.paidAt.toISOString(),
      description: `Payment for ${structureName} — ${studentName}${studentId ? ` (${studentId})` : ""}`,
      category: structure?.type || "TUITION",
      amount: amtDecimal.toFixed(2),
      reference: p.receiptNumber,
      method: p.method,
      recordedBy: userMap.get(p.recordedBy) || "School Administrator",
      metadata: {
        studentId: student?.id,
        studentName,
        academicYear: structure?.academicYear,
        term: structure?.term || undefined,
      },
    };
  });

  const normalizedExpenses: NormalizedLedgerEntry[] = rawExpenses.map((e) => {
    const amtDecimal = new Prisma.Decimal(e.amount);
    const dateStr = e.expenseDate instanceof Date ? e.expenseDate.toISOString().split("T")[0] : String(e.expenseDate).split("T")[0];
    const occurredAt = `${dateStr}T00:00:00.000Z`;

    return {
      id: `EXPENSE_${e.id}`,
      sourceId: e.id,
      type: "EXPENSE",
      direction: "OUT",
      occurredAt,
      description: e.description,
      category: e.category,
      amount: amtDecimal.toFixed(2),
      reference: `EXP-${e.id.slice(-6).toUpperCase()}`,
      method: null,
      recordedBy: userMap.get(e.recordedBy) || "School Administrator",
      metadata: {
        expenseDate: dateStr,
      },
    };
  });

  const normalizedBudgetAudits: NormalizedLedgerEntry[] = rawBudgetAudits.map((b) => {
    const newAmtDecimal = new Prisma.Decimal(b.newAmount);
    const prevAmtDecimal = b.previousAmount ? new Prisma.Decimal(b.previousAmount) : null;
    const year = b.budget?.academicYear || "";
    const term = b.budget?.term || "";

    const description = prevAmtDecimal === null
      ? `Initial budget allocation of ₦${newAmtDecimal.toFixed(2)} for ${year} ${term}`.trim()
      : `Budget revised from ₦${prevAmtDecimal.toFixed(2)} to ₦${newAmtDecimal.toFixed(2)} for ${year} ${term}`.trim();

    return {
      id: `BUDGET_${b.id}`,
      sourceId: b.id,
      type: "BUDGET_CHANGE",
      direction: null,
      occurredAt: b.changedAt.toISOString(),
      description,
      category: "Budget Allocation",
      amount: newAmtDecimal.toFixed(2),
      reference: `${year} ${term}`.trim() || null,
      method: null,
      recordedBy: userMap.get(b.changedBy) || "School Administrator",
      metadata: {
        academicYear: year,
        term,
        previousAmount: prevAmtDecimal ? prevAmtDecimal.toFixed(2) : null,
        newAmount: newAmtDecimal.toFixed(2),
      },
    };
  });

  // ---------------------------------------------------------------------------
  // 8. Merge, Sort & Slice
  // ---------------------------------------------------------------------------
  let finalEntries: NormalizedLedgerEntry[] = [];

  if (typeFilter !== "ALL") {
    // Single stream: already sliced and sorted by DB query
    finalEntries = [
      ...normalizedPayments,
      ...normalizedExpenses,
      ...normalizedBudgetAudits,
    ];
  } else {
    // Multi-stream: combine, sort deterministically, and slice window
    const combined = [
      ...normalizedPayments,
      ...normalizedExpenses,
      ...normalizedBudgetAudits,
    ];

    combined.sort((a, b) => {
      const timeA = new Date(a.occurredAt).getTime();
      const timeB = new Date(b.occurredAt).getTime();
      const diff = sortOrder === "asc" ? timeA - timeB : timeB - timeA;
      if (diff !== 0) return diff;
      // Deterministic tie-breaker
      return sortOrder === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
    });

    const offset = (page - 1) * limit;
    finalEntries = combined.slice(offset, offset + limit);
  }

  return {
    data: {
      entries: finalEntries,
      summary: {
        totalInflow: totalInflowDecimal.toFixed(2),
        totalOutflow: totalOutflowDecimal.toFixed(2),
        netCashFlow: netCashFlowDecimal.toFixed(2),
        totalBudgeted: totalBudgetedDecimal.toFixed(2),
        counts: {
          payments: paymentCount,
          expenses: expenseCount,
          budgetChanges: budgetAuditCount,
          total: totalItems,
        },
      },
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    },
  };
}
