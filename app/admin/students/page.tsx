"use client";

import { useEffect, useRef, useState } from "react";

interface ClassItem {
  id: string;
  name: string;
  level?: string | null;
  academicYear?: string | null;
}

interface ClassEnrollment {
  id: string;
  class: {
    id: string;
    name: string;
  };
}

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  admissionLevel?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  isActive: boolean;
  createdAt: string;
  classEnrollments?: ClassEnrollment[];
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [isActiveFilter, setIsActiveFilter] = useState("all");

  const abortControllerRef = useRef<AbortController | null>(null);

  // FIX-004: Sort State
  const [sortField, setSortField] = useState<"studentId" | "firstName" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

  // Add Student Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Add Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");

  // FIX-006: Manual ID State
  const [isManualId, setIsManualId] = useState(false);
  const [manualStudentId, setManualStudentId] = useState("");

  // Dynamic Admission Level State
  const [requiresLevel, setRequiresLevel] = useState(false);
  const [existingLevels, setExistingLevels] = useState<string[]>([]);
  const [selectedLevelOption, setSelectedLevelOption] = useState("");
  const [customAdmissionLevel, setCustomAdmissionLevel] = useState("");

  // FIX-005: Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editModalError, setEditModalError] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editGuardianName, setEditGuardianName] = useState("");
  const [editGuardianPhone, setEditGuardianPhone] = useState("");
  const [editGuardianEmail, setEditGuardianEmail] = useState("");
  const [editAdmissionLevel, setEditAdmissionLevel] = useState("");

  // Deactivate Modal State
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [deactivatingStudent, setDeactivatingStudent] = useState<Student | null>(null);
  const [submittingDeactivate, setSubmittingDeactivate] = useState(false);
  const [deactivateModalError, setDeactivateModalError] = useState("");

  // Fetch Classes for Filter Dropdown
  async function fetchClasses() {
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/classes", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setClasses(data.data || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch classes for filter:", err);
    }
  }

  useEffect(() => {
    fetchClasses();
  }, []);

  // Fetch Students with AbortController for race condition safety
  async function fetchStudents() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      let url = "/api/students";
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (selectedClassId !== "all") params.append("classId", selectedClassId);
      if (isActiveFilter !== "all") params.append("isActive", isActiveFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Failed to fetch students");
      }

      const data = await res.json();
      setStudents(data.data || []);
    } catch (err: any) {
      if (err.name === "AbortError") {
        return;
      }
      setError(err.message || "An error occurred while fetching students");
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    fetchStudents();
  }, [search, selectedClassId, isActiveFilter]);

  // Load School ID Template Settings
  async function loadSchoolSettings() {
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const settingsRes = await fetch("/api/schools/my-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const template = settingsData.data?.studentIdTemplate || "";
        const hasLevelToken = template.includes("{LEVEL}");
        setRequiresLevel(hasLevelToken);
      }
    } catch (err: any) {
      console.error("Failed to load school settings:", err);
    }
  }

  useEffect(() => {
    loadSchoolSettings();
  }, []);

  // FIX-004: Handle Sort Cycling
  function handleSort(field: "studentId" | "firstName") {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else if (sortDirection === "desc") {
      setSortField(null);
      setSortDirection(null);
    } else {
      setSortDirection("asc");
    }
  }

  const sortedStudents = [...students].sort((a, b) => {
    if (!sortField || !sortDirection) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortField === "studentId") {
      const cmp = a.studentId.localeCompare(b.studentId, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? cmp : -cmp;
    }
    if (sortField === "firstName") {
      const cmp = a.firstName.localeCompare(b.firstName, undefined, {
        sensitivity: "base",
      });
      if (cmp !== 0) return sortDirection === "asc" ? cmp : -cmp;
      const lastCmp = a.lastName.localeCompare(b.lastName, undefined, {
        sensitivity: "base",
      });
      return sortDirection === "asc" ? lastCmp : -lastCmp;
    }
    return 0;
  });

  // Open Add Student Modal
  async function handleOpenModal() {
    setModalError("");
    setFirstName("");
    setLastName("");
    setDateOfBirth("");
    setGender("");
    setAddress("");
    setGuardianName("");
    setGuardianPhone("");
    setGuardianEmail("");
    setSelectedLevelOption("");
    setCustomAdmissionLevel("");
    setIsManualId(false);
    setManualStudentId("");

    await loadSchoolSettings();

    const uniqueLevels = Array.from(
      new Set(
        students
          .map((s) => s.admissionLevel?.trim())
          .filter((lvl): lvl is string => Boolean(lvl))
      )
    );
    setExistingLevels(uniqueLevels);

    if (uniqueLevels.length > 0) {
      setSelectedLevelOption(uniqueLevels[0]);
    } else {
      setSelectedLevelOption("__new__");
    }

    setIsModalOpen(true);
  }

  async function handleAddStudentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    setSubmitting(true);

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      if (isManualId && !manualStudentId.trim()) {
        throw new Error("Student ID is required when manual entry mode is selected");
      }

      let finalAdmissionLevel: string | undefined = undefined;

      if (requiresLevel) {
        if (selectedLevelOption === "__new__") {
          finalAdmissionLevel = customAdmissionLevel.trim();
        } else {
          finalAdmissionLevel = selectedLevelOption.trim();
        }

        if (!finalAdmissionLevel) {
          throw new Error("Admission level is required for your school's student ID template");
        }
      }

      const res = await fetch("/api/students", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: isManualId ? manualStudentId.trim() : undefined,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth: dateOfBirth ? dateOfBirth : undefined,
          gender: gender ? gender : undefined,
          address: address.trim() || undefined,
          admissionLevel: finalAdmissionLevel,
          guardianName: guardianName.trim() || undefined,
          guardianPhone: guardianPhone.trim() || undefined,
          guardianEmail: guardianEmail.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create student");
      }

      setIsModalOpen(false);
      setSuccess(`Student ${data.data.firstName} ${data.data.lastName} registered successfully with Student ID: ${data.data.studentId}`);
      setTimeout(() => setSuccess(""), 4000);
      fetchStudents();
    } catch (err: any) {
      setModalError(err.message || "An error occurred while creating student");
    } finally {
      setSubmitting(false);
    }
  }

  // FIX-005: Open Edit Student Modal
  function handleOpenEditModal(student: Student) {
    setEditModalError("");
    setEditingStudent(student);
    setEditFirstName(student.firstName || "");
    setEditLastName(student.lastName || "");
    setEditDateOfBirth(student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split("T")[0] : "");
    setEditGender(student.gender || "");
    setEditAddress(student.address || "");
    setEditGuardianName(student.guardianName || "");
    setEditGuardianPhone(student.guardianPhone || "");
    setEditGuardianEmail(student.guardianEmail || "");
    setEditAdmissionLevel(student.admissionLevel || "");
    setIsEditModalOpen(true);
  }

  async function handleEditStudentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStudent) return;
    setEditModalError("");
    setSubmittingEdit(true);

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const res = await fetch(`/api/students/${editingStudent.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          dateOfBirth: editDateOfBirth ? editDateOfBirth : null,
          gender: editGender ? editGender : null,
          address: editAddress.trim() || null,
          admissionLevel: editAdmissionLevel.trim() || null,
          guardianName: editGuardianName.trim() || null,
          guardianPhone: editGuardianPhone.trim() || null,
          guardianEmail: editGuardianEmail.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update student");
      }

      setIsEditModalOpen(false);
      setSuccess(`Student ${data.data.firstName} ${data.data.lastName} updated successfully.`);
      setTimeout(() => setSuccess(""), 4000);
      fetchStudents();
    } catch (err: any) {
      setEditModalError(err.message || "An error occurred while updating student");
    } finally {
      setSubmittingEdit(false);
    }
  }

  // FIX-005: Deactivate Modal & Reactivate Actions
  function handleOpenDeactivateModal(student: Student) {
    setDeactivateModalError("");
    setDeactivatingStudent(student);
    setIsDeactivateModalOpen(true);
  }

  async function handleConfirmDeactivate() {
    if (!deactivatingStudent) return;
    setDeactivateModalError("");
    setSubmittingDeactivate(true);

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const res = await fetch(`/api/students/${deactivatingStudent.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: false }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to deactivate student");
      }

      setIsDeactivateModalOpen(false);
      setSuccess(`Student ${deactivatingStudent.firstName} ${deactivatingStudent.lastName} deactivated successfully.`);
      setTimeout(() => setSuccess(""), 4000);
      fetchStudents();
    } catch (err: any) {
      setDeactivateModalError(err.message || "An error occurred while deactivating student");
    } finally {
      setSubmittingDeactivate(false);
    }
  }

  async function handleReactivateStudent(student: Student) {
    try {
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const res = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reactivate student");
      }

      setSuccess(`Student ${student.firstName} ${student.lastName} reactivated successfully.`);
      setTimeout(() => setSuccess(""), 4000);
      fetchStudents();
    } catch (err: any) {
      setError(err.message || "An error occurred while reactivating student");
      setTimeout(() => setError(""), 4000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Students Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage student registrations, personal information, and class assignments.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-sm hover:shadow-md cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add Student</span>
        </button>
      </div>

      {/* Global Toast Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-700 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess("")} className="text-emerald-500 hover:text-emerald-700 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or Student ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Class Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Class:
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
              >
                <option value="all">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status:
              </label>
              <select
                value={isActiveFilter}
                onChange={(e) => setIsActiveFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
              >
                <option value="all">All Students</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : sortedStudents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">No students found</p>
            <p className="text-xs text-slate-500 mt-1">
              {search || selectedClassId !== "all" || isActiveFilter !== "all"
                ? "No student records match your active search filters."
                : "No student records available for your school."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th
                    onClick={() => handleSort("studentId")}
                    className="px-6 py-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student ID</span>
                      <span className="text-[10px]">
                        {sortField === "studentId" ? (
                          sortDirection === "asc" ? (
                            <span className="text-blue-600 font-bold">▲</span>
                          ) : (
                            <span className="text-blue-600 font-bold">▼</span>
                          )
                        ) : (
                          <span className="text-slate-300 group-hover:text-slate-500">▲▼</span>
                        )}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("firstName")}
                    className="px-6 py-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Name</span>
                      <span className="text-[10px]">
                        {sortField === "firstName" ? (
                          sortDirection === "asc" ? (
                            <span className="text-blue-600 font-bold">▲</span>
                          ) : (
                            <span className="text-blue-600 font-bold">▼</span>
                          )
                        ) : (
                          <span className="text-slate-300 group-hover:text-slate-500">▲▼</span>
                        )}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-3.5">Gender</th>
                  <th className="px-6 py-3.5">Guardian</th>
                  <th className="px-6 py-3.5">Class</th>
                  <th className="px-6 py-3.5">Enrolled Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedStudents.map((student) => {
                  const assignedClass =
                    student.classEnrollments?.[0]?.class?.name || "Unassigned";

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">
                        {student.studentId}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {student.gender || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {student.guardianName ? (
                          <div>
                            <div className="font-semibold text-xs text-slate-800">
                              {student.guardianName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {student.guardianPhone || student.guardianEmail || ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {assignedClass}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {new Date(student.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {student.isActive ? (
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
                            onClick={() => handleOpenEditModal(student)}
                            className="px-3 py-1.5 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-blue-50 font-semibold border border-slate-200 transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          {student.isActive ? (
                            <button
                              onClick={() => handleOpenDeactivateModal(student)}
                              className="px-3 py-1.5 rounded-lg text-rose-700 hover:bg-rose-50 font-semibold border border-rose-200 transition-colors cursor-pointer"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateStudent(student)}
                              className="px-3 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 font-semibold border border-emerald-200 transition-colors cursor-pointer"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Register New Student
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

            <form onSubmit={handleAddStudentSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* FIX-006: ID Generation Mode Toggle */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Student ID Assignment
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="idMode"
                      checked={!isManualId}
                      onChange={() => setIsManualId(false)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Auto-generate ID</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="idMode"
                      checked={isManualId}
                      onChange={() => setIsManualId(true)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Enter existing ID</span>
                  </label>
                </div>

                {isManualId && (
                  <div className="pt-2 space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Existing Student ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualStudentId}
                      onChange={(e) => setManualStudentId(e.target.value)}
                      required={isManualId}
                      placeholder="e.g. STU/2026/001"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="e.g. Ahmad"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="e.g. Muhammad"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              {/* Conditional Admission Level Field — driven by requiresLevel in BOTH modes */}
              {requiresLevel && (
                <div className="space-y-2 p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl">
                  <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Admission Level <span className="text-rose-500">*</span>
                  </label>

                  {existingLevels.length > 0 && (
                    <select
                      value={selectedLevelOption}
                      onChange={(e) => setSelectedLevelOption(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                    >
                      {existingLevels.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                      <option value="__new__">Type new level...</option>
                    </select>
                  )}

                  {(existingLevels.length === 0 || selectedLevelOption === "__new__") && (
                    <input
                      type="text"
                      value={customAdmissionLevel}
                      onChange={(e) => setCustomAdmissionLevel(e.target.value)}
                      required
                      placeholder="e.g. Primary, Nursery, Secondary"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                    />
                  )}
                  <p className="text-[11px] text-blue-700">
                    Required by your school&apos;s configured Student ID template.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Home address"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Guardian Information
                </p>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Guardian Name
                  </label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Guardian Phone
                    </label>
                    <input
                      type="text"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Guardian Email
                    </label>
                    <input
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
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
                      <span>Registering...</span>
                    </>
                  ) : (
                    <span>Register Student</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FIX-005: Edit Student Modal */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsEditModalOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Edit Student Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update personal and guardian records for this student.
                </p>
              </div>
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

            <form onSubmit={handleEditStudentSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Read-Only Student ID Badge */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Student ID (Immutable)
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {editingStudent.studentId}
                  </span>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-200 text-slate-700 rounded-md">
                  Permanent
                </span>
              </div>

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
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              {/* Admission Level Warning & Input */}
              {requiresLevel && (
                <div className="space-y-1.5 p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Admission Level
                  </label>
                  <input
                    type="text"
                    value={editAdmissionLevel}
                    onChange={(e) => setEditAdmissionLevel(e.target.value)}
                    placeholder="e.g. Primary, Secondary"
                    className="w-full px-3 py-2 border border-amber-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                  />
                  <p className="text-[11px] text-amber-800">
                    Note: Updating admission level alters student classification but does not alter the already generated Student ID.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={editDateOfBirth}
                    onChange={(e) => setEditDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Gender
                  </label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Address
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Home address"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Guardian Information
                </p>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Guardian Name
                  </label>
                  <input
                    type="text"
                    value={editGuardianName}
                    onChange={(e) => setEditGuardianName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Guardian Phone
                    </label>
                    <input
                      type="text"
                      value={editGuardianPhone}
                      onChange={(e) => setEditGuardianPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Guardian Email
                    </label>
                    <input
                      type="email"
                      value={editGuardianEmail}
                      onChange={(e) => setEditGuardianEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
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
      {isDeactivateModalOpen && deactivatingStudent && (
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
                  Deactivate Student Record
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to deactivate {deactivatingStudent.firstName} {deactivatingStudent.lastName}?
                </p>
              </div>
            </div>

            {deactivateModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {deactivateModalError}
              </div>
            )}

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              Are you sure? This student will be hidden from active class lists. Their historical attendance and academic records will remain intact.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeactivateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
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
                  <span>Deactivate Student</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
