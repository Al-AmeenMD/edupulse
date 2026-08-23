"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface TeacherUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Teacher {
  id: string;
  userId: string;
  schoolId: string;
  employeeId?: string | null;
  qualification?: string | null;
  dob?: string | null;
  createdAt: string;
  updatedAt: string;
  user: TeacherUser;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("all");

  const abortControllerRef = useRef<AbortController | null>(null);

  // Add Teacher Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addModalError, setAddModalError] = useState("");

  // Edit Teacher Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editModalError, setEditModalError] = useState("");

  // Deactivate Teacher Modal State
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [deactivatingTeacher, setDeactivatingTeacher] = useState<Teacher | null>(null);
  const [submittingDeactivate, setSubmittingDeactivate] = useState(false);
  const [deactivateModalError, setDeactivateModalError] = useState("");

  // Add Form Fields
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [addQualification, setAddQualification] = useState("");
  const [addDob, setAddDob] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Edit Form Fields
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editQualification, setEditQualification] = useState("");
  const [editDob, setEditDob] = useState("");

  async function fetchTeachers() {
    // Abort previous in-flight request to resolve search-clear race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      let url = "/api/teachers";
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (isActiveFilter !== "all") params.append("isActive", isActiveFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Failed to fetch teachers");
      }

      const data = await res.json();
      setTeachers(data.data || []);
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Silently ignore aborted requests
        return;
      }
      setError(err.message || "An error occurred while fetching teachers");
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    fetchTeachers();
  }, [search, isActiveFilter]);

  function handleOpenAddModal() {
    setAddModalError("");
    setAddFirstName("");
    setAddLastName("");
    setAddEmail("");
    setAddPhone("");
    setAddEmployeeId("");
    setAddQualification("");
    setAddDob("");
    setAddPassword("");
    setShowAddPassword(false);
    setIsAddModalOpen(true);
  }

  function handleGeneratePassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const array = new Uint32Array(12);
    crypto.getRandomValues(array);
    let generatedPassword = "";
    for (let i = 0; i < array.length; i++) {
      generatedPassword += chars[array[i] % chars.length];
    }
    setAddPassword(generatedPassword);
    setShowAddPassword(true);
  }

  async function handleAddTeacherSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddModalError("");
    setSubmittingAdd(true);

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      if (!addFirstName.trim() || !addLastName.trim() || !addEmail.trim() || !addPassword) {
        throw new Error("First name, last name, email, and password are required");
      }

      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: addFirstName.trim(),
          lastName: addLastName.trim(),
          email: addEmail.trim().toLowerCase(),
          phone: addPhone.trim() || undefined,
          employeeId: addEmployeeId.trim() || undefined,
          qualification: addQualification.trim() || undefined,
          dob: addDob ? addDob : undefined,
          password: addPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create teacher");
      }

      setIsAddModalOpen(false);
      setSuccess(`Teacher ${data.data?.user?.firstName} ${data.data?.user?.lastName} added successfully!`);
      setTimeout(() => setSuccess(""), 4000);
      fetchTeachers();
    } catch (err: any) {
      setAddModalError(err.message || "An error occurred while creating teacher");
    } finally {
      setSubmittingAdd(false);
    }
  }

  function handleOpenEditModal(teacher: Teacher) {
    setEditModalError("");
    setEditingTeacher(teacher);
    setEditFirstName(teacher.user.firstName || "");
    setEditLastName(teacher.user.lastName || "");
    setEditEmail(teacher.user.email || "");
    setEditPhone(teacher.user.phone || "");
    setEditEmployeeId(teacher.employeeId || "");
    setEditQualification(teacher.qualification || "");
    setEditDob(teacher.dob ? new Date(teacher.dob).toISOString().split("T")[0] : "");
    setIsEditModalOpen(true);
  }

  async function handleEditTeacherSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTeacher) return;
    setEditModalError("");
    setSubmittingEdit(true);

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const res = await fetch(`/api/teachers/${editingTeacher.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim().toLowerCase(),
          phone: editPhone.trim() || undefined,
          employeeId: editEmployeeId.trim() || undefined,
          qualification: editQualification.trim() || undefined,
          dob: editDob ? editDob : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update teacher");
      }

      setIsEditModalOpen(false);
      setSuccess(`Teacher ${data.data?.user?.firstName} ${data.data?.user?.lastName} updated successfully!`);
      setTimeout(() => setSuccess(""), 4000);
      fetchTeachers();
    } catch (err: any) {
      setEditModalError(err.message || "An error occurred while updating teacher");
    } finally {
      setSubmittingEdit(false);
    }
  }

  function handleOpenDeactivateModal(teacher: Teacher) {
    setDeactivateModalError("");
    setDeactivatingTeacher(teacher);
    setIsDeactivateModalOpen(true);
  }

  async function handleConfirmDeactivate() {
    if (!deactivatingTeacher) return;
    setDeactivateModalError("");
    setSubmittingDeactivate(true);

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const res = await fetch(`/api/teachers/${deactivatingTeacher.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to deactivate teacher");
      }

      setIsDeactivateModalOpen(false);
      setSuccess(`Teacher ${deactivatingTeacher.user.firstName} ${deactivatingTeacher.user.lastName} deactivated successfully.`);
      setTimeout(() => setSuccess(""), 4000);
      fetchTeachers();
    } catch (err: any) {
      setDeactivateModalError(err.message || "An error occurred while deactivating teacher");
    } finally {
      setSubmittingDeactivate(false);
    }
  }

  async function handleReactivateTeacher(teacher: Teacher) {
    try {
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const res = await fetch(`/api/teachers/${teacher.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reactivate teacher");
      }

      setSuccess(`Teacher ${teacher.user.firstName} ${teacher.user.lastName} reactivated successfully!`);
      setTimeout(() => setSuccess(""), 4000);
      fetchTeachers();
    } catch (err: any) {
      setError(err.message || "An error occurred while reactivating teacher");
      setTimeout(() => setError(""), 4000);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Teachers Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage academic staff profiles, employee IDs, qualifications, and account access.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add Teacher</span>
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <Link
            href="/admin/teachers"
            className="border-blue-600 text-blue-600 whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center gap-2"
          >
            <span>Teachers</span>
            <span className="bg-blue-100 text-blue-700 py-0.5 px-2.5 rounded-full text-xs font-semibold">
              {teachers.length}
            </span>
          </Link>
          <Link
            href="/admin/finance-admins"
            className="border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm flex items-center gap-2"
          >
            <span>Finance Admins</span>
          </Link>
        </nav>
      </div>

      {/* Success Alert */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess("")} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

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
        {/* Search & Filter Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teachers by name or email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status:
            </label>
            <select
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
            >
              <option value="all">All Teachers</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : teachers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">No teachers yet</p>
            <p className="text-xs text-slate-500 mt-1">
              {search || isActiveFilter !== "all"
                ? "No teacher records match your active search filters."
                : "Get started by adding academic staff members to your school."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Name</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Phone</th>
                  <th className="px-6 py-3.5">Employee ID</th>
                  <th className="px-6 py-3.5">Qualification</th>
                  <th className="px-6 py-3.5">DOB</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {teacher.user.firstName} {teacher.user.lastName}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {teacher.user.email}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs font-mono">
                      {teacher.user.phone || "—"}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-700">
                      {teacher.employeeId ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-800 border border-slate-200">
                          {teacher.employeeId}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {teacher.qualification || "—"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                      {teacher.dob ? new Date(teacher.dob).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {teacher.user.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(teacher)}
                          className="px-3 py-1.5 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-blue-50 font-semibold border border-slate-200 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        {teacher.user.isActive ? (
                          <button
                            onClick={() => handleOpenDeactivateModal(teacher)}
                            className="px-3 py-1.5 rounded-lg text-rose-700 hover:bg-rose-50 font-semibold border border-rose-200 transition-colors cursor-pointer"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateTeacher(teacher)}
                            className="px-3 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 font-semibold border border-emerald-200 transition-colors cursor-pointer"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Teacher Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsAddModalOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Add New Teacher
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Alert */}
            {addModalError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{addModalError}</span>
              </div>
            )}

            <form onSubmit={handleAddTeacherSubmit} autoComplete="off" className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addFirstName}
                    onChange={(e) => setAddFirstName(e.target.value)}
                    required
                    placeholder="e.g. Fatima"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addLastName}
                    onChange={(e) => setAddLastName(e.target.value)}
                    required
                    placeholder="e.g. Usman"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="new_teacher_email"
                    name="new_teacher_email"
                    autoComplete="off"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    required
                    placeholder="fatima.usman@school.edu"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="+234..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={addEmployeeId}
                    onChange={(e) => setAddEmployeeId(e.target.value)}
                    placeholder="e.g. TCH-014"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Qualification
                  </label>
                  <input
                    type="text"
                    value={addQualification}
                    onChange={(e) => setAddQualification(e.target.value)}
                    placeholder="e.g. B.Ed"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={addDob}
                    onChange={(e) => setAddDob(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Account Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span>Auto-generate Random Password</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showAddPassword ? "text" : "password"}
                    id="new_teacher_password"
                    name="new_teacher_password"
                    autoComplete="new-password"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    required
                    placeholder="Set account password"
                    className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showAddPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.274 4.057 5.065 7 9.542 7 4.477 0 8.268-2.943 9.542-7-1.274-4.057-5.065-7-9.542-7-4.477 0-8.268 2.943-9.542 7z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {submittingAdd ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add Teacher</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsEditModalOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Edit Teacher Details
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Alert */}
            {editModalError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{editModalError}</span>
              </div>
            )}

            <form onSubmit={handleEditTeacherSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Qualification
                  </label>
                  <input
                    type="text"
                    value={editQualification}
                    onChange={(e) => setEditQualification(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {submittingEdit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {isDeactivateModalOpen && deactivatingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsDeactivateModalOpen(false)}
          />

          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Deactivate Teacher Account
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to deactivate {deactivatingTeacher.user.firstName} {deactivatingTeacher.user.lastName}?
                </p>
              </div>
            </div>

            {deactivateModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {deactivateModalError}
              </div>
            )}

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              Deactivating this teacher will revoke their login access immediately. Their historical class records and student grades will remain intact.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeactivateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={submittingDeactivate}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {submittingDeactivate ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deactivating...</span>
                  </>
                ) : (
                  <span>Deactivate Teacher</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
