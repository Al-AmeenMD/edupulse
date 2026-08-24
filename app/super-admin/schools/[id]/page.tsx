"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface SchoolDetail {
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
    classes: number;
  };
}

interface SchoolAdmin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  schoolId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SchoolDetailPage() {
  const router = useRouter();
  const params = useParams();
  const schoolId = params?.id as string;

  // Main data state
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [admins, setAdmins] = useState<SchoolAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [error, setError] = useState("");

  // Tab state: 'overview' | 'admins'
  const [activeTab, setActiveTab] = useState<"overview" | "admins">("overview");

  // Inline editing state for School details
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Modal for Add Admin inside Admins tab
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [addAdminForm, setAddAdminForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminModalSubmitting, setAdminModalSubmitting] = useState(false);
  const [adminModalError, setAdminModalError] = useState("");

  // Reset Password Modal State
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetTargetAdmin, setResetTargetAdmin] = useState<SchoolAdmin | null>(null);
  const [resetGeneratedPassword, setResetGeneratedPassword] = useState("");
  const [submittingResetPassword, setSubmittingResetPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<string | null>(null);

  function generateAdminResetPassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const array = new Uint32Array(12);
    crypto.getRandomValues(array);
    let generatedPassword = "";
    for (let i = 0; i < array.length; i++) {
      generatedPassword += chars[array[i] % chars.length];
    }
    setResetGeneratedPassword(generatedPassword);
  }

  function handleOpenResetPasswordModal(admin: SchoolAdmin) {
    setResetTargetAdmin(admin);
    setResetPasswordError("");
    setResetPasswordSuccess(null);
    generateAdminResetPassword();
    setIsResetPasswordModalOpen(true);
  }

  async function handleConfirmResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTargetAdmin) return;
    setResetPasswordError("");
    setResetPasswordSuccess(null);

    try {
      setSubmittingResetPassword(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/users/${resetTargetAdmin.id}/reset-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword: resetGeneratedPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResetPasswordError(data.error || "Failed to reset password.");
        return;
      }

      setResetPasswordSuccess(data.newPassword || resetGeneratedPassword);
    } catch (err: any) {
      setResetPasswordError(err.message || "An error occurred.");
    } finally {
      setSubmittingResetPassword(false);
    }
  }

  // Fetch single school details
  const fetchSchoolDetail = useCallback(async () => {
    if (!schoolId) return;
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

      const res = await fetch(`/api/schools/${schoolId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load school details");
      }

      const json = await res.json();
      setSchool(json.data);
      setEditForm({
        name: json.data.name || "",
        email: json.data.email || "",
        address: json.data.address || "",
        phone: json.data.phone || "",
      });
    } catch (err: any) {
      setError(err.message || "An error occurred while loading school details");
    } finally {
      setLoading(false);
    }
  }, [schoolId, router]);

  // Fetch school admins list
  const fetchSchoolAdmins = useCallback(async () => {
    if (!schoolId) return;
    try {
      setAdminsLoading(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/schools/${schoolId}/admins`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load school admins");
      }

      const json = await res.json();
      setAdmins(json.data || []);
    } catch (err: any) {
      console.error("Error loading admins:", err);
    } finally {
      setAdminsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchSchoolDetail();
  }, [fetchSchoolDetail]);

  useEffect(() => {
    if (activeTab === "admins") {
      fetchSchoolAdmins();
    }
  }, [activeTab, fetchSchoolAdmins]);

  // Save Inline Edit for School metadata
  async function handleSaveInlineEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");

    if (!editForm.name.trim()) {
      setEditError("School name is required");
      return;
    }

    try {
      setSavingEdit(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/schools/${schoolId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim() || undefined,
          address: editForm.address.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update school details");
      }

      setIsEditing(false);
      fetchSchoolDetail();
    } catch (err: any) {
      setEditError(err.message || "Failed to save edits");
    } finally {
      setSavingEdit(false);
    }
  }

  // Handle Add Admin Submit
  async function handleAddAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAdminModalError("");

    if (
      !addAdminForm.firstName.trim() ||
      !addAdminForm.lastName.trim() ||
      !addAdminForm.email.trim() ||
      !addAdminForm.password
    ) {
      setAdminModalError("First name, last name, email, and password are required");
      return;
    }

    if (addAdminForm.password.length < 8) {
      setAdminModalError("Password must be at least 8 characters long");
      return;
    }

    try {
      setAdminModalSubmitting(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/schools/${schoolId}/admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: addAdminForm.firstName.trim(),
          lastName: addAdminForm.lastName.trim(),
          email: addAdminForm.email.trim(),
          phone: addAdminForm.phone.trim() || undefined,
          password: addAdminForm.password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create administrator");
      }

      setShowAddAdminModal(false);
      setAddAdminForm({ firstName: "", lastName: "", email: "", phone: "", password: "" });
      fetchSchoolAdmins();
      fetchSchoolDetail();
    } catch (err: any) {
      setAdminModalError(err.message || "Failed to add admin");
    } finally {
      setAdminModalSubmitting(false);
    }
  }

  // Toggle School Active / Inactive
  async function handleToggleSchoolStatus() {
    if (!school) return;
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const newStatus = !school.isActive;
      const res = await fetch(`/api/schools/${schoolId}`, {
        method: newStatus ? "PATCH" : "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        ...(newStatus ? { body: JSON.stringify({ isActive: true }) } : {}),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update school status");
      }

      fetchSchoolDetail();
    } catch (err: any) {
      setError(err.message || "Error updating status");
      setTimeout(() => setError(""), 4000);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded-md"></div>
        <div className="h-10 w-72 bg-slate-200 rounded-xl"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="h-28 bg-slate-200 rounded-2xl"></div>
          <div className="h-28 bg-slate-200 rounded-2xl"></div>
          <div className="h-28 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error || !school) {
    return (
      <div className="space-y-6">
        <Link
          href="/super-admin/schools"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Schools
        </Link>

        <div className="p-6 bg-white rounded-2xl border border-red-200 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900">School Not Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {error || "The requested school record does not exist or you do not have permission to view it."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <div>
        <Link
          href="/super-admin/schools"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Schools List
        </Link>
      </div>

      {/* Main School Title & Action Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 font-bold text-xl">
            {school.name.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {school.name}
              </h1>

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
            </div>

            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-4">
              <span>Registered on {new Date(school.createdAt).toLocaleDateString()}</span>
              {school.email && <span>• {school.email}</span>}
              {school.phone && <span>• {school.phone}</span>}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            {isEditing ? "Cancel Edit" : "Edit Profile"}
          </button>

          <button
            onClick={handleToggleSchoolStatus}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              school.isActive
                ? "text-rose-700 bg-rose-50 hover:bg-rose-100"
                : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
            }`}
          >
            {school.isActive ? "Deactivate School" : "Reactivate School"}
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Teachers / Users */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Teachers & Staff
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {school._count?.users ?? 0}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Enrolled Students
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {school._count?.students ?? 0}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Classes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Classes
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {school._count?.classes ?? 0}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="border-b border-slate-200 flex items-center gap-8">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "overview"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Overview & Profile
        </button>

        <button
          onClick={() => setActiveTab("admins")}
          className={`pb-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "admins"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          School Administrators ({admins.length || school._count?.users || 0})
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900">School Profile Metadata</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Edit Profile
              </button>
            )}
          </div>

          {editError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {editError}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSaveInlineEdit} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">School Name</p>
                  <p className="font-semibold text-slate-900 text-base mt-0.5">{school.name}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Official Email</p>
                  <p className="font-medium text-slate-800 mt-0.5">{school.email || "Not specified"}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phone Number</p>
                  <p className="font-medium text-slate-800 mt-0.5">{school.phone || "Not specified"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Street Address</p>
                  <p className="font-medium text-slate-800 mt-0.5">{school.address || "Not specified"}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tenant Status</p>
                  <p className="font-semibold mt-0.5">
                    {school.isActive ? (
                      <span className="text-emerald-600">Active Tenant</span>
                    ) : (
                      <span className="text-rose-600">Inactive / Suspended</span>
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Date Created</p>
                  <p className="font-medium text-slate-800 mt-0.5">
                    {new Date(school.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCHOOL ADMINS */}
      {activeTab === "admins" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">School Administrators</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Staff accounts with full administrative control over this school tenant.
              </p>
            </div>

            <button
              onClick={() => {
                setAdminModalError("");
                setShowAddAdminModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add School Admin
            </button>
          </div>

          {adminsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : admins.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No administrators found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                This school has no linked school administrators yet. Create an account to grant administrative access.
              </p>
              <button
                onClick={() => {
                  setAdminModalError("");
                  setShowAddAdminModal(true);
                }}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
              >
                + Add Administrator
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Administrator Name</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Phone</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Created Date</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-semibold text-slate-900">
                        {admin.firstName} {admin.lastName}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 font-medium text-xs">
                        {admin.email}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 text-xs">
                        {admin.phone || "N/A"}
                      </td>
                      <td className="px-6 py-3.5">
                        {admin.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3.5 text-right text-xs">
                        <button
                          onClick={() => handleOpenResetPasswordModal(admin)}
                          className="px-3 py-1.5 rounded-lg text-amber-700 hover:bg-amber-50 font-semibold border border-amber-200 transition-colors cursor-pointer"
                        >
                          Reset Password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: Add School Admin                                            */}
      {/* ================================================================== */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add School Administrator</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create a new administrator account for <strong>{school.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowAddAdminModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddAdminSubmit} className="p-6 space-y-4">
              {adminModalError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{adminModalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Jane"
                    value={addAdminForm.firstName}
                    onChange={(e) => setAddAdminForm({ ...addAdminForm, firstName: e.target.value })}
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
                    placeholder="Smith"
                    value={addAdminForm.lastName}
                    onChange={(e) => setAddAdminForm({ ...addAdminForm, lastName: e.target.value })}
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
                    value={addAdminForm.email}
                    onChange={(e) => setAddAdminForm({ ...addAdminForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={addAdminForm.phone}
                    onChange={(e) => setAddAdminForm({ ...addAdminForm, phone: e.target.value })}
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
                    value={addAdminForm.password}
                    onChange={(e) => setAddAdminForm({ ...addAdminForm, password: e.target.value })}
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

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminModalSubmitting}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {adminModalSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Administrator</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordModalOpen && resetTargetAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reset School Admin Password</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reset password for {resetTargetAdmin.firstName} {resetTargetAdmin.lastName} ({resetTargetAdmin.email})
                </p>
              </div>
              <button
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {resetPasswordSuccess ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                    </svg>
                    <span>Password Reset Successfully!</span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    The administrator's password has been updated. Provide the new password below to the user.
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-emerald-300 flex items-center justify-between font-mono text-sm font-bold text-slate-900">
                    <span>{resetPasswordSuccess}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(resetPasswordSuccess)}
                      className="px-2.5 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md font-sans transition-colors cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordModalOpen(false)}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                {resetPasswordError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                    {resetPasswordError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      New Generated Password
                    </label>
                    <button
                      type="button"
                      onClick={generateAdminResetPassword}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      <span>Regenerate</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={resetGeneratedPassword}
                    onChange={(e) => setResetGeneratedPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-mono font-semibold text-slate-900"
                  />
                  <p className="text-[11px] text-slate-500">
                    Administrator will be prompted to set a personal password upon next login.
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingResetPassword}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {submittingResetPassword ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Resetting...</span>
                      </>
                    ) : (
                      <span>Confirm Reset Password</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
