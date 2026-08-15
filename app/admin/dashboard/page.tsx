"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Teacher {
  id: string;
  userId: string;
  employeeId?: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  classEnrollments?: Array<{
    class: {
      id: string;
      name: string;
      level?: string;
    };
  }>;
}

interface ClassItem {
  id: string;
  name: string;
  academicYear: string;
  _count?: {
    enrollments: number;
  };
}

interface FeeItem {
  id: string;
  studentId: string;
  status: string;
  dueDate: string;
  student?: {
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
  };
  feeStructure?: {
    id: string;
    name: string;
    amount: number | string;
    academicYear: string;
    term: string;
  };
}

export default function AdminDashboardPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [pendingFees, setPendingFees] = useState<FeeItem[]>([]);
  const [overdueFees, setOverdueFees] = useState<FeeItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setError("");
        const token = localStorage.getItem("edupulse_token");
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };

        const [teachersRes, studentsRes, classesRes, pendingFeesRes, overdueFeesRes] =
          await Promise.all([
            fetch("/api/teachers", { headers }),
            fetch("/api/students", { headers }),
            fetch("/api/classes", { headers }),
            fetch("/api/fees?status=PENDING", { headers }),
            fetch("/api/fees?status=OVERDUE", { headers }),
          ]);

        if (
          !teachersRes.ok ||
          !studentsRes.ok ||
          !classesRes.ok ||
          !pendingFeesRes.ok ||
          !overdueFeesRes.ok
        ) {
          throw new Error("Failed to load dashboard metrics");
        }

        const [teachersJson, studentsJson, classesJson, pendingFeesJson, overdueFeesJson] =
          await Promise.all([
            teachersRes.json(),
            studentsRes.json(),
            classesRes.json(),
            pendingFeesRes.json(),
            overdueFeesRes.json(),
          ]);

        setTeachers(teachersJson.data || []);
        setStudents(studentsJson.data || []);
        setClasses(classesJson.data || []);
        setPendingFees(pendingFeesJson.data || []);
        setOverdueFees(overdueFeesJson.data || []);
      } catch (err: any) {
        setError(err.message || "An error occurred while loading dashboard");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const totalTeachers = teachers.length;
  const totalStudents = students.length;
  const totalClasses = classes.length;
  const pendingFeesCount = pendingFees.length;
  const overdueFeesCount = overdueFees.length;

  // Recent 5 students (sorted by createdAt desc)
  const recentStudents = [...students]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Top 5 overdue fees (sorted server-side by dueDate asc)
  const topOverdueFees = overdueFees.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            School Overview Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time analytics and management metrics for your school.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
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

      {/* Stats Cards Grid (5 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Total Teachers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Teachers
              </p>
              {loading ? (
                <div className="h-7 w-12 bg-slate-200 animate-pulse rounded-md mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {totalTeachers}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Students
              </p>
              {loading ? (
                <div className="h-7 w-12 bg-slate-200 animate-pulse rounded-md mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {totalStudents}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Classes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Classes
              </p>
              {loading ? (
                <div className="h-7 w-12 bg-slate-200 animate-pulse rounded-md mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {totalClasses}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
          </div>
        </div>

        {/* Pending Fees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Pending Fees
              </p>
              {loading ? (
                <div className="h-7 w-12 bg-slate-200 animate-pulse rounded-md mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {pendingFeesCount}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Overdue Fees */}
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
                  {overdueFeesCount}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section for Recent Students and Overdue Fees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Students Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recently Enrolled Students</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing up to 5 recently registered students
              </p>
            </div>
            <Link
              href="/admin/students"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              View All &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : recentStudents.length === 0 ? (
            <div className="p-10 text-center flex-1 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-800">No recent students</p>
              <p className="text-xs text-slate-500 mt-1">No student records exist for this school yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Student</th>
                    <th className="px-6 py-3.5">ID</th>
                    <th className="px-6 py-3.5">Class</th>
                    <th className="px-6 py-3.5 text-right">Enrolled Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recentStudents.map((student) => {
                    const assignedClass =
                      student.classEnrollments?.[0]?.class?.name || "Unassigned";

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="px-6 py-3.5 text-slate-500 font-mono text-xs">
                          {student.studentId}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {assignedClass}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right text-xs text-slate-500">
                          {new Date(student.createdAt).toLocaleDateString()}
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
              <h2 className="text-base font-bold text-slate-900">Urgent Overdue Fees</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Earliest due dates requiring administrative attention
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
          ) : topOverdueFees.length === 0 ? (
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
                    <th className="px-6 py-3.5">Amount Due (₦)</th>
                    <th className="px-6 py-3.5 text-right">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {topOverdueFees.map((fee) => {
                    const studentName = fee.student
                      ? `${fee.student.firstName} ${fee.student.lastName}`
                      : "Unknown Student";
                    const feeName = fee.feeStructure?.name || "Tuition Fee";
                    const formattedAmount = Number(
                      fee.feeStructure?.amount || 0
                    ).toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });

                    return (
                      <tr key={fee.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          {studentName}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600 text-xs">
                          {feeName}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-rose-600 text-xs font-mono">
                          {formattedAmount}
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
