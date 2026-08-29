"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";

interface LedgerEntry {
  id: string;
  sourceId: string;
  type: "PAYMENT" | "EXPENSE" | "BUDGET_CHANGE";
  direction: "IN" | "OUT" | null;
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

interface LedgerSummary {
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

interface LedgerPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function FinancialLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>({
    totalInflow: "0.00",
    totalOutflow: "0.00",
    netCashFlow: "0.00",
    totalBudgeted: "0.00",
    counts: { payments: 0, expenses: 0, budgetChanges: 0, total: 0 },
  });
  const [pagination, setPagination] = useState<LedgerPagination>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters State
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PAYMENT" | "EXPENSE" | "BUDGET_CHANGE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Available categories list for filter dropdown
  const defaultCategories = [
    "TUITION",
    "TRANSPORT",
    "FEEDING",
    "UNIFORM",
    "EXAM",
    "MISCELLANEOUS",
    "Maintenance",
    "Supplies",
    "Utilities",
    "Salaries",
    "Budget Allocation",
  ];

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) {
        setError("Authentication required.");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.append("type", typeFilter);
      if (categoryFilter) params.append("category", categoryFilter);
      if (startDateFilter) params.append("startDate", startDateFilter);
      if (endDateFilter) params.append("endDate", endDateFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      params.append("page", String(currentPage));
      params.append("limit", "20");
      params.append("sortOrder", "desc");

      const res = await fetch(`/api/ledger?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load financial ledger");
      }

      setEntries(json.data.entries || []);
      setSummary(
        json.data.summary || {
          totalInflow: "0.00",
          totalOutflow: "0.00",
          netCashFlow: "0.00",
          totalBudgeted: "0.00",
          counts: { payments: 0, expenses: 0, budgetChanges: 0, total: 0 },
        }
      );
      setPagination(
        json.data.pagination || {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }
      );
    } catch (err: any) {
      console.error("Ledger fetch error:", err);
      setError(err.message || "An unexpected error occurred while loading the ledger.");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, categoryFilter, startDateFilter, endDateFilter, searchQuery, currentPage]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const hasActiveFilters = useMemo(() => {
    return typeFilter !== "ALL" || Boolean(categoryFilter) || Boolean(startDateFilter) || Boolean(endDateFilter) || Boolean(searchQuery);
  }, [typeFilter, categoryFilter, startDateFilter, endDateFilter, searchQuery]);

  function handleResetFilters() {
    setTypeFilter("ALL");
    setCategoryFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setSearchQuery("");
    setCurrentPage(1);
  }

  function formatCurrency(val: string | number) {
    const num = typeof val === "number" ? val : parseFloat(val) || 0;
    return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDateTime(isoString: string) {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-NG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Ledger</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <span>Read Only Audit View</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Unified chronological audit trail of all payments, expenses, and budget allocation activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLedger}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <svg className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Inflow */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash Inflow (Payments)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0 6.75-6.75M12 19.5l-6.75-6.75" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-emerald-700 font-mono">
              +{formatCurrency(summary.totalInflow)}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {summary.counts.payments} payments recorded
            </p>
          </div>
        </div>

        {/* Card 2: Outflow */}
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash Outflow (Expenses)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0 6.75 6.75M12 4.5 5.25 11.25" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-rose-700 font-mono">
              -{formatCurrency(summary.totalOutflow)}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {summary.counts.expenses} expenses recorded
            </p>
          </div>
        </div>

        {/* Card 3: Net Cash Balance */}
        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Cash Position</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-extrabold font-mono ${parseFloat(summary.netCashFlow) >= 0 ? "text-blue-700" : "text-amber-700"}`}>
              {formatCurrency(summary.netCashFlow)}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Inflow minus Outflow
            </p>
          </div>
        </div>

        {/* Card 4: Total Budgeted (Active Allocation) */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Budget (Planning)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-amber-700 font-mono">
              {formatCurrency(summary.totalBudgeted)}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {summary.counts.budgetChanges} planning events • Non-Cash
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Type Segmented Filter Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setTypeFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                typeFilter === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Types ({summary.counts.total})
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter("PAYMENT");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                typeFilter === "PAYMENT" ? "bg-white text-emerald-800 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Payments (Inflow)
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter("EXPENSE");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                typeFilter === "EXPENSE" ? "bg-white text-rose-800 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Expenses (Outflow)
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter("BUDGET_CHANGE");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                typeFilter === "BUDGET_CHANGE" ? "bg-white text-purple-800 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Budget Audits
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Search, Category, and Date Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search description, receipt, student..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="">All Categories</option>
              {defaultCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date Picker */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">From Date</label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => {
                setStartDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* End Date Picker */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">To Date</label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => {
                setEndDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700">
          <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="flex-1 text-sm font-medium">{error}</div>
          <button onClick={fetchLedger} className="text-xs font-bold underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">No ledger entries found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? "No financial records matched your active filter criteria."
                : "No financial transactions or budget events have been recorded yet."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Type & Direction</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Reference</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const isPayment = entry.type === "PAYMENT";
                  const isExpense = entry.type === "EXPENSE";
                  const isBudget = entry.type === "BUDGET_CHANGE";

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Type Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isPayment && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0 6.75-6.75M12 19.5l-6.75-6.75" />
                            </svg>
                            <span>+ Money In</span>
                          </span>
                        )}
                        {isExpense && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            <svg className="w-3 h-3 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0 6.75 6.75M12 4.5 5.25 11.25" />
                            </svg>
                            <span>- Money Out</span>
                          </span>
                        )}
                        {isBudget && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
                            <svg className="w-3 h-3 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            <span>~ Budget Audit</span>
                          </span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">
                        {formatDateTime(entry.occurredAt)}
                      </td>

                      {/* Description */}
                      <td className="px-6 py-4 text-xs font-medium text-slate-900 max-w-md">
                        <div>{entry.description}</div>
                        {entry.method && (
                          <div className="text-[10px] text-slate-400 font-normal uppercase tracking-wider mt-0.5">
                            Method: {entry.method.replace("_", " ")}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                          {entry.category}
                        </span>
                      </td>

                      {/* Reference */}
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-600">
                        {entry.reference || "—"}
                      </td>

                      {/* Amount & Direction */}
                      <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm font-bold">
                        {isPayment && (
                          <span className="text-emerald-700">+{formatCurrency(entry.amount)}</span>
                        )}
                        {isExpense && (
                          <span className="text-rose-700">-{formatCurrency(entry.amount)}</span>
                        )}
                        {isBudget && (
                          <span className="text-slate-700">{formatCurrency(entry.amount)}</span>
                        )}
                      </td>

                      {/* Recorded By */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                            {entry.recordedBy.charAt(0).toUpperCase()}
                          </div>
                          <span>{entry.recordedBy}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && entries.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/40">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-semibold text-slate-700">{(pagination.page - 1) * pagination.limit + 1}</span> to{" "}
              <span className="font-semibold text-slate-700">
                {Math.min(pagination.page * pagination.limit, pagination.totalItems)}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{pagination.totalItems}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrevPage}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-slate-700 px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasNextPage}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
