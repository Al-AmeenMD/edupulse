"use client";

import { useEffect, useState, useMemo } from "react";
import { formatNaira } from "@/lib/formatters";

type ExpenseItem = {
  id: string;
  schoolId: string;
  category: string;
  amount: string; // 2 decimal places string
  description: string;
  expenseDate: string; // YYYY-MM-DD
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
};

const STANDARD_CATEGORIES = [
  "Staff Salaries",
  "Utilities",
  "Maintenance",
  "Supplies",
  "Other",
];

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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [totalAmount, setTotalAmount] = useState<string>("0.00");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<ExpenseItem | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states
  const [formCategory, setFormCategory] = useState<string>("Staff Salaries");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formExpenseDate, setFormExpenseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [formDescription, setFormDescription] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      (selectedCategory && selectedCategory !== "ALL") ||
      startDateFilter ||
      endDateFilter
  );

  const fetchExpenses = async (overrideParams?: {
    search?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const cat =
        overrideParams?.category !== undefined
          ? overrideParams.category
          : selectedCategory;
      const search =
        overrideParams?.search !== undefined
          ? overrideParams.search
          : searchQuery;
      const start =
        overrideParams?.startDate !== undefined
          ? overrideParams.startDate
          : startDateFilter;
      const end =
        overrideParams?.endDate !== undefined
          ? overrideParams.endDate
          : endDateFilter;

      const params = new URLSearchParams();
      if (cat && cat !== "ALL") {
        params.set("category", cat);
      }
      if (search.trim()) {
        params.set("search", search.trim());
      }
      if (start) {
        params.set("startDate", start);
      }
      if (end) {
        params.set("endDate", end);
      }

      const token = localStorage.getItem("edupulse_token");
      const res = await fetch(`/api/expenses?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load expenses");
      }

      const json = await res.json();
      setExpenses(json.data.expenses || []);
      setTotalAmount(json.data.summary?.totalAmount || "0.00");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while fetching expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedCategory, startDateFilter, endDateFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExpenses();
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("ALL");
    setStartDateFilter("");
    setEndDateFilter("");
    fetchExpenses({ search: "", category: "ALL", startDate: "", endDate: "" });
  };

  // Unique category list for dropdown
  const availableCategories = useMemo(() => {
    const set = new Set(STANDARD_CATEGORIES);
    expenses.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [expenses]);

  // Statistics calculation
  const stats = useMemo(() => {
    const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    let thisMonthSum = 0;
    const categoryTotals: Record<string, number> = {};

    expenses.forEach((item) => {
      const amt = parseFloat(item.amount) || 0;
      if (item.expenseDate.startsWith(currentMonthStr)) {
        thisMonthSum += amt;
      }
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + amt;
    });

    let topCategory = "N/A";
    let maxCategoryAmt = 0;

    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > maxCategoryAmt) {
        maxCategoryAmt = amt;
        topCategory = cat;
      }
    });

    return {
      totalCount: expenses.length,
      totalAmount: totalAmount,
      thisMonthAmount: thisMonthSum.toFixed(2),
      topCategory,
    };
  }, [expenses, totalAmount]);

  const openCreateModal = () => {
    setEditingExpense(null);
    setFormCategory("Staff Salaries");
    setCustomCategory("");
    setFormAmount("");
    setFormExpenseDate(new Date().toISOString().split("T")[0]);
    setFormDescription("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: ExpenseItem) => {
    setEditingExpense(item);
    if (STANDARD_CATEGORIES.includes(item.category)) {
      setFormCategory(item.category);
      setCustomCategory("");
    } else {
      setFormCategory("CUSTOM");
      setCustomCategory(item.category);
    }
    setFormAmount(formatAmountDisplay(item.amount));
    setFormExpenseDate(item.expenseDate);
    setFormDescription(item.description);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const finalCategory =
      formCategory === "CUSTOM" ? customCategory.trim() : formCategory.trim();

    if (!finalCategory) {
      setFormError("Please select or enter a valid category.");
      return;
    }

    const rawAmountStr = formAmount.replace(/,/g, "").trim();
    const numericAmount = parseFloat(rawAmountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError("Please enter a valid positive amount.");
      return;
    }

    if (!formDescription.trim()) {
      setFormError("Please enter a description for the expense.");
      return;
    }

    if (!formExpenseDate) {
      setFormError("Please select the date of expense.");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("edupulse_token");

      const payload = {
        category: finalCategory,
        amount: numericAmount,
        description: formDescription.trim(),
        expenseDate: formExpenseDate,
      };

      const url = editingExpense
        ? `/api/expenses/${editingExpense.id}`
        : "/api/expenses";
      const method = editingExpense ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save expense");
      }

      setIsModalOpen(false);
      fetchExpenses();
    } catch (err: any) {
      setFormError(err.message || "An error occurred while saving");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!isDeleting) return;

    try {
      setSubmitting(true);
      const token = localStorage.getItem("edupulse_token");

      const res = await fetch(`/api/expenses/${isDeleting.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete expense");
      }

      setIsDeleting(null);
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || "An error occurred while deleting expense");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "Staff Salaries":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "Utilities":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "Maintenance":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Supplies":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <svg
                className="w-6 h-6 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Expense Management
            </h1>
          </div>
          <p className="text-slate-300 text-sm mt-2 max-w-xl">
            Record, track, and categorize school expenditures including staff salaries, utilities, supplies, and maintenance.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl shadow-lg hover:shadow-amber-500/25 transition-all duration-200 shrink-0 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Record Expense</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Expenditures
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {formatNaira(stats.totalAmount)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Cumulative recorded money out</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            This Month's Spend
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-600">
              {formatNaira(stats.thisMonthAmount)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Current calendar month total</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Top Expense Category
          </span>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-800 truncate block">
              {stats.topCategory}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Highest spend area</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recorded Transactions
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {stats.totalCount}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Active non-deleted records</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-center">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <svg
              className="w-4 h-4 absolute left-3.5 top-3 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by description or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-52 py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
          >
            <option value="ALL">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Start Date */}
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="w-full md:w-40 py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors text-slate-600"
            title="Start Date"
          />

          {/* End Date */}
          <input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="w-full md:w-40 py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors text-slate-600"
            title="End Date"
          />

          {/* Filter Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
            >
              Filter
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Reset Filters
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main Expense Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 font-semibold text-sm">
            {error}
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {hasActiveFilters ? "No matching expenses found" : "No expenses recorded"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? "No expense records match your active filters. Try clearing your search or date range."
                : 'No expense records found. Click "Record Expense" to log outgoing operational costs.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Expense Date</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Amount (₦)</th>
                  <th className="px-6 py-4">Recorded By</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {expenses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {item.expenseDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full border ${getCategoryBadgeClass(
                          item.category
                        )}`}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-800 font-medium max-w-md truncate">
                      {item.description}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      {formatNaira(item.amount)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-mono">
                        {item.recordedBy}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setIsDeleting(item)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Delete
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

      {/* Record / Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-xl font-extrabold text-slate-900">
                {editingExpense ? "Edit Expense Record" : "Record New Expense"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                  {formError}
                </div>
              )}

              {/* Category Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                >
                  {STANDARD_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Add Custom Category...</option>
                </select>
              </div>

              {/* Custom Category Input if selected */}
              {formCategory === "CUSTOM" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Custom Category Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Exam Portal Hosting"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  />
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Amount
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-sm">
                    ₦
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 250,000.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(formatAmountDisplay(e.target.value))}
                    className="w-full pl-8 pr-3.5 py-2.5 text-sm font-mono font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              {/* Expense Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Expense Date
                </label>
                <input
                  type="date"
                  value={formExpenseDate}
                  onChange={(e) => setFormExpenseDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors text-slate-700"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide details about this expense..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingExpense ? "Update Expense" : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Delete Expense</h3>
            <p className="text-xs text-slate-500 mt-2">
              Are you sure you want to delete the expense{" "}
              <strong className="text-slate-800">"{isDeleting.description}"</strong> ({formatNaira(isDeleting.amount)})?
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setIsDeleting(null)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteExpense}
                disabled={submitting}
                className="px-5 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Delete Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
