"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ClassItem {
  id: string;
  name: string;
  level?: string | null;
  academicYear: string;
  _count?: {
    enrollments?: number;
  };
}

export default function MyClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchMyClasses() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/classes", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load assigned classes");
      }

      const data = await res.json();
      setClasses(data.data || []);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMyClasses();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          My Assigned Classes
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of academic classes assigned to your teaching profile.
        </p>
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

      {/* Table Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Class Name</th>
                  <th className="px-6 py-3.5">Level</th>
                  <th className="px-6 py-3.5">Academic Year</th>
                  <th className="px-6 py-3.5 text-center">Enrolled Students</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {cls.name}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-medium">
                      {cls.level || "—"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-mono font-medium">
                      {cls.academicYear}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                        {cls._count?.enrollments ?? 0} Students
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/teacher/attendance?classId=${cls.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <span>Mark Attendance</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
