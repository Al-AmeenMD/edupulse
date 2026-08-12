"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface School {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    students: number;
  };
}

export default function SchoolsListPage() {
  const router = useRouter();

  // Data state
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modal states: 'none' | 'add-school' | 'edit-school' | 'deactivate-confirm'
  const [modalMode, setModalMode] = useState<"none" | "add-school" | "edit-school" | "deactivate-confirm">("none");
  const [addStep, setAddStep] = useState<1 | 2>(1);

  // Form states for Add School (Step 1)
  const [addSchoolForm, setAddSchoolForm] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
  });

  // State for newly created school (passed to Step 2)
  const [createdSchool, setCreatedSchool] = useState<{ id: string; name: string } | null>(null);

  // Form states for Create Admin (Step 2)
  const [createAdminForm, setCreateAdminForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Edit School state
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [editSchoolForm, setEditSchoolForm] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
  });

  // Modal loading and error state
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Check auth & fetch schools
  const fetchSchools = useCallback(async () => {
    try {
      setError("");
      const token = localStorage.getItem("edupulse_token");
      const userJson = localStorage.getItem("edupulse_user");

      if (!token || !userJson) {
        router.push("/login");
        return;
      }

      const parsedUser = JSON.parse(userJson);
      if (parsedUser.role !== "SUPER_ADMIN") {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      if (statusFilter === "ACTIVE") {
        params.append("isActive", "true");
      } else if (statusFilter === "INACTIVE") {
        params.append("isActive", "false");
      }

      const url = `/api/schools${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to fetch schools");
      }

      const json = await res.json();
      setSchools(json.data || []);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading schools");
    } finally {
      setLoading(false);
    }
  }, [router, searchQuery, statusFilter]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  // Modal resets
  function closeModal() {
    setModalMode("none");
    setAddStep(1);
    setModalError("");
    setModalSubmitting(false);
    setAddSchoolForm({ name: "", email: "", address: "", phone: "" });
    setCreatedSchool(null);
    setCreateAdminForm({ firstName: "", lastName: "", email: "", phone: "", password: "" });
    setSelectedSchool(null);
    setEditSchoolForm({ name: "", email: "", address: "", phone: "" });
  }

  // Handle Step 1: Create School
  async function handleCreateSchool(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");

    if (!addSchoolForm.name.trim()) {
      setModalError("School name is required");
      return;
    }

    try {
      setModalSubmitting(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/schools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: addSchoolForm.name.trim(),
          email: addSchoolForm.email.trim() || undefined,
          address: addSchoolForm.address.trim() || undefined,
          phone: addSchoolForm.phone.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create school");
      }

      const school = json.data;
      setCreatedSchool({ id: school.id, name: school.name });
      setAddStep(2);
      fetchSchools();
    } catch (err: any) {
      setModalError(err.message || "An error occurred while creating school");
    } finally {
      setModalSubmitting(false);
    }
  }

  // Handle Step 2: Create Admin
  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");

    if (!createdSchool) {
      setModalError("Missing created school reference");
      return;
    }

    if (
      !createAdminForm.firstName.trim() ||
      !createAdminForm.lastName.trim() ||
      !createAdminForm.email.trim() ||
      !createAdminForm.password
    ) {
      setModalError("First name, last name, email, and password are required");
      return;
    }

    if (createAdminForm.password.length < 8) {
      setModalError("Password must be at least 8 characters long");
      return;
    }

    try {
      setModalSubmitting(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/schools/${createdSchool.id}/admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: createAdminForm.firstName.trim(),
          lastName: createAdminForm.lastName.trim(),
          email: createAdminForm.email.trim(),
          phone: createAdminForm.phone.trim() || undefined,
          password: createAdminForm.password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create school admin");
      }

      // Success! Close modal and refresh list
      closeModal();
      fetchSchools();
    } catch (err: any) {
      // Retain createdSchool and stay on Step 2 so user can correct errors and retry
      setModalError(err.message || "An error occurred while creating admin");
    } finally {
      setModalSubmitting(false);
    }
  }

  // Open Edit Modal
  function openEditModal(school: School) {
    setSelectedSchool(school);
    setEditSchoolForm({
      name: school.name || "",
      email: school.email || "",
      address: school.address || "",
      phone: school.phone || "",
    });
    setModalError("");
    setModalMode("edit-school");
  }

  // Handle Edit School Submit
  async function handleUpdateSchool(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSchool) return;
    setModalError("");

    if (!editSchoolForm.name.trim()) {
      setModalError("School name is required");
      return;
    }

    try {
      setModalSubmitting(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/schools/${selectedSchool.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editSchoolForm.name.trim(),
          email: editSchoolForm.email.trim() || undefined,
          address: editSchoolForm.address.trim() || undefined,
          phone: editSchoolForm.phone.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update school");
      }

      closeModal();
      fetchSchools();
    } catch (err: any) {
      setModalError(err.message || "An error occurred while updating school");
    } finally {
      setModalSubmitting(false);
    }
  }

  // Handle Deactivate School
  async function handleDeactivateSchool() {
    if (!selectedSchool) return;
    setModalError("");

    try {
      setModalSubmitting(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/schools/${selectedSchool.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to deactivate school");
      }

      closeModal();
      fetchSchools();
    } catch (err: any) {
      setModalError(err.message || "An error occurred while deactivating school");
    } finally {
      setModalSubmitting(false);
    }
  }

  // Handle Reactivate School
  async function handleReactivateSchool(school: School) {
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/schools/${school.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: true,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to reactivate school");
      }

      fetchSchools();
    } catch (err: any) {
      setError(err.message || "Failed to reactivate school");
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Schools Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Register, configure, and monitor all schools across the EduPulse network.
          </p>
        </div>

        <button
          onClick={() => {
            setAddStep(1);
            setModalError("");
            setModalMode("add-school");
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add School
        </button>
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

      {/* Search & Status Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by school name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Schools
          </button>
          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              statusFilter === "ACTIVE"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter("INACTIVE")}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              statusFilter === "INACTIVE"
                ? "bg-white text-rose-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Main Content Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : schools.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-800">No schools found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "ALL"
                ? "No schools match your current search and filter settings. Try adjusting your search query."
                : "There are no schools registered in the system yet. Click below to add your first school."}
            </p>
            {!searchQuery && statusFilter === "ALL" && (
              <button
                onClick={() => {
                  setAddStep(1);
                  setModalError("");
                  setModalMode("add-school");
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                + Add First School
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">School Name</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4 text-center">Students</th>
                  <th className="px-6 py-4 text-center">Teachers/Users</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {schools.map((school) => {
                  const studentCount = school._count?.students ?? 0;
                  const userCount = school._count?.users ?? 0;

                  return (
                    <tr key={school.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name */}
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        <Link
                          href={`/super-admin/schools/${school.id}`}
                          className="hover:text-blue-600 transition-colors inline-flex items-center gap-2"
                        >
                          <span>{school.name}</span>
                        </Link>
                        {school.address && (
                          <p className="text-xs text-slate-400 font-normal mt-0.5 truncate max-w-xs">
                            {school.address}
                          </p>
                        )}
                      </td>

                      {/* Contact Info */}
                      <td className="px-6 py-4 text-slate-600 text-xs space-y-0.5">
                        {school.email ? (
                          <p className="font-medium text-slate-800">{school.email}</p>
                        ) : (
                          <p className="text-slate-400 italic">No email</p>
                        )}
                        {school.phone && <p className="text-slate-500">{school.phone}</p>}
                      </td>

                      {/* Students Count */}
                      <td className="px-6 py-4 text-center font-medium text-slate-700">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 font-semibold">
                          {studentCount}
                        </span>
                      </td>

                      {/* Teachers/Users Count */}
                      <td className="px-6 py-4 text-center font-medium text-slate-700">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 font-semibold">
                          {userCount}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {school.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/super-admin/schools/${school.id}`}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-1"
                          >
                            <span>View</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                          </Link>

                          <button
                            onClick={() => openEditModal(school)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Edit
                          </button>

                          {school.isActive ? (
                            <button
                              onClick={() => {
                                setSelectedSchool(school);
                                setModalError("");
                                setModalMode("deactivate-confirm");
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateSchool(school)}
                              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
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

      {/* ================================================================== */}
      {/* 1. MODAL: Add School & Create Admin (2-Step Flow)                  */}
      {/* ================================================================== */}
      {modalMode === "add-school" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    Step {addStep} of 2
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">
                    {addStep === 1 ? "Add New School" : `Create Admin for ${createdSchool?.name}`}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {addStep === 1
                    ? "Enter core school details to register a new tenant."
                    : "Create the primary administrator account for this school."}
                </p>
              </div>

              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {modalError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}

              {/* STEP 1: Add School Form */}
              {addStep === 1 && (
                <form onSubmit={handleCreateSchool} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      School Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. St. Andrews Academy"
                      value={addSchoolForm.name}
                      onChange={(e) => setAddSchoolForm({ ...addSchoolForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="info@standrews.edu"
                        value={addSchoolForm.email}
                        onChange={(e) => setAddSchoolForm({ ...addSchoolForm, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+234 800 000 0000"
                        value={addSchoolForm.phone}
                        onChange={(e) => setAddSchoolForm({ ...addSchoolForm, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Address
                    </label>
                    <textarea
                      rows={2}
                      placeholder="School street address and city..."
                      value={addSchoolForm.address}
                      onChange={(e) => setAddSchoolForm({ ...addSchoolForm, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all resize-none"
                    />
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalSubmitting}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      {modalSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Creating School...</span>
                        </>
                      ) : (
                        <>
                          <span>Next: Add Admin</span>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Create Admin Form */}
              {addStep === 2 && (
                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5">
                    <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                    </svg>
                    <span>
                      School <strong>{createdSchool?.name}</strong> registered successfully! Set up the school administrator below.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="John"
                        value={createAdminForm.firstName}
                        onChange={(e) => setCreateAdminForm({ ...createAdminForm, firstName: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Doe"
                        value={createAdminForm.lastName}
                        onChange={(e) => setCreateAdminForm({ ...createAdminForm, lastName: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="admin@school.com"
                        value={createAdminForm.email}
                        onChange={(e) => setCreateAdminForm({ ...createAdminForm, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        placeholder="+234 800 000 0000"
                        value={createAdminForm.phone}
                        onChange={(e) => setCreateAdminForm({ ...createAdminForm, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password <span className="text-red-500">* (Min 8 chars)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={createAdminForm.password}
                        onChange={(e) => setCreateAdminForm({ ...createAdminForm, password: e.target.value })}
                        className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                      >
                        {showAdminPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Skip for Now
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={modalSubmitting}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                      >
                        {modalSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Creating Admin...</span>
                          </>
                        ) : (
                          <span>Complete Setup</span>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* 2. MODAL: Edit School                                              */}
      {/* ================================================================== */}
      {modalMode === "edit-school" && selectedSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit School Details</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update metadata for <strong>{selectedSchool.name}</strong>
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateSchool} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editSchoolForm.name}
                  onChange={(e) => setEditSchoolForm({ ...editSchoolForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editSchoolForm.email}
                    onChange={(e) => setEditSchoolForm({ ...editSchoolForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editSchoolForm.phone}
                    onChange={(e) => setEditSchoolForm({ ...editSchoolForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={editSchoolForm.address}
                  onChange={(e) => setEditSchoolForm({ ...editSchoolForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving Changes...</span>
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

      {/* ================================================================== */}
      {/* 3. MODAL: Deactivate Confirmation Dialog                          */}
      {/* ================================================================== */}
      {modalMode === "deactivate-confirm" && selectedSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-6 space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Deactivate {selectedSchool.name}?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  This will set the school status to <strong>Inactive</strong>. School staff and admins will no longer be able to access their portal. Historical records will be preserved.
                </p>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium text-left">
                  {modalError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={modalSubmitting}
                  onClick={handleDeactivateSchool}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Deactivating...</span>
                    </>
                  ) : (
                    <span>Yes, Deactivate</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
