"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface ClassOption {
  id: string;
  name: string;
  level?: string | null;
}

interface ClassSummaryItem {
  classId: string;
  className: string;
  level?: string | null;
  enrolledStudents: number;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

interface SchoolOverviewResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  schoolOverview: {
    totalStudents: number;
    totalDays: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    overallAttendanceRate: number;
  };
  classes: ClassSummaryItem[];
}

interface StudentSummaryItem {
  studentId: string;
  code?: string;
  firstName: string;
  lastName: string;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

interface SingleClassResponse {
  classId: string;
  className?: string;
  level?: string | null;
  period: {
    startDate: string;
    endDate: string;
  };
  students: StudentSummaryItem[];
}

function getCurrentAcademicYear(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed, 8 = September
  return month >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export default function AdminAttendancePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return searchParams.get("classId") || "ALL";
  });

  // Filter mode state
  const [filterMode, setFilterMode] = useState<"MONTHLY" | "TERMLY" | "CUSTOM">("MONTHLY");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(() => getCurrentAcademicYear());
  const [selectedTerm, setSelectedTerm] = useState("First Term");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState("");

  const [schoolData, setSchoolData] = useState<SchoolOverviewResponse | null>(null);
  const [singleClassData, setSingleClassData] = useState<SingleClassResponse | null>(null);

  const resolvedSummaryDates = useMemo(() => {
    if (filterMode === "MONTHLY") {
      if (!selectedMonth) return { startDate: "", endDate: "" };
      const [yStr, mStr] = selectedMonth.split("-");
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10);
      if (isNaN(year) || isNaN(month)) return { startDate: "", endDate: "" };

      const startDate = `${yStr}-${mStr.padStart(2, "0")}-01`;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const endDate = `${yStr}-${mStr.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { startDate, endDate };
    }

    if (filterMode === "TERMLY") {
      const startYearNum = parseInt(selectedYear.split("/")[0], 10) || new Date().getFullYear();
      const endYearNum = startYearNum + 1;

      if (selectedTerm === "First Term" || selectedTerm === "Term 1") {
        return {
          startDate: `${startYearNum}-09-01`,
          endDate: `${startYearNum}-12-31`,
        };
      }
      if (selectedTerm === "Second Term" || selectedTerm === "Term 2") {
        return {
          startDate: `${endYearNum}-01-01`,
          endDate: `${endYearNum}-04-30`,
        };
      }
      return {
        startDate: `${endYearNum}-05-01`,
        endDate: `${endYearNum}-08-31`,
      };
    }

    return {
      startDate: customStartDate,
      endDate: customEndDate,
    };
  }, [filterMode, selectedMonth, selectedYear, selectedTerm, customStartDate, customEndDate]);

  // 1. Fetch all classes on mount for class selector
  useEffect(() => {
    async function fetchClasses() {
      try {
        setLoadingClasses(true);
        const token = localStorage.getItem("edupulse_token");
        if (!token) return;

        const res = await fetch("/api/classes", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to fetch classes");
        const json = await res.json();
        setClassList(json.data || []);
      } catch (err: any) {
        setError(err.message || "Failed to load classes");
      } finally {
        setLoadingClasses(false);
      }
    }

    fetchClasses();
  }, []);

  // 2. Fetch attendance summary based on selectedClassId and resolvedSummaryDates
  useEffect(() => {
    async function loadSummary() {
      const { startDate, endDate } = resolvedSummaryDates;
      if (!startDate || !endDate) return;

      try {
        setLoadingSummary(true);
        setError("");
        const token = localStorage.getItem("edupulse_token");
        if (!token) return;

        if (selectedClassId === "ALL") {
          const url = `/api/attendance/summary?startDate=${startDate}&endDate=${endDate}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const errJson = await res.json();
            throw new Error(errJson.error || "Failed to fetch school attendance summary");
          }

          const json = await res.json();
          setSchoolData(json.data || null);
          setSingleClassData(null);
        } else {
          const url = `/api/attendance/summary?classId=${selectedClassId}&startDate=${startDate}&endDate=${endDate}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const errJson = await res.json();
            throw new Error(errJson.error || "Failed to fetch class attendance summary");
          }

          const json = await res.json();
          setSingleClassData(json.data || null);
          setSchoolData(null);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while loading attendance summary");
      } finally {
        setLoadingSummary(false);
      }
    }

    loadSummary();
  }, [selectedClassId, resolvedSummaryDates]);

  function handleClassSelectChange(newClassId: string) {
    setSelectedClassId(newClassId);
    if (newClassId === "ALL") {
      router.push("/admin/attendance");
    } else {
      router.push(`/admin/attendance?classId=${newClassId}`);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            School Attendance Summary
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Read-only overview of attendance rates and metrics across all classes in your school.
          </p>
        </div>

        {/* Class Selection Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            View Scope:
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => handleClassSelectChange(e.target.value)}
            disabled={loadingClasses}
            className="px-3 py-2 text-sm font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none cursor-pointer shadow-xs min-w-[220px]"
          >
            <option value="ALL">All Classes (School Overview)</option>
            {classList.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} {cls.level ? `(${cls.level})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Filtering Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold self-start">
            <button
              type="button"
              onClick={() => setFilterMode("MONTHLY")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === "MONTHLY"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("TERMLY")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === "TERMLY"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Termly
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("CUSTOM")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === "CUSTOM"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Range
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Range: <span className="font-semibold text-slate-800">{resolvedSummaryDates.startDate}</span> to{" "}
            <span className="font-semibold text-slate-800">{resolvedSummaryDates.endDate}</span>
          </div>
        </div>

        {/* Dynamic Period Selectors */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4">
          {filterMode === "MONTHLY" && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Select Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-xl bg-slate-50 focus:bg-white outline-none"
              />
            </div>
          )}

          {filterMode === "TERMLY" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">Academic Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-xl bg-slate-50 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027/2028">2027/2028</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">Term:</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-xl bg-slate-50 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="First Term">First Term (Sep - Dec)</option>
                  <option value="Second Term">Second Term (Jan - Apr)</option>
                  <option value="Third Term">Third Term (May - Aug)</option>
                </select>
              </div>
            </>
          )}

          {filterMode === "CUSTOM" && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">From:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-xl bg-slate-50 focus:bg-white outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">To:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-xl bg-slate-50 focus:bg-white outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-700">Dismiss</button>
        </div>
      )}

      {/* Loading Indicator */}
      {loadingSummary && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium text-slate-500">Calculating attendance summary statistics...</p>
        </div>
      )}

      {/* VIEW MODE A: School-Wide Consolidated Overview (When selectedClassId === "ALL") */}
      {!loadingSummary && selectedClassId === "ALL" && schoolData && (
        <div className="space-y-6">
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Overall Attendance Rate
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {schoolData.schoolOverview.overallAttendanceRate}%
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    schoolData.schoolOverview.overallAttendanceRate >= 90
                      ? "bg-emerald-100 text-emerald-800"
                      : schoolData.schoolOverview.overallAttendanceRate >= 75
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {schoolData.schoolOverview.overallAttendanceRate >= 90
                    ? "Excellent"
                    : schoolData.schoolOverview.overallAttendanceRate >= 75
                    ? "Moderate"
                    : "Low"}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Enrolled Students
              </span>
              <div className="pt-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {schoolData.schoolOverview.totalStudents}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">Across {schoolData.classes.length} active classes</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Attended Days (Pres / Late)
              </span>
              <div className="pt-1">
                <span className="text-3xl font-extrabold text-emerald-600">
                  {schoolData.schoolOverview.present + schoolData.schoolOverview.late}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {schoolData.schoolOverview.present} Present, {schoolData.schoolOverview.late} Late
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Absences Recorded
              </span>
              <div className="pt-1">
                <span className="text-3xl font-extrabold text-rose-600">
                  {schoolData.schoolOverview.absent}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {schoolData.schoolOverview.excused} Excused
                </p>
              </div>
            </div>
          </div>

          {/* Per-Class Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Per-Class Summary Breakdown</h3>
                <p className="text-xs text-slate-500">Summary statistics per class for the selected date period.</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                {schoolData.classes.length} Classes
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                    <th className="px-6 py-3.5">Class Name</th>
                    <th className="px-4 py-3.5">Level</th>
                    <th className="px-4 py-3.5 text-center">Enrolled</th>
                    <th className="px-4 py-3.5 text-center">Present</th>
                    <th className="px-4 py-3.5 text-center">Late</th>
                    <th className="px-4 py-3.5 text-center">Excused</th>
                    <th className="px-4 py-3.5 text-center">Absent</th>
                    <th className="px-4 py-3.5 text-center">Attendance Rate</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {schoolData.classes.map((c) => (
                    <tr key={c.classId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{c.className}</td>
                      <td className="px-4 py-4 text-slate-500">{c.level || "—"}</td>
                      <td className="px-4 py-4 text-center font-semibold">{c.enrolledStudents}</td>
                      <td className="px-4 py-4 text-center text-emerald-700 font-semibold">{c.present}</td>
                      <td className="px-4 py-4 text-center text-amber-700 font-semibold">{c.late}</td>
                      <td className="px-4 py-4 text-center text-blue-700 font-semibold">{c.excused}</td>
                      <td className="px-4 py-4 text-center text-rose-700 font-semibold">{c.absent}</td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            c.attendanceRate >= 90
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : c.attendanceRate >= 75
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {c.attendanceRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleClassSelectChange(c.classId)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <span>View Details</span>
                          <span>→</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {schoolData.classes.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                        No classes found for this school.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE B: Single-Class Per-Student Summary (When selectedClassId !== "ALL") */}
      {!loadingSummary && selectedClassId !== "ALL" && singleClassData && (
        <div className="space-y-6">
          {/* Breadcrumb & Navigation Back Link */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleClassSelectChange("ALL")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
            >
              <span>←</span>
              <span>Back to School Overview</span>
            </button>

            <span className="text-xs font-semibold text-slate-500">
              Class Summary: <strong className="text-slate-900">{singleClassData.className}</strong>
            </span>
          </div>

          {/* Class Stat Summary */}
          {(() => {
            const totalPres = singleClassData.students.reduce((acc, s) => acc + s.present, 0);
            const totalAbs = singleClassData.students.reduce((acc, s) => acc + s.absent, 0);
            const totalLate = singleClassData.students.reduce((acc, s) => acc + s.late, 0);
            const totalExc = singleClassData.students.reduce((acc, s) => acc + s.excused, 0);
            const totalDaysAll = totalPres + totalAbs + totalLate + totalExc;
            const classRate = totalDaysAll > 0 ? Math.round(((totalPres + totalLate + totalExc) / totalDaysAll) * 100) : 0;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Class Attendance Rate
                  </span>
                  <div className="pt-1">
                    <span className="text-3xl font-extrabold text-slate-900">{classRate}%</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Students Evaluated
                  </span>
                  <div className="pt-1">
                    <span className="text-3xl font-extrabold text-slate-900">{singleClassData.students.length}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Present / Late Days
                  </span>
                  <div className="pt-1">
                    <span className="text-3xl font-extrabold text-emerald-600">{totalPres + totalLate}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{totalPres} Present, {totalLate} Late</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Absent Days
                  </span>
                  <div className="pt-1">
                    <span className="text-3xl font-extrabold text-rose-600">{totalAbs}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{totalExc} Excused</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Per-Student Summary Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Student Attendance Details</h3>
                <p className="text-xs text-slate-500">
                  Individual student metrics for {singleClassData.className} over the selected period.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                {singleClassData.students.length} Students
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                    <th className="px-6 py-3.5">Student Code</th>
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-4 py-3.5 text-center">Present</th>
                    <th className="px-4 py-3.5 text-center">Late</th>
                    <th className="px-4 py-3.5 text-center">Excused</th>
                    <th className="px-4 py-3.5 text-center">Absent</th>
                    <th className="px-4 py-3.5 text-center">Total Days</th>
                    <th className="px-6 py-3.5 text-center">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {singleClassData.students.map((s) => (
                    <tr key={s.studentId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-slate-600">{s.code || "—"}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-4 py-4 text-center text-emerald-700 font-semibold">{s.present}</td>
                      <td className="px-4 py-4 text-center text-amber-700 font-semibold">{s.late}</td>
                      <td className="px-4 py-4 text-center text-blue-700 font-semibold">{s.excused}</td>
                      <td className="px-4 py-4 text-center text-rose-700 font-semibold">{s.absent}</td>
                      <td className="px-4 py-4 text-center font-bold text-slate-800">{s.totalDays}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            s.attendanceRate >= 90
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : s.attendanceRate >= 75
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {s.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {singleClassData.students.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                        No student attendance data recorded for this class.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
