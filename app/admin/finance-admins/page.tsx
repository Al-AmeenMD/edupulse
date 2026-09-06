"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FinanceAdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: string;
  schoolId: string;
  isActive: boolean;
  createdAt: string;
}

export default function FinanceAdminsPage() {
  const router = useRouter();
  const [financeAdmins, setFinanceAdmins] = useState<FinanceAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addModalError, setAddModalError] = useState("");

  // Add Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<FinanceAdminUser | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editModalError, setEditModalError] = useState("");

  // Deactivate / Reactivate Modal State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusTargetAdmin, setStatusTargetAdmin] = useState<FinanceAdminUser | null>(null);
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [statusModalError, setStatusModalError] = useState("");

  // Reset Password Modal State
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetTargetAdmin, setResetTargetAdmin] = useState<FinanceAdminUser | null>(null);
  const [resetGeneratedPassword, setResetGeneratedPassword] = useState("");
  const [submittingResetPassword, setSubmittingResetPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<string | null>(null);

  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  async function loadData(schoolId: string, token: string) {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/schools/${schoolId}/finance-admins`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to load finance administrators");
      }

      const data = await res.json();
      setFinanceAdmins(data.data || []);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading finance administrators");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("edupulse_token");
    const userJson = localStorage.getItem("edupulse_user");

    if (!token || !userJson) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(userJson);
      if (user.role !== "SCHOOL_ADMIN") {
        router.push("/login");
        return;
      }

      if (!user.schoolId) {
        setError("No school associated with your admin account");
        setLoading(false);
        return;
      }

      setCurrentSchoolId(user.schoolId);
      loadData(user.schoolId, token);
    } catch {
      router.push("/login");
    }
  }, [router]);

  // ---------------------------------------------------------------------------
  // Create Finance Admin Handlers
  // ---------------------------------------------------------------------------
  function handleOpenModal() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setShowPassword(false);
    setAddModalError("");
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
    setPassword(generatedPassword);
    setShowPassword(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setAddModalError("");

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setAddModalError("First name, last name, email, and password are required.");
      return;
    }

    if (password.length < 8) {
      setAddModalError("Password must be at least 8 characters.");
      return;
    }

    if (!currentSchoolId) {
      setAddModalError("School ID not found.");
      return;
    }

    try {
      setSubmittingAdd(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/schools/${currentSchoolId}/finance-admins`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password,
        }),
      });

      const resData = await res.json();

      if (res.status === 409) {
        setAddModalError("An account with this email address already exists in the system.");
        return;
      }

      if (!res.ok) {
        setAddModalError(resData.error || "Failed to create finance administrator.");
        return;
      }

      setIsAddModalOpen(false);
      setSuccess("Finance administrator created successfully.");
      loadData(currentSchoolId, token);
    } catch (err: any) {
      setAddModalError(err.message || "An error occurred while creating account.");
    } finally {
      setSubmittingAdd(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Edit Finance Admin Handlers
  // ---------------------------------------------------------------------------
  function handleOpenEditModal(admin: FinanceAdminUser) {
    setEditingAdmin(admin);
    setEditFirstName(admin.firstName);
    setEditLastName(admin.lastName);
    setEditEmail(admin.email);
    setEditPhone(admin.phone || "");
    setEditModalError("");
    setIsEditModalOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAdmin || !currentSchoolId) return;
    setEditModalError("");

    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      setEditModalError("First name, last name, and email are required.");
      return;
    }

    try {
      setSubmittingEdit(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/schools/${currentSchoolId}/finance-admins/${editingAdmin.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim().toLowerCase(),
          phone: editPhone.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setEditModalError("An account with this email address already exists.");
        return;
      }

      if (!res.ok) {
        setEditModalError(data.error || "Failed to update finance administrator.");
        return;
      }

      setIsEditModalOpen(false);
      setEditingAdmin(null);
      setSuccess("Finance administrator updated successfully.");
      loadData(currentSchoolId, token);
    } catch (err: any) {
      setEditModalError(err.message || "An error occurred while updating profile.");
    } finally {
      setSubmittingEdit(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Deactivate / Reactivate Handlers
  // ---------------------------------------------------------------------------
  function handleOpenStatusModal(admin: FinanceAdminUser) {
    setStatusTargetAdmin(admin);
    setStatusModalError("");
    setIsStatusModalOpen(true);
  }

  async function handleConfirmStatusToggle() {
    if (!statusTargetAdmin || !currentSchoolId) return;
    setStatusModalError("");

    const newStatus = !statusTargetAdmin.isActive;

    try {
      setSubmittingStatus(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/schools/${currentSchoolId}/finance-admins/${statusTargetAdmin.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: newStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusModalError(data.error || "Failed to update account status.");
        return;
      }

      setIsStatusModalOpen(false);
      const actionWord = newStatus ? "reactivated" : "deactivated";
      setSuccess(`Finance administrator ${actionWord} successfully.`);
      setStatusTargetAdmin(null);
      loadData(currentSchoolId, token);
    } catch (err: any) {
      setStatusModalError(err.message || "An error occurred while updating status.");
    } finally {
      setSubmittingStatus(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Reset Password Handlers
  // ---------------------------------------------------------------------------
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

  function handleOpenResetPasswordModal(admin: FinanceAdminUser) {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Finance Administrators
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            View and manage financial administrator user accounts for your school.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add Finance Admin</span>
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <Link
            href="/admin/teachers"
            className="border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm flex items-center gap-2"
          >
            <span>Teachers</span>
          </Link>
          <Link
            href="/admin/finance-admins"
            className="border-blue-600 text-blue-600 whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center gap-2"
          >
            <span>Finance Admins</span>
            <span className="bg-blue-100 text-blue-700 py-0.5 px-2.5 rounded-full text-xs font-semibold">
              {financeAdmins.length}
            </span>
          </Link>
        </nav>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess("")} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-700 hover:text-rose-900 font-bold text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Table Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-sm text-slate-500 font-medium">Loading finance administrators...</p>
          </div>
        ) : financeAdmins.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Finance Administrators Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No finance admin accounts exist for your school yet. Click "Add Finance Admin" above to add one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Name</th>
                  <th className="py-3.5 px-6">Email Address</th>
                  <th className="py-3.5 px-6">Phone</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Date Added</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {financeAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full border font-bold text-xs flex items-center justify-center shrink-0 ${
                          admin.isActive
                            ? "bg-blue-100 border-blue-200 text-blue-700"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}>
                          {admin.firstName[0]}
                          {admin.lastName[0]}
                        </div>
                        <div>
                          <span className={admin.isActive ? "text-slate-900" : "text-slate-500 line-through"}>
                            {admin.firstName} {admin.lastName}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-mono text-xs">{admin.email}</td>
                    <td className="py-4 px-6 text-slate-600 text-xs">{admin.phone || "—"}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                        FINANCE_ADMIN
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {admin.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-500 text-xs">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right text-xs">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(admin)}
                          className="px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold border border-slate-200 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenStatusModal(admin)}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold border transition-colors cursor-pointer ${
                            admin.isActive
                              ? "text-rose-700 hover:bg-rose-50 border-rose-200"
                              : "text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                          }`}
                        >
                          {admin.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenResetPasswordModal(admin)}
                          className="px-2.5 py-1.5 rounded-lg text-amber-700 hover:bg-amber-50 font-semibold border border-amber-200 transition-colors cursor-pointer"
                        >
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add Finance Administrator</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add a new financial user account for your school.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {addModalError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {addModalError}
              </div>
            )}

            <form onSubmit={handleCreate} autoComplete="off" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Zainab"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Bello"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="zainab.bello@school.edu"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Initial Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    Generate Secure
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingAdd ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Finance Administrator</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update profile information for {editingAdmin.firstName} {editingAdmin.lastName}.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingAdmin(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {editModalError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {editModalError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} autoComplete="off" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="e.g. Zainab"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="e.g. Bello"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="zainab.bello@school.edu"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Note: Updating email changes the user&apos;s login identifier.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingAdmin(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate / Reactivate Confirmation Modal */}
      {isStatusModalOpen && statusTargetAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                statusTargetAdmin.isActive
                  ? "bg-rose-100 text-rose-600"
                  : "bg-emerald-100 text-emerald-600"
              }`}>
                {statusTargetAdmin.isActive ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {statusTargetAdmin.isActive ? "Deactivate Finance Administrator" : "Reactivate Finance Administrator"}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {statusTargetAdmin.isActive ? (
                    <>
                      Are you sure you want to deactivate <strong className="text-slate-800 font-semibold">{statusTargetAdmin.firstName} {statusTargetAdmin.lastName}</strong> ({statusTargetAdmin.email})? They will be unable to log in, but all historical financial records and payment attributions will be preserved.
                    </>
                  ) : (
                    <>
                      Are you sure you want to reactivate <strong className="text-slate-800 font-semibold">{statusTargetAdmin.firstName} {statusTargetAdmin.lastName}</strong> ({statusTargetAdmin.email})? They will regain access to financial management features immediately.
                    </>
                  )}
                </p>
              </div>
            </div>

            {statusModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {statusModalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setStatusTargetAdmin(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                disabled={submittingStatus}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer ${
                  statusTargetAdmin.isActive
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {submittingStatus
                  ? "Processing..."
                  : statusTargetAdmin.isActive
                  ? "Deactivate Account"
                  : "Reactivate Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordModalOpen && resetTargetAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Reset Password</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate a new temporary password for {resetTargetAdmin.firstName} {resetTargetAdmin.lastName}.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsResetPasswordModalOpen(false);
                  setResetTargetAdmin(null);
                  setResetPasswordSuccess(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {resetPasswordError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {resetPasswordError}
              </div>
            )}

            {resetPasswordSuccess ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                    </svg>
                    <span>Password Reset Successful!</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Provide this temporary password to the finance administrator. They will be required to change it upon next login.
                  </p>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200 font-mono text-sm font-bold text-slate-900 select-all tracking-wider text-center">
                    {resetPasswordSuccess}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetPasswordModalOpen(false);
                      setResetTargetAdmin(null);
                      setResetPasswordSuccess(null);
                    }}
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                  Resetting the password will immediately replace the user&apos;s current password and flag their account to require a password change on next login.
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      New Temporary Password
                    </label>
                    <button
                      type="button"
                      onClick={generateAdminResetPassword}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                    >
                      Generate New
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={resetGeneratedPassword}
                    onChange={(e) => setResetGeneratedPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-mono font-semibold"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetPasswordModalOpen(false);
                      setResetTargetAdmin(null);
                    }}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingResetPassword}
                    className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submittingResetPassword ? "Resetting..." : "Confirm Reset"}
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
