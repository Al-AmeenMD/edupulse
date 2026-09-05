"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAmount, formatNaira } from "@/lib/formatters";

interface DashboardStats {
  totalFeesAssigned: string;
  totalCollected: string;
  totalOutstanding: string;
  overdueCount: number;
  waivedCount: number;
}

interface RecentPaymentItem {
  id: string;
  receiptNumber: string;
  amount: number | string;
  method: string;
  reference?: string | null;
  paidAt: string;
  fee: {
    student: {
      id: string;
      studentId: string;
      firstName: string;
      lastName: string;
    };
    feeStructure: {
      id: string;
      name: string;
      type: string;
    };
  };
}

interface OverdueFeeItem {
  id: string;
  amountDue: number | string;
  amountPaid: number | string;
  status: string;
  dueDate: string;
  student: {
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
  };
  feeStructure: {
    id: string;
    name: string;
    type: string;
    amount: number | string;
  };
}

interface DashboardSummaryData {
  stats: DashboardStats;
  recentPayments: RecentPaymentItem[];
  overdueFees: OverdueFeeItem[];
}

interface FeeTypeBreakdownItem {
  type: string;
  label: string;
  totalAssigned: string;
  totalCollected: string;
  totalOutstanding: string;
  collectionRate: string;
  feeCount: number;
  paymentCount: number;
}

interface AcademicYearBreakdownItem {
  academicYear: string;
  totalAssigned: string;
  totalCollected: string;
  totalOutstanding: string;
  collectionRate: string;
  feeCount: number;
  paymentCount: number;
}

interface TermBreakdownItem {
  term: string;
  totalAssigned: string;
  totalCollected: string;
  totalOutstanding: string;
  collectionRate: string;
  feeCount: number;
  paymentCount: number;
}

interface MonthBreakdownItem {
  month: string;
  monthLabel: string;
  totalCollected: string;
  paymentCount: number;
}

interface BreakdownData {
  byFeeType: FeeTypeBreakdownItem[];
  byAcademicYear: AcademicYearBreakdownItem[];
  byTerm: TermBreakdownItem[];
  byMonth: MonthBreakdownItem[];
}



export default function FinanceDashboardPage() {
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [breakdownData, setBreakdownData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<
    "feeType" | "academicYear" | "term" | "month"
  >("feeType");

  async function fetchDashboardData() {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const [summaryRes, breakdownsRes] = await Promise.all([
        fetch("/api/fees/dashboard-summary", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/fees/reports/breakdowns", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const summaryJson = await summaryRes.json();
      if (!summaryRes.ok) {
        throw new Error(summaryJson.error || "Failed to load finance summary");
      }
      setData(summaryJson.data);

      const breakdownsJson = await breakdownsRes.json();
      if (!breakdownsRes.ok) {
        throw new Error(breakdownsJson.error || "Failed to load reporting breakdowns");
      }
      setBreakdownData(breakdownsJson.data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading dashboard metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const stats = data?.stats;
  const recentPayments = data?.recentPayments || [];
  const overdueFees = data?.overdueFees || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Finance & Revenue Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time financial analytics, fee collections, and ledger summary.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 text-slate-500 ${loading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-500 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 5 Stat Cards Grid (Preserved from FINANCE-006) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Total Fees Assigned */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Assigned
              </p>
              {loading ? (
                <div className="h-7 w-20 bg-slate-200 animate-pulse rounded-md mt-2"></div>
              ) : (
                <p className="text-xl font-bold text-slate-900 mt-1 truncate">
                  {formatNaira(stats?.totalFeesAssigned || "0")}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5a1.5 1.5 0 0 1 1.5 1.5v9.75a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Zm13.5 3h.008v.008h-.008V7.5Zm0 3h.008v.008h-.008v-.008Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Total Collected
              </p>
              {loading ? (
                <div className="h-7 w-20 bg-slate-200 animate-pulse rounded-md mt-2"></div>
              ) : (
                <p className="text-xl font-bold text-emerald-600 mt-1 truncate">
                  {formatNaira(stats?.totalCollected || "0")}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Total Outstanding
              </p>
              {loading ? (
                <div className="h-7 w-20 bg-slate-200 animate-pulse rounded-md mt-2"></div>
              ) : (
                <p className="text-xl font-bold text-amber-600 mt-1 truncate">
                  {formatNaira(stats?.totalOutstanding || "0")}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Overdue Fees Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                Overdue Fees
              </p>
              {loading ? (
                <div className="h-7 w-12 bg-slate-200 animate-pulse rounded-md mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-rose-600 mt-1">
                  {stats?.overdueCount ?? 0}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Waived Fees Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                Waived Fees
              </p>
              {loading ? (
                <div className="h-7 w-12 bg-slate-200 animate-pulse rounded-md mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {stats?.waivedCount ?? 0}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* REPORTING BREAKDOWNS SECTION (NEW: Phase 1, Group 2)               */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Card Header & Segmented Tab Navigation */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Revenue & Collections Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Financial performance segmented by fee category, academic period, and cash flow timing.
            </p>
          </div>

          {/* Segmented Tab Controls */}
          <div className="inline-flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 self-start md:self-auto">
            <button
              onClick={() => setActiveBreakdownTab("feeType")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeBreakdownTab === "feeType"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              By Fee Type
            </button>
            <button
              onClick={() => setActiveBreakdownTab("academicYear")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeBreakdownTab === "academicYear"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              By Session
            </button>
            <button
              onClick={() => setActiveBreakdownTab("term")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeBreakdownTab === "term"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              By Term
            </button>
            <button
              onClick={() => setActiveBreakdownTab("month")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeBreakdownTab === "month"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly Trends
            </button>
          </div>
        </div>

        {/* Tab 1: By Fee Type */}
        {activeBreakdownTab === "feeType" && (
          <div>
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !breakdownData?.byFeeType || breakdownData.byFeeType.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                No fee type data available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Fee Type</th>
                      <th className="px-6 py-3.5">Assigned (₦)</th>
                      <th className="px-6 py-3.5">Collected (₦)</th>
                      <th className="px-6 py-3.5">Collection Rate</th>
                      <th className="px-6 py-3.5">Outstanding (₦)</th>
                      <th className="px-6 py-3.5 text-right">Assigned / Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {breakdownData.byFeeType.map((item) => {
                      const rateNum = parseFloat(item.collectionRate) || 0;
                      return (
                        <tr key={item.type} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3.5 font-semibold text-slate-900 flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                            <span>{item.label}</span>
                          </td>
                          <td className="px-6 py-3.5 text-slate-700 text-xs font-semibold tabular-nums">
                            {formatNaira(item.totalAssigned)}
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-emerald-600 text-xs tabular-nums">
                            {formatNaira(item.totalCollected)}
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden shrink-0">
                                <div
                                  className={`h-2 rounded-full ${
                                    rateNum >= 75
                                      ? "bg-emerald-500"
                                      : rateNum >= 40
                                      ? "bg-amber-500"
                                      : "bg-slate-400"
                                  }`}
                                  style={{ width: `${Math.min(100, rateNum)}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                {item.collectionRate}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-amber-600 text-xs tabular-nums">
                            {formatNaira(item.totalOutstanding)}
                          </td>
                          <td className="px-6 py-3.5 text-right text-xs text-slate-500 font-medium">
                            {item.feeCount} fees &middot; {item.paymentCount} payments
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: By Academic Session / Year */}
        {activeBreakdownTab === "academicYear" && (
          <div>
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !breakdownData?.byAcademicYear || breakdownData.byAcademicYear.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                No session data available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Academic Session / Year</th>
                      <th className="px-6 py-3.5">Assigned (₦)</th>
                      <th className="px-6 py-3.5">Collected (₦)</th>
                      <th className="px-6 py-3.5">Collection Rate</th>
                      <th className="px-6 py-3.5">Outstanding (₦)</th>
                      <th className="px-6 py-3.5 text-right">Transactions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {breakdownData.byAcademicYear.map((item) => {
                      const rateNum = parseFloat(item.collectionRate) || 0;
                      return (
                        <tr key={item.academicYear} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-900">
                            {item.academicYear}
                          </td>
                          <td className="px-6 py-3.5 text-slate-700 text-xs font-semibold tabular-nums">
                            {formatNaira(item.totalAssigned)}
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-emerald-600 text-xs tabular-nums">
                            {formatNaira(item.totalCollected)}
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden shrink-0">
                                <div
                                  className={`h-2 rounded-full ${
                                    rateNum >= 75
                                      ? "bg-emerald-500"
                                      : rateNum >= 40
                                      ? "bg-amber-500"
                                      : "bg-slate-400"
                                  }`}
                                  style={{ width: `${Math.min(100, rateNum)}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                {item.collectionRate}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-amber-600 text-xs tabular-nums">
                            {formatNaira(item.totalOutstanding)}
                          </td>
                          <td className="px-6 py-3.5 text-right text-xs text-slate-500 font-medium">
                            {item.feeCount} fees &middot; {item.paymentCount} payments
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: By Term */}
        {activeBreakdownTab === "term" && (
          <div>
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !breakdownData?.byTerm || breakdownData.byTerm.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                No term data available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Term</th>
                      <th className="px-6 py-3.5">Assigned (₦)</th>
                      <th className="px-6 py-3.5">Collected (₦)</th>
                      <th className="px-6 py-3.5">Collection Rate</th>
                      <th className="px-6 py-3.5">Outstanding (₦)</th>
                      <th className="px-6 py-3.5 text-right">Transactions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {breakdownData.byTerm.map((item) => {
                      const rateNum = parseFloat(item.collectionRate) || 0;
                      return (
                        <tr key={item.term} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-900">
                            {item.term}
                          </td>
                          <td className="px-6 py-3.5 text-slate-700 text-xs font-semibold tabular-nums">
                            {formatNaira(item.totalAssigned)}
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-emerald-600 text-xs tabular-nums">
                            {formatNaira(item.totalCollected)}
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden shrink-0">
                                <div
                                  className={`h-2 rounded-full ${
                                    rateNum >= 75
                                      ? "bg-emerald-500"
                                      : rateNum >= 40
                                      ? "bg-amber-500"
                                      : "bg-slate-400"
                                  }`}
                                  style={{ width: `${Math.min(100, rateNum)}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                {item.collectionRate}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-amber-600 text-xs tabular-nums">
                            {formatNaira(item.totalOutstanding)}
                          </td>
                          <td className="px-6 py-3.5 text-right text-xs text-slate-500 font-medium">
                            {item.feeCount} fees &middot; {item.paymentCount} payments
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Monthly Trends */}
        {activeBreakdownTab === "month" && (
          <div>
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !breakdownData?.byMonth || breakdownData.byMonth.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                No monthly payment records available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Calendar Month</th>
                      <th className="px-6 py-3.5">Total Cash Collected (₦)</th>
                      <th className="px-6 py-3.5 text-right">Payment Transactions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {breakdownData.byMonth.map((item) => (
                      <tr key={item.month} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                          </svg>
                          <span>{item.monthLabel}</span>
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-emerald-600 text-sm tabular-nums">
                          {formatNaira(item.totalCollected)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-xs text-slate-600 font-medium">
                          {item.paymentCount} {item.paymentCount === 1 ? "receipt" : "receipts"} recorded
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two Column Section for Recent Payments and Overdue Fees (Preserved from FINANCE-006) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Payments Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Payments</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Last 10 payment receipts recorded across the school
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : recentPayments.length === 0 ? (
            <div className="p-10 text-center flex-1 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5a1.5 1.5 0 0 1 1.5 1.5v9.75a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Zm13.5 3h.008v.008h-.008V7.5Zm0 3h.008v.008h-.008v-.008Z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-800">No recent payments</p>
              <p className="text-xs text-slate-500 mt-1">No payments have been recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Student</th>
                    <th className="px-6 py-3.5">Fee Name</th>
                    <th className="px-6 py-3.5">Amount (₦)</th>
                    <th className="px-6 py-3.5">Method</th>
                    <th className="px-6 py-3.5 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recentPayments.map((pmt) => {
                    const studentName = pmt.fee?.student
                      ? `${pmt.fee.student.firstName} ${pmt.fee.student.lastName}`
                      : "Unknown Student";
                    const feeName = pmt.fee?.feeStructure?.name || "Fee Payment";
                    const methodLabel =
                      pmt.method === "bank_transfer"
                        ? "Bank Transfer"
                        : pmt.method === "card"
                        ? "Card"
                        : "Cash";

                    return (
                      <tr key={pmt.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          {studentName}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600 text-xs">
                          {feeName}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-emerald-600 text-xs tabular-nums">
                          {formatNaira(pmt.amount)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                            {methodLabel}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right text-xs text-slate-500">
                          {new Date(pmt.paidAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Overdue Fees Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Overdue Fees</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Top overdue fees sorted by earliest due date
              </p>
            </div>
            <Link
              href="/admin/fees"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Manage Fees &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : overdueFees.length === 0 ? (
            <div className="p-10 text-center flex-1 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-800">No overdue fees!</p>
              <p className="text-xs text-slate-500 mt-1">All student fee payments are up to date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Student</th>
                    <th className="px-6 py-3.5">Fee Name</th>
                    <th className="px-6 py-3.5">Due (₦)</th>
                    <th className="px-6 py-3.5">Outstanding (₦)</th>
                    <th className="px-6 py-3.5 text-right">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {overdueFees.map((fee) => {
                    const studentName = fee.student
                      ? `${fee.student.firstName} ${fee.student.lastName}`
                      : "Unknown Student";
                    const feeName = fee.feeStructure?.name || "Fee";
                    const dueNum = typeof fee.amountDue === "number" ? fee.amountDue : parseFloat(String(fee.amountDue)) || 0;
                    const paidNum = typeof fee.amountPaid === "number" ? fee.amountPaid : parseFloat(String(fee.amountPaid)) || 0;
                    const outstanding = Math.max(0, dueNum - paidNum);

                    return (
                      <tr key={fee.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          {studentName}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600 text-xs">
                          {feeName}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600 text-xs font-semibold tabular-nums">
                          {formatNaira(fee.amountDue)}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-rose-600 text-xs tabular-nums">
                          {formatNaira(outstanding)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-xs font-medium text-rose-700">
                          {new Date(fee.dueDate).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
