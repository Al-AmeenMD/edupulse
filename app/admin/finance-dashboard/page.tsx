"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

// Currency formatters for Nigerian Naira (₦)
function formatAmount(amount: number | string): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount) || 0;
  return num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNaira(amount: number | string): string {
  return `₦${formatAmount(amount)}`;
}

export default function FinanceDashboardPage() {
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchSummaryData() {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/fees/dashboard-summary", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to load finance summary");
      }

      setData(resJson.data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading dashboard metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSummaryData();
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
          onClick={fetchSummaryData}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
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
            className="text-red-500 hover:text-red-700 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 5 Stat Cards Grid */}
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

      {/* Two Column Section for Recent Payments and Overdue Fees */}
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
                        <td className="px-6 py-3.5 font-semibold text-emerald-600 text-xs font-mono">
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
                        <td className="px-6 py-3.5 text-slate-600 text-xs font-mono">
                          {formatNaira(fee.amountDue)}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-rose-600 text-xs font-mono">
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
