"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/formatters";

interface SchoolSummary {
  id: string;
  name: string;
  code: string;
  city: string | null;
  state: string | null;
  status: string;
  schoolAdminCount: number;
  totalStudents: number;
  totalRevenueCollected: number;
  totalOutstandingBalance: number;
  totalExpensesIncurred?: number;
  netOperatingPosition?: number;
  attendanceRate: number;
}

interface PortfolioData {
  totalSchools: number;
  totalStudents: number;
  totalRevenueCollected: number;
  totalOutstandingBalance: number;
  totalExpensesIncurred?: number;
  netOperatingPosition?: number;
  overallAttendanceRate: number;
  schools: SchoolSummary[];
}

export default function ProprietorDashboardPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        setLoading(true);
        const token = localStorage.getItem("edupulse_token");
        const res = await fetch("/api/proprietor/portfolio-summary", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load portfolio summary");
        }

        const resData = await res.json();
        setData(resData);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolio();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-28 bg-slate-200 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-64 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
        <h3 className="font-bold text-lg mb-1">Portfolio Summary Error</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Portfolio Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          High-level executive metrics across your governed school institutions.
        </p>
      </div>

      {/* Aggregated KPI Cards (6 Approved Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider truncate">Governed Schools</span>
            <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.5M4.5 21V10.5" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate" title={String(data.totalSchools)}>{data.totalSchools}</p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">Institutions owned</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider truncate">Enrollment</span>
            <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate" title={String(data.totalStudents)}>{data.totalStudents}</p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">Active students</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider truncate">Revenue</span>
            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-6h6m-9 6.75A9.75 9.75 0 1 0 12 2.25a9.75 9.75 0 0 0-9.75 9.75Z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-2xl 2xl:text-lg font-extrabold text-slate-900 tracking-tight break-normal leading-tight" title={formatNaira(data.totalRevenueCollected)}>{formatNaira(data.totalRevenueCollected)}</p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">Total payments</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider truncate">Expenses</span>
            <div className="p-1.5 rounded-xl bg-rose-50 text-rose-600 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m3-6H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-2xl 2xl:text-lg font-extrabold text-slate-900 tracking-tight break-normal leading-tight" title={formatNaira(data.totalExpensesIncurred || 0)}>{formatNaira(data.totalExpensesIncurred || 0)}</p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">Total expenses</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider truncate">Net Position</span>
            <div className={`p-1.5 rounded-xl shrink-0 ${(data.netOperatingPosition || 0) >= 0 ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 0 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
            </div>
          </div>
          <div>
            <p className={`text-xl sm:text-2xl 2xl:text-lg font-extrabold tracking-tight break-normal leading-tight ${(data.netOperatingPosition || 0) >= 0 ? 'text-slate-900' : 'text-rose-600'}`} title={formatNaira(data.netOperatingPosition || 0)}>
              {formatNaira(data.netOperatingPosition || 0)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">Revenue − Expenses</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs min-w-0 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider truncate">Attendance Rate</span>
            <div className="p-1.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate" title={`${data.overallAttendanceRate}%`}>{data.overallAttendanceRate}%</p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">Weighted rate</p>
          </div>
        </div>
      </div>

      {/* School Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Schools Portfolio</h2>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {data.schools.length} {data.schools.length === 1 ? "School" : "Schools"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.schools.map((school) => (
            <div
              key={school.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between min-w-0 overflow-hidden"
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block truncate">
                      Code: {school.code}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug truncate" title={school.name}>{school.name}</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 capitalize shrink-0">
                    {school.status.toLowerCase()}
                  </span>
                </div>

                {(school.city || school.state) && (
                  <p className="text-xs text-slate-500 mb-4 flex items-center gap-1 min-w-0 truncate" title={[school.city, school.state].filter(Boolean).join(", ")}>
                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                    <span className="truncate">{[school.city, school.state].filter(Boolean).join(", ")}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 my-4 text-xs">
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-medium truncate">Students</span>
                    <span className="font-bold text-slate-800 text-sm truncate block" title={String(school.totalStudents)}>{school.totalStudents}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-medium truncate">School Admins</span>
                    <span className="font-bold text-slate-800 text-sm truncate block" title={String(school.schoolAdminCount)}>{school.schoolAdminCount}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-medium truncate">Revenue</span>
                    <span className="font-bold text-emerald-600 text-sm lg:text-xs xl:text-[13px] 2xl:text-sm block break-normal leading-tight" title={formatNaira(school.totalRevenueCollected)}>{formatNaira(school.totalRevenueCollected)}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-medium truncate">Expenses</span>
                    <span className="font-bold text-rose-600 text-sm lg:text-xs xl:text-[13px] 2xl:text-sm block break-normal leading-tight" title={formatNaira(school.totalExpensesIncurred || 0)}>{formatNaira(school.totalExpensesIncurred || 0)}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-medium truncate">Net Position</span>
                    <span className={`font-bold text-sm lg:text-xs xl:text-[13px] 2xl:text-sm block break-normal leading-tight ${(school.netOperatingPosition || 0) >= 0 ? 'text-slate-800' : 'text-rose-600'}`} title={formatNaira(school.netOperatingPosition || 0)}>
                      {formatNaira(school.netOperatingPosition || 0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-medium truncate">Attendance</span>
                    <span className="font-bold text-indigo-600 text-sm truncate block" title={`${school.attendanceRate}%`}>{school.attendanceRate}%</span>
                  </div>
                </div>
              </div>

              <Link
                href={`/proprietor/schools/${school.id}`}
                className="mt-2 w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl text-center transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Govern & Manage School</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

