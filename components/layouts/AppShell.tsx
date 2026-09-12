"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthUser, NavItem, ShellTheme } from "./nav.types";
import { AppSidebar } from "./AppSidebar";

export interface AppShellProps {
  children: ReactNode;
  allowedRoles: string[];
  navItems: NavItem[] | ((user: AuthUser) => NavItem[]);
  portalName: string | ((user: AuthUser) => string);
  roleTitle: string | ((user: AuthUser) => string);
  badgeLabel?: string | ((user: AuthUser) => string);
  headerTitle?: string | ((user: AuthUser) => string);
  brandLetter?: string;
  brandIcon?: ReactNode;
  brandTitle?: string;
  theme?: ShellTheme;
  collapsible?: boolean;
}

export function AppShell({
  children,
  allowedRoles,
  navItems,
  portalName,
  roleTitle,
  badgeLabel,
  headerTitle,
  brandLetter = "E",
  brandIcon,
  brandTitle = "EduPulse",
  theme = "navy",
  collapsible = true,
}: AppShellProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Self Change Password Modal State
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [submittingSelfPassword, setSubmittingSelfPassword] = useState(false);
  const [selfPasswordError, setSelfPasswordError] = useState("");
  const [selfPasswordSuccess, setSelfPasswordSuccess] = useState("");

  const isIndigo = theme === "indigo";
  const themeClasses = isIndigo
    ? {
        spinner: "border-indigo-600",
        portalText: "text-indigo-600",
        btnHover: "hover:text-indigo-700 hover:bg-indigo-50",
        primaryBtn: "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800",
        ringFocus: "focus:ring-indigo-600",
      }
    : {
        spinner: "border-blue-600",
        portalText: "text-slate-400",
        btnHover: "hover:text-blue-700 hover:bg-blue-50",
        primaryBtn: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
        ringFocus: "focus:ring-blue-600",
      };

  // Hydrate collapsed preference from localStorage
  useEffect(() => {
    if (!collapsible) return;
    try {
      const stored = localStorage.getItem("edupulse_sidebar_collapsed");
      if (stored === "true") {
        setIsCollapsed(true);
      }
    } catch {
      // ignore storage access errors
    }
  }, [collapsible]);

  function handleToggleCollapsed(valueOrUpdater: boolean | ((prev: boolean) => boolean)) {
    setIsCollapsed((prev) => {
      const next = typeof valueOrUpdater === "function" ? valueOrUpdater(prev) : valueOrUpdater;
      try {
        localStorage.setItem("edupulse_sidebar_collapsed", String(next));
      } catch {
        // ignore storage access errors
      }
      return next;
    });
  }

  // Authentication & Role verification
  useEffect(() => {
    const token = localStorage.getItem("edupulse_token");
    const userJson = localStorage.getItem("edupulse_user");

    if (!token || !userJson) {
      router.push("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(userJson) as AuthUser;
      if (!allowedRoles.includes(parsedUser.role)) {
        router.push("/login");
        return;
      }
      setUser(parsedUser);
    } catch {
      router.push("/login");
      return;
    } finally {
      setLoading(false);
    }
  }, [router, allowedRoles]);

  function handleLogout() {
    localStorage.removeItem("edupulse_token");
    localStorage.removeItem("edupulse_user");
    document.cookie =
      "edupulse_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  }

  async function handleSelfChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSelfPasswordError("");
    setSelfPasswordSuccess("");

    if (newPass !== confirmPass) {
      setSelfPasswordError("New passwords do not match.");
      return;
    }

    if (newPass.length < 8) {
      setSelfPasswordError("New password must be at least 8 characters.");
      return;
    }

    try {
      setSubmittingSelfPassword(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSelfPasswordError(data.error || "Failed to change password.");
        return;
      }

      setSelfPasswordSuccess("Password updated successfully.");
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");

      // Update local storage user if mustChangePassword was true
      if (user && user.mustChangePassword) {
        const updatedUser = { ...user, mustChangePassword: false };
        setUser(updatedUser);
        localStorage.setItem("edupulse_user", JSON.stringify(updatedUser));
      }

      setTimeout(() => {
        setIsChangePasswordModalOpen(false);
        setSelfPasswordSuccess("");
      }, 1000);
    } catch (err: any) {
      setSelfPasswordError(err.message || "An error occurred.");
    } finally {
      setSubmittingSelfPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className={`w-10 h-10 border-4 ${themeClasses.spinner} border-t-transparent rounded-full animate-spin`} />
          <p className="text-slate-500 font-medium text-sm">Loading EduPulse...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const resolvedNavItems = typeof navItems === "function" ? navItems(user) : navItems;
  const resolvedPortalName = typeof portalName === "function" ? portalName(user) : portalName;
  const resolvedRoleTitle = typeof roleTitle === "function" ? roleTitle(user) : roleTitle;
  const resolvedBadgeLabel = badgeLabel
    ? typeof badgeLabel === "function"
      ? badgeLabel(user)
      : badgeLabel
    : user.schoolName
    ? `${user.schoolName}`
    : resolvedRoleTitle;

  const resolvedHeaderTitle = headerTitle
    ? typeof headerTitle === "function"
      ? headerTitle(user)
      : headerTitle
    : user.schoolName || "School Management Workspace";

  return (
    <div className="min-h-screen flex bg-[#f8fafc]">
      <AppSidebar
        user={user}
        navItems={resolvedNavItems}
        brandLetter={brandLetter}
        brandIcon={brandIcon}
        brandTitle={brandTitle}
        roleTitle={resolvedRoleTitle}
        theme={theme}
        collapsible={collapsible}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={handleToggleCollapsed}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg border border-slate-200 cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <div>
              <span className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.portalText} block`}>
                {resolvedPortalName}
              </span>
              <h2 className="text-sm font-bold text-slate-800 truncate">
                {resolvedHeaderTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-700">
                {user.firstName} {user.lastName}
              </span>
              {resolvedBadgeLabel && (
                <>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500 font-medium">
                    {resolvedBadgeLabel}
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsChangePasswordModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 ${themeClasses.btnHover} rounded-xl transition-colors cursor-pointer`}
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25z" />
              </svg>
              <span>Password</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Security Warning Banner if password was reset */}
        {user.mustChangePassword && (
          <div className="bg-amber-500 text-white px-4 sm:px-8 py-2.5 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-100 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>Your account password was reset by an administrator. Please set a personal password to secure your account.</span>
            </div>
            <button
              type="button"
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="bg-white text-amber-900 hover:bg-amber-50 px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ml-4"
            >
              Change Password Now
            </button>
          </div>
        )}

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Self-Service Change Password Modal */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs text-slate-900">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Change Your Password</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your account password to maintain security.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSelfChangePassword} autoComplete="off" className="space-y-4">
              {selfPasswordSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                  {selfPasswordSuccess}
                </div>
              )}

              {selfPasswordError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {selfPasswordError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ringFocus} focus:border-transparent outline-none font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password <span className="text-rose-500">* (Min 8 chars)</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ringFocus} focus:border-transparent outline-none font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ringFocus} focus:border-transparent outline-none font-mono`}
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSelfPassword}
                  className={`px-5 py-2 rounded-xl ${themeClasses.primaryBtn} text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer`}
                >
                  {submittingSelfPassword ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
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
