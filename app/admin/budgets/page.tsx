"use client";

import { useEffect, useState } from "react";

type BudgetItem = {
  id: string;
  schoolId: string;
  academicYear: string;
  term: string;
  amount: string; // Serialized 2-decimal string
  createdAt: string;
  updatedAt: string;
};

type AuditLogItem = {
  id: string;
  changedBy: string;
  changedAt: string;
  previousAmount: string | null;
  newAmount: string;
};

const STANDARD_TERMS = ["First Term", "Second Term", "Third Term"];
const STANDARD_YEARS = ["2025/2026", "2026/2027", "2024/2025"];

function formatAmountDisplay(val: string): string {
  if (!val) return "";
  const cleaned = val.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const parts = cleaned.split(".");
  const intPart = parts[0];
  const hasDecimal = parts.length > 1;
  const decPart = hasDecimal ? parts.slice(1).join("").slice(0, 2) : "";

  const formattedInt = intPart ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "0";

  if (hasDecimal) {
    return `${formattedInt}.${decPart}`;
  }
  return formattedInt;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [totalAmount, setTotalAmount] = useState<string>("0.00");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [historyBudget, setHistoryBudget] = useState<BudgetItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditLogItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states
  const [formAcademicYear, setFormAcademicYear] = useState<string>("2025/2026");
  const [formTerm, setFormTerm] = useState<string>("First Term");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("edupulse_token");
      const res = await fetch("/api/budgets", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load school budgets");
      }

      const json = await res.json();
      setBudgets(json.data.budgets || []);
      setTotalAmount(json.data.summary?.totalAmount || "0.00");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while fetching budgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const openCreateModal = () => {
    setFormAcademicYear("2025/2026");
    setFormTerm("First Term");
    setFormAmount("");
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (item: BudgetItem) => {
    setEditingBudget(item);
    setFormAmount(formatAmountDisplay(item.amount));
    setFormError(null);
  };

  const openHistoryDrawer = async (item: BudgetItem) => {
    setHistoryBudget(item);
    setHistoryLogs([]);
    setHistoryError(null);
    setLoadingHistory(true);

    try {
      const token = localStorage.getItem("edupulse_token");
      const res = await fetch(`/api/budgets/${item.id}/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load budget history");
      }

      const json = await res.json();
      setHistoryLogs(json.data.history || []);
    } catch (err: any) {
      setHistoryError(err.message || "Failed to load budget history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const rawAmountStr = formAmount.replace(/,/g, "").trim();
    const numericAmount = parseFloat(rawAmountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError("Please enter a valid positive amount.");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("edupulse_token");

      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          academicYear: formAcademicYear.trim(),
          term: formTerm.trim(),
          amount: numericAmount,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create budget");
      }

      setIsCreateModalOpen(false);
      fetchBudgets();
    } catch (err: any) {
      setFormError(err.message || "An error occurred while creating budget");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget || submitting) return;
    setFormError(null);

    const rawAmountStr = formAmount.replace(/,/g, "").trim();
    const numericAmount = parseFloat(rawAmountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError("Please enter a valid positive amount.");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("edupulse_token");

      const res = await fetch(`/api/budgets/${editingBudget.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: numericAmount,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update budget");
      }

      setEditingBudget(null);
      fetchBudgets();
    } catch (err: any) {
      setFormError(err.message || "An error occurred while updating budget");
    } finally {
      setSubmitting(false);
    }
  };

  const formatNaira = (valStr: string) => {
    const num = parseFloat(valStr) || 0;
    return `₦${num.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDateTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-NG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const getTermBadgeStyle = (term: string) => {
    switch (term) {
      case "First Term":
        return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
      case "Second Term":
        return "bg-sky-50 text-sky-700 border-sky-200/60";
      case "Third Term":
        return "bg-amber-50 text-amber-700 border-amber-200/60";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Budget Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Allocate and track operational budgets per academic session and term with complete history.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Set Term Budget
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Allocated Budget
          </p>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatNaira(totalAmount)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Across all recorded sessions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Budgeted Sessions
          </p>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {Array.from(new Set(budgets.map((b) => b.academicYear))).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Distinct academic years</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Budgeted Terms
          </p>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {budgets.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Active term allocations</p>
        </div>
      </div>

      {/* Main Budget Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 font-semibold text-sm">
            {error}
          </div>
        ) : budgets.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">No budgets allocated yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No budget records found. Click "Set Term Budget" to allocate operational spend limits for an academic session.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Academic Year</th>
                  <th className="px-6 py-4">Term</th>
                  <th className="px-6 py-4">Allocated Budget (₦)</th>
                  <th className="px-6 py-4">Last Updated</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {budgets.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                      {item.academicYear}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${getTermBadgeStyle(item.term)}`}>
                        {item.term}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatNaira(item.amount)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(item.updatedAt)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openHistoryDrawer(item)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          History
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Edit Amount
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Budget Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-xl font-extrabold text-slate-900">
                Set Term Budget
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="mt-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                  {formError}
                </div>
              )}

              {/* Academic Year */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Academic Year
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2025/2026"
                  value={formAcademicYear}
                  onChange={(e) => setFormAcademicYear(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors font-medium"
                />
              </div>

              {/* Term Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Term
                </label>
                <select
                  value={formTerm}
                  onChange={(e) => setFormTerm(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                >
                  {STANDARD_TERMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Input with Live Comma Formatting */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Budget Amount
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-sm">
                    ₦
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 500,000.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(formatAmountDisplay(e.target.value))}
                    className="w-full pl-8 pr-3.5 py-2.5 text-sm font-mono font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Set Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {editingBudget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Update Budget Amount
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingBudget.academicYear} — {editingBudget.term}
                </p>
              </div>
              <button
                onClick={() => setEditingBudget(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateBudget} className="mt-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                  {formError}
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Budget Amount
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-sm">
                    ₦
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 600,000.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(formatAmountDisplay(e.target.value))}
                    className="w-full pl-8 pr-3.5 py-2.5 text-sm font-mono font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBudget(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Update Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget History Drawer */}
      {historyBudget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center md:justify-end p-0 z-50 animate-fadeIn">
          <div className="bg-white max-w-md w-full h-full p-6 md:p-8 shadow-2xl border-l border-slate-100 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Budget History
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                    {historyBudget.academicYear} — {historyBudget.term}
                  </p>
                </div>
                <button
                  onClick={() => setHistoryBudget(null)}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {loadingHistory ? (
                <div className="p-8 space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : historyError ? (
                <div className="p-6 text-center text-rose-500 text-xs font-semibold">
                  {historyError}
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No history records available.
                </div>
              ) : (
                <div className="mt-6 relative pl-6 border-l-2 border-slate-200 space-y-6">
                  {historyLogs.map((log, index) => {
                    const isCreation = log.previousAmount === null;

                    return (
                      <div key={log.id} className="relative group">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                            isCreation ? "bg-indigo-600" : "bg-emerald-600"
                          }`}
                        />

                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800">
                              {isCreation ? "Initial Budget Set" : "Budget Amount Revision"}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              #{index + 1}
                            </span>
                          </div>

                          <div className="text-sm font-mono font-bold text-slate-900">
                            {isCreation ? (
                              <span className="text-indigo-600">{formatNaira(log.newAmount)}</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 line-through text-xs font-normal">
                                  {formatNaira(log.previousAmount || "0")}
                                </span>
                                <span>→</span>
                                <span className="text-emerald-600">{formatNaira(log.newAmount)}</span>
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-medium text-slate-700">By {log.changedBy}</span>
                            <span>{formatDateTime(log.changedAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-slate-100">
              <button
                onClick={() => setHistoryBudget(null)}
                className="w-full py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
