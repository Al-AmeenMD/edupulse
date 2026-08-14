"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ClassItem {
  id: string;
  name: string;
  level?: string | null;
  section?: string | null;
  academicYear: string;
  _count?: {
    enrollments?: number;
  };
}

interface User {
  firstName: string;
  lastName: string;
  email: string;
}

export default function TeacherDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Map of classId -> boolean indicating if today's attendance was marked
  const [attendanceStatusMap, setAttendanceStatusMap] = useState<Record<string, boolean>>({});
  const [checkingAttendance, setCheckingAttendance] = useState(false);

  useEffect(() => {
    const userJson = localStorage.getItem("edupulse_user");
    if (userJson) {
      try {
        setUser(JSON.parse(userJson));
      } catch (err) {
        console.error("Failed to parse user from localStorage:", err);
      }
    }
  }, []);

  async function fetchTeacherData() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      // 1. Fetch assigned classes
      const res = await fetch("/api/classes", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load assigned classes");
      }

      const data = await res.json();
      const assignedClasses: ClassItem[] = data.data || [];
      setClasses(assignedClasses);

      // 2. Check today's attendance status for each class
      if (assignedClasses.length > 0) {
        setCheckingAttendance(true);
        const todayStr = new Date().toISOString().split("T")[0];
        const statusMap: Record<string, boolean> = {};

        await Promise.all(
          assignedClasses.map(async (cls) => {
            try {
              const attRes = await fetch(`/api/attendance?classId=${cls.id}&date=${todayStr}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (attRes.ok) {
                const attData = await attRes.json();
                statusMap[cls.id] = (attData.data || []).length > 0;
              } else {
                statusMap[cls.id] = false;
              }
            } catch {
              statusMap[cls.id] = false;
            }
          })
        );

        setAttendanceStatusMap(statusMap);
        setCheckingAttendance(false);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while loading dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeacherData();
  }, []);

  // Compute stats
  const totalClasses = classes.length;
  const totalStudents = classes.reduce(
    (acc, cls) => acc + (cls._count?.enrollments || 0),
    0
  );

  const markedClassesCount = Object.values(attendanceStatusMap).filter(Boolean).length;
  const allMarked = totalClasses > 0 && markedClassesCount === totalClasses;

  // Time-of-day greeting helper
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/20">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span>Academic Term 2025/2026</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {getGreeting()}, {user?.firstName || "Teacher"}!
          </h1>
          <p className="text-slate-300 text-sm max-w-xl">
            Welcome to your Teacher Dashboard. Manage your assigned classes, track student enrollments, and complete daily attendance.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-700 hover:text-rose-900 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: My Classes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">My Classes</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.5M4.5 21V10.5" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{totalClasses}</div>
            <p className="text-xs text-slate-500 mt-0.5">Assigned academic classes</p>
          </div>
        </div>

        {/* Card 2: Total Students */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Students</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{totalStudents}</div>
            <p className="text-xs text-slate-500 mt-0.5">Enrolled across your classes</p>
          </div>
        </div>

        {/* Card 3: Today's Attendance Indicator */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today&apos;s Attendance</span>
            <div className={`p-2 rounded-xl ${allMarked ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
          </div>
          <div>
            {checkingAttendance ? (
              <div className="h-8 bg-slate-100 animate-pulse rounded-lg w-24" />
            ) : totalClasses === 0 ? (
              <div className="text-lg font-bold text-slate-400">—</div>
            ) : allMarked ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Marked ({markedClassesCount} of {totalClasses})</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-sm font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Pending ({markedClassesCount} of {totalClasses} Marked)</span>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1.5">
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* My Assigned Classes Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              My Assigned Classes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a class to view enrollment roster or take attendance.
            </p>
          </div>
          <Link
            href="/teacher/classes"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            View All Classes &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-36 bg-slate-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.5M4.5 21V10.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">No classes assigned to you yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Contact your School Administrator to assign academic classes to your profile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {classes.map((cls) => {
              const isTodayMarked = attendanceStatusMap[cls.id] || false;

              return (
                <div
                  key={cls.id}
                  className="p-5 rounded-2xl border border-slate-200/90 hover:border-blue-300 bg-white hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-slate-900">
                        {cls.name} {cls.section ? `(${cls.section})` : ""}
                      </h3>
                      {isTodayMarked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Marked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                      <span>Level: <strong className="text-slate-800">{cls.level || "—"}</strong></span>
                      <span>Academic Year: <strong className="text-slate-800 font-mono">{cls.academicYear}</strong></span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      <span>{cls._count?.enrollments ?? 0} Students Enrolled</span>
                    </div>

                    <Link
                      href={`/teacher/attendance?classId=${cls.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <span>Mark Attendance</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
