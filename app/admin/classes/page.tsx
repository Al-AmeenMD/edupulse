"use client";

import { useEffect, useRef, useState } from "react";

interface Teacher {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ClassItem {
  id: string;
  name: string;
  level?: string | null;
  section?: string | null;
  academicYear: string;
  teacherId?: string | null;
  teacher?: Teacher | null;
  _count?: {
    enrollments?: number;
  };
}

interface EnrolledStudent {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gender?: string | null;
  createdAt: string;
  classEnrollments?: {
    id: string;
    classId: string;
    class: {
      id: string;
      name: string;
    };
  }[];
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Add Class Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [section, setSection] = useState("");
  const [academicYear, setAcademicYear] = useState("2025/2026");
  const [teacherId, setTeacherId] = useState("");

  // Expanded Row & Student Enrollment State
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [enrolledLoading, setEnrolledLoading] = useState(false);
  const [allSchoolStudents, setAllSchoolStudents] = useState<EnrolledStudent[]>([]);
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

  // Fetch Teachers for Assignment Dropdown
  async function fetchTeachers() {
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/teachers?isActive=true", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTeachers(data.data || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch teachers:", err);
    }
  }

  // Fetch All School Students for Enrollment Dropdown
  async function fetchAllSchoolStudents() {
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/students?isActive=true", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAllSchoolStudents(data.data || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch all students:", err);
    }
  }

  useEffect(() => {
    fetchTeachers();
    fetchAllSchoolStudents();
  }, []);

  // Fetch Classes with AbortController for Search Safety
  async function fetchClasses() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      let url = "/api/classes";
      if (search.trim()) {
        url += `?search=${encodeURIComponent(search.trim())}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Failed to fetch classes");
      }

      const data = await res.json();
      setClasses(data.data || []);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "An error occurred while fetching classes");
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    fetchClasses();
  }, [search]);

  // Fetch Enrolled Students when a class row is expanded
  async function fetchEnrolledStudents(classId: string) {
    setEnrolledLoading(true);
    setEnrollError("");
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/students?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEnrolledStudents(data.data || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch enrolled students:", err);
    } finally {
      setEnrolledLoading(false);
    }
  }

  function handleToggleExpandRow(classId: string) {
    if (expandedClassId === classId) {
      setExpandedClassId(null);
      setEnrolledStudents([]);
    } else {
      setExpandedClassId(classId);
      setSelectedStudentToEnroll("");
      setEnrollError("");
      fetchEnrolledStudents(classId);
      fetchAllSchoolStudents();
    }
  }

  // Handle Add Class Modal Submit
  async function handleAddClassSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    setSubmitting(true);

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const res = await fetch("/api/classes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          level: level.trim() || undefined,
          section: section.trim() || undefined,
          academicYear: academicYear.trim(),
          teacherId: teacherId.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create class");
      }

      setIsModalOpen(false);
      setName("");
      setLevel("");
      setSection("");
      setTeacherId("");
      setSuccess(`Class "${data.data.name}" created successfully`);
      fetchClasses();
    } catch (err: any) {
      setModalError(err.message || "An error occurred while creating class");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Enroll Student into Class
  async function handleEnrollStudent(classId: string) {
    if (!selectedStudentToEnroll) return;
    setEnrolling(true);
    setEnrollError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const targetStudent = allSchoolStudents.find((s) => s.id === selectedStudentToEnroll);
      const existingEnrollment = targetStudent?.classEnrollments?.[0];

      if (existingEnrollment && existingEnrollment.classId !== classId) {
        throw new Error(
          `Student ${targetStudent?.firstName} ${targetStudent?.lastName} is already enrolled in class "${existingEnrollment.class.name}". Please remove them from their current class first.`
        );
      }

      const res = await fetch(`/api/classes/${classId}/enroll`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId: selectedStudentToEnroll }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to enroll student");
      }

      setSuccess(`Student enrolled successfully into class`);
      setSelectedStudentToEnroll("");
      fetchEnrolledStudents(classId);
      fetchClasses();
      fetchAllSchoolStudents();
    } catch (err: any) {
      setEnrollError(err.message || "An error occurred while enrolling student");
    } finally {
      setEnrolling(false);
    }
  }

  // Handle Remove Student from Class
  async function handleRemoveStudent(classId: string, studentId: string) {
    setRemovingStudentId(studentId);
    setEnrollError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const res = await fetch(`/api/classes/${classId}/enroll`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to remove student");
      }

      setSuccess("Student removed from class");
      fetchEnrolledStudents(classId);
      fetchClasses();
      fetchAllSchoolStudents();
    } catch (err: any) {
      setEnrollError(err.message || "An error occurred while removing student");
    } finally {
      setRemovingStudentId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Classes Roster
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage academic classes, assigned teachers, and student class enrollments.
          </p>
        </div>
        <button
          onClick={() => {
            setModalError("");
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add New Class</span>
        </button>
      </div>

      {/* Success Alert Banner */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <span className="font-semibold">{success}</span>
          </div>
          <button onClick={() => setSuccess("")} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
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
        {/* Search Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by class name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
            />
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
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
            <p className="text-sm font-semibold text-slate-800">No classes found</p>
            <p className="text-xs text-slate-500 mt-1">
              {search ? "No class records match your search term." : "No classes registered for your school."}
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
                  <th className="px-6 py-3.5">Assigned Teacher</th>
                  <th className="px-6 py-3.5 text-center">Students Enrolled</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {classes.map((cls) => {
                  const isExpanded = expandedClassId === cls.id;
                  const teacherName = cls.teacher
                    ? `${cls.teacher.user.firstName} ${cls.teacher.user.lastName}`
                    : null;

                  return (
                    <React.Fragment key={cls.id}>
                      <tr
                        onClick={() => handleToggleExpandRow(cls.id)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isExpanded ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {cls.name} {cls.section ? `(${cls.section})` : ""}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 font-medium">
                          {cls.level || "—"}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 font-mono font-medium">
                          {cls.academicYear}
                        </td>
                        <td className="px-6 py-4">
                          {teacherName ? (
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="font-semibold text-slate-800 text-xs">{teacherName}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                            {cls._count?.enrollments ?? 0} Students
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpandRow(cls.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-semibold text-slate-700 shadow-xs transition-colors"
                          >
                            <span>{isExpanded ? "Hide Enrolled" : "Manage Enrolled"}</span>
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Row View for Enrolled Students */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50/70 px-6 py-5 border-y border-blue-100">
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900">
                                    Enrolled Students in {cls.name}
                                  </h3>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Enroll new students or remove existing enrollments for this class.
                                  </p>
                                </div>

                                {/* Enroll Student Dropdown Control */}
                                <div className="flex items-center gap-2">
                                  <select
                                    value={selectedStudentToEnroll}
                                    onChange={(e) => setSelectedStudentToEnroll(e.target.value)}
                                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium max-w-xs"
                                  >
                                    <option value="">Select student to enroll...</option>
                                    {allSchoolStudents.map((st) => {
                                      const isCurrent = enrolledStudents.some((e) => e.id === st.id);
                                      if (isCurrent) return null;

                                      return (
                                        <option key={st.id} value={st.id}>
                                          {st.firstName} {st.lastName} ({st.studentId})
                                        </option>
                                      );
                                    })}
                                  </select>

                                  <button
                                    onClick={() => handleEnrollStudent(cls.id)}
                                    disabled={!selectedStudentToEnroll || enrolling}
                                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
                                  >
                                    {enrolling ? "Enrolling..." : "Enroll Student"}
                                  </button>
                                </div>
                              </div>

                              {/* Enrollment Action Error */}
                              {enrollError && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                                  </svg>
                                  <span>{enrollError}</span>
                                </div>
                              )}

                              {/* Enrolled Students List */}
                              {enrolledLoading ? (
                                <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 animate-pulse">
                                  Loading enrolled students...
                                </div>
                              ) : enrolledStudents.length === 0 ? (
                                <div className="p-6 bg-white rounded-xl border border-slate-200 text-center">
                                  <p className="text-xs font-semibold text-slate-700">No students currently enrolled in this class.</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">Use the dropdown above to enroll students.</p>
                                </div>
                              ) : (
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-100/60 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                        <th className="px-4 py-2.5">Student ID</th>
                                        <th className="px-4 py-2.5">Student Name</th>
                                        <th className="px-4 py-2.5">Gender</th>
                                        <th className="px-4 py-2.5 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                      {enrolledStudents.map((st) => (
                                        <tr key={st.id} className="hover:bg-slate-50">
                                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                                            {st.studentId}
                                          </td>
                                          <td className="px-4 py-2.5 font-semibold text-slate-900">
                                            {st.firstName} {st.lastName}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-600">
                                            {st.gender || "—"}
                                          </td>
                                          <td className="px-4 py-2.5 text-right">
                                            <button
                                              onClick={() => handleRemoveStudent(cls.id, st.id)}
                                              disabled={removingStudentId === st.id}
                                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition-colors border border-rose-200 disabled:opacity-50 cursor-pointer"
                                            >
                                              {removingStudentId === st.id ? "Removing..." : "Remove"}
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Class Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden z-10">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Create New Academic Class
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Alert */}
            {modalError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddClassSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Primary 5, JSS 1, Senior Secondary"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Level
                  </label>
                  <input
                    type="text"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    placeholder="e.g. Primary, Secondary"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Section / Stream
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. A, B, Science"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Academic Year <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  required
                  placeholder="e.g. 2025/2026"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Assign Teacher
                </label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                >
                  <option value="">Select Teacher (Optional)</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user.firstName} {t.user.lastName} ({t.user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Class</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import React from "react";
