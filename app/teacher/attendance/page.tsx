"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface ClassItem {
  id: string;
  name: string;
  section?: string | null;
  level?: string | null;
  academicYear: string;
}

interface StudentItem {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note?: string | null;
  date: string;
}

interface SummaryData {
  classId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  students: Array<{
    studentId: string;
    firstName: string;
    lastName: string;
    totalDays: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  }>;
}

export default function TeacherAttendancePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialClassId = searchParams.get("classId") || "";

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [students, setStudents] = useState<StudentItem[]>([]);
  // Map of studentId -> { status, note }
  const [rosterState, setRosterState] = useState<
    Record<string, { status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; note: string }>
  >({});
  const [isExistingEntry, setIsExistingEntry] = useState(false);

  const [summary, setSummary] = useState<SummaryData | null>(null);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // 1. Fetch assigned classes on mount
  useEffect(() => {
    async function fetchClasses() {
      try {
        setLoadingClasses(true);
        const token = localStorage.getItem("edupulse_token");
        if (!token) return;

        const res = await fetch("/api/classes", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to load assigned classes");
        const data = await res.json();
        const list: ClassItem[] = data.data || [];
        setClasses(list);

        if (list.length > 0 && !selectedClassId) {
          setSelectedClassId(list[0].id);
        }
      } catch (err: any) {
        setError(err.message || "Error loading classes");
      } finally {
        setLoadingClasses(false);
      }
    }
    fetchClasses();
  }, []);

  // 2. Sync URL when selectedClassId changes
  function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    setError("");
    setSuccessMessage("");
    if (classId) {
      router.replace(`/teacher/attendance?classId=${classId}`);
    }
  }

  // 3. Fetch Roster & Existing Attendance when class or date changes
  useEffect(() => {
    if (!selectedClassId || !selectedDate) return;

    let isSubscribed = true;
    const token = localStorage.getItem("edupulse_token");
    if (!token) return;

    async function loadRosterAndAttendance() {
      try {
        setLoadingRoster(true);
        setError("");
        setSuccessMessage("");

        // Fetch students & existing attendance in parallel
        const [studentsRes, attendanceRes] = await Promise.all([
          fetch(`/api/students?classId=${selectedClassId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/attendance?classId=${selectedClassId}&date=${selectedDate}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!studentsRes.ok) throw new Error("Failed to load class roster");
        const studentsData = await studentsRes.json();
        const studentList: StudentItem[] = studentsData.data || [];

        let existingMap: Record<string, { status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; note: string }> = {};
        let hasExisting = false;

        if (attendanceRes.ok) {
          const attendanceData = await attendanceRes.json();
          const records: AttendanceRecord[] = attendanceData.data || [];
          if (records.length > 0) {
            hasExisting = true;
            records.forEach((rec) => {
              existingMap[rec.studentId] = {
                status: rec.status,
                note: rec.note || "",
              };
            });
          }
        }

        if (!isSubscribed) return;

        setStudents(studentList);
        setIsExistingEntry(hasExisting);

        // Build state cleanly for selected date without leaking previous date state
        const initialRosterState: Record<string, { status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; note: string }> = {};
        studentList.forEach((stu) => {
          if (existingMap[stu.id]) {
            initialRosterState[stu.id] = existingMap[stu.id];
          } else {
            // Default new entry to PRESENT
            initialRosterState[stu.id] = { status: "PRESENT", note: "" };
          }
        });

        setRosterState(initialRosterState);
      } catch (err: any) {
        if (isSubscribed) {
          setError(err.message || "Error loading roster or attendance");
        }
      } finally {
        if (isSubscribed) {
          setLoadingRoster(false);
        }
      }
    }

    loadRosterAndAttendance();

    return () => {
      isSubscribed = false;
    };
  }, [selectedClassId, selectedDate]);

  // 4. Fetch Monthly Summary for selected class
  useEffect(() => {
    if (!selectedClassId) return;

    let isSubscribed = true;
    const token = localStorage.getItem("edupulse_token");
    if (!token) return;

    async function loadSummary() {
      try {
        setLoadingSummary(true);
        const res = await fetch(`/api/attendance/summary?classId=${selectedClassId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setSummary(data.data || null);
          }
        }
      } catch (err) {
        console.error("Error loading attendance summary:", err);
      } finally {
        if (isSubscribed) {
          setLoadingSummary(false);
        }
      }
    }

    loadSummary();

    return () => {
      isSubscribed = false;
    };
  }, [selectedClassId, successMessage]);

  // Handler: Change single student status
  function handleStatusChange(studentId: string, status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") {
    setRosterState((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  }

  // Handler: Change single student note
  function handleNoteChange(studentId: string, note: string) {
    setRosterState((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        note,
      },
    }));
  }

  // Handler: Mark all present helper
  function markAllPresent() {
    setRosterState((prev) => {
      const updated: typeof prev = {};
      Object.keys(prev).forEach((stuId) => {
        updated[stuId] = {
          ...prev[stuId],
          status: "PRESENT",
        };
      });
      return updated;
    });
  }

  // Handler: Submit Attendance
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!selectedClassId || !selectedDate) {
      setError("Please select a class and date.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    if (students.length === 0) {
      setError("Cannot submit attendance: No enrolled students in this class.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token missing. Please log in again.");

      const payload = {
        classId: selectedClassId,
        date: selectedDate,
        attendance: students.map((stu) => ({
          studentId: stu.id,
          status: rosterState[stu.id]?.status || "PRESENT",
          note: rosterState[stu.id]?.note?.trim() || undefined,
        })),
      };

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit attendance.");
      }

      setIsExistingEntry(true);
      setSuccessMessage(
        `Attendance successfully ${isExistingEntry ? "updated" : "saved"} for ${selectedDate}!`
      );
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setError(err.message || "An error occurred while submitting attendance.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  // Calculate monthly summary aggregate stats for the class
  const classSummaryStats = (() => {
    if (!summary || !summary.students || summary.students.length === 0) {
      return { totalStudents: 0, overallRate: 0, totalDays: 0, present: 0, absent: 0, late: 0, excused: 0 };
    }

    const totalStudents = summary.students.length;
    const totalDays = summary.students[0]?.totalDays || 0;

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalExcused = 0;
    let rateSum = 0;

    summary.students.forEach((s) => {
      totalPresent += s.present;
      totalAbsent += s.absent;
      totalLate += s.late;
      totalExcused += s.excused;
      rateSum += s.attendanceRate;
    });

    const overallRate = Math.round(rateSum / totalStudents);

    return {
      totalStudents,
      overallRate,
      totalDays,
      present: totalPresent,
      absent: totalAbsent,
      late: totalLate,
      excused: totalExcused,
    };
  })();

  const currentClassObj = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Class Attendance
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Select a class and date to record or update daily student attendance.
        </p>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-700 hover:text-rose-900 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage("")} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Controls Card: Step 1 Class & Step 2 Date Selection */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Step 1: Select Class */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Step 1: Select Class
            </label>
            {loadingClasses ? (
              <div className="h-10 bg-slate-100 animate-pulse rounded-xl" />
            ) : (
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                {classes.length === 0 ? (
                  <option value="">No assigned classes found</option>
                ) : (
                  classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.section ? `(${cls.section})` : ""} — {cls.academicYear}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Step 2: Select Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Step 2: Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Existing Entry Indicator & Helper Action */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {isExistingEntry ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Pre-filled from existing records for {selectedDate}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                New attendance entry for {selectedDate}
              </span>
            )}
          </div>

          {students.length > 0 && (
            <button
              type="button"
              onClick={markAllPresent}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <span>Mark All Present</span>
            </button>
          )}
        </div>
      </div>

      {/* Step 3: Student Roster & Attendance Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Step 3: Mark Student Attendance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentClassObj?.name || "Selected Class"} — {students.length} Enrolled Students
              </p>
            </div>
          </div>

          {loadingRoster ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-semibold text-slate-800">No students enrolled in this class</p>
              <p className="text-xs text-slate-500 mt-1">
                Please select another class or enroll students via the Admin portal.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {students.map((student, idx) => {
                const currentRecord = rosterState[student.id] || { status: "PRESENT", note: "" };

                return (
                  <div
                    key={student.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Student Info */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {student.firstName} {student.lastName}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400 block">
                          ID: {student.studentId}
                        </span>
                      </div>
                    </div>

                    {/* Status Button Group */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* PRESENT */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, "PRESENT")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          currentRecord.status === "PRESENT"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        PRESENT
                      </button>

                      {/* ABSENT */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, "ABSENT")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          currentRecord.status === "ABSENT"
                            ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        ABSENT
                      </button>

                      {/* LATE */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, "LATE")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          currentRecord.status === "LATE"
                            ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        LATE
                      </button>

                      {/* EXCUSED */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, "EXCUSED")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          currentRecord.status === "EXCUSED"
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        EXCUSED
                      </button>
                    </div>

                    {/* Note Field */}
                    <div className="w-full md:w-64">
                      <input
                        type="text"
                        placeholder="Optional note (e.g. medical)..."
                        value={currentRecord.note}
                        onChange={(e) => handleNoteChange(student.id, e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 placeholder-slate-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form Footer Submit Action */}
          {students.length > 0 && (
            <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Ready to submit attendance for {students.length} students.
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {submitting && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{isExistingEntry ? "Update Attendance" : "Submit Attendance"}</span>
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Monthly Attendance Summary Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Monthly Attendance Summary
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Attendance performance rate for {currentClassObj?.name || "Selected Class"} this month.
            </p>
          </div>
          {summary?.period && (
            <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {summary.period.startDate} to {summary.period.endDate}
            </span>
          )}
        </div>

        {loadingSummary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : !summary || summary.students.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 font-medium">
            No monthly attendance statistics recorded yet for this class.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Overall Rate */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Attendance Rate</span>
                <div className="text-2xl font-black text-blue-900">{classSummaryStats.overallRate}%</div>
                <span className="text-[10px] text-blue-600 font-medium">Monthly class average</span>
              </div>

              {/* Total Days */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Days Marked</span>
                <div className="text-2xl font-black text-slate-900">{classSummaryStats.totalDays}</div>
                <span className="text-[10px] text-slate-500 font-medium">Total school days</span>
              </div>

              {/* Present Count */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Total Present</span>
                <div className="text-2xl font-black text-emerald-900">{classSummaryStats.present}</div>
                <span className="text-[10px] text-emerald-600 font-medium">Present attendance checks</span>
              </div>

              {/* Absent Count */}
              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100 space-y-1">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Total Absent</span>
                <div className="text-2xl font-black text-rose-900">{classSummaryStats.absent}</div>
                <span className="text-[10px] text-rose-600 font-medium">Absent attendance checks</span>
              </div>
            </div>

            {/* Per-Student Monthly Roster Stats */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5 text-center">Present</th>
                    <th className="px-4 py-2.5 text-center">Absent</th>
                    <th className="px-4 py-2.5 text-center">Late</th>
                    <th className="px-4 py-2.5 text-center">Excused</th>
                    <th className="px-4 py-2.5 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {summary.students.map((s) => (
                    <tr key={s.studentId} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-4 py-3 text-center text-emerald-700 font-bold">{s.present}</td>
                      <td className="px-4 py-3 text-center text-rose-700 font-bold">{s.absent}</td>
                      <td className="px-4 py-3 text-center text-amber-700 font-bold">{s.late}</td>
                      <td className="px-4 py-3 text-center text-blue-700 font-bold">{s.excused}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold ${
                            s.attendanceRate >= 80
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {s.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
