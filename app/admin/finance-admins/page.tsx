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

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addModalError, setAddModalError] = useState("");

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

  // Reset Password Modal State
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetTargetAdmin, setResetTargetAdmin] = useState<FinanceAdminUser | null>(null);
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
                        <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {admin.firstName[0]}
                          {admin.lastName[0]}
                        </div>
                        <span>
                          {admin.firstName} {admin.lastName}
                        </span>
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
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500 text-xs">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right text-xs">
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

      {/* Creation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add Finance Administrator</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add a new financial user account for your school.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
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
                  id="new_finance_admin_email"
                  name="new_finance_admin_email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. zainab@zenithacademy.com"
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
                  placeholder="e.g. 08012345678"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                />
              </div>

              {/* Password Section */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Account Password <span className="text-rose-500">* (Min 8 chars)</span>
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
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    id="new_finance_admin_password"
                    name="new_finance_admin_password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  {submittingAdd ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add Finance Admin</span>
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
                <h3 className="text-lg font-bold text-slate-900">Reset Staff Password</h3>
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
                    The staff member's password has been updated. Provide the new password below to the user.
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
                    Staff member will be prompted to set a personal password upon next login.
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
