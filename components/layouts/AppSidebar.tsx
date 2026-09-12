"use client";

import { Suspense, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NavItem, AuthUser, ShellTheme } from "./nav.types";

export interface AppSidebarProps {
  user: AuthUser;
  navItems: NavItem[];
  brandLetter?: string;
  brandIcon?: ReactNode;
  brandTitle?: string;
  roleTitle: string;
  theme?: ShellTheme;
  collapsible?: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
}

function AppSidebarInner({
  user,
  navItems,
  brandLetter = "E",
  brandIcon,
  brandTitle = "EduPulse",
  roleTitle,
  theme = "navy",
  collapsible = true,
  mobileMenuOpen,
  setMobileMenuOpen,
  isCollapsed,
  setIsCollapsed,
}: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams ? searchParams.get("tab") : null;

  const isEffectiveCollapsed = collapsible && isCollapsed;

  const isIndigo = theme === "indigo";
  const themeClasses = isIndigo
    ? {
        bg: "bg-[#1e1b4b]",
        subBg: "bg-[#151238]",
        border: "border-indigo-900/60",
        badge: "bg-indigo-600",
        subtitle: "text-indigo-300",
        active: "bg-indigo-600 text-white shadow-xs font-semibold",
        inactive: "text-slate-300 hover:bg-indigo-900/40 hover:text-white",
        inactiveIcon: "text-indigo-300",
        avatar: "bg-indigo-500/20 border-indigo-400/30 text-indigo-300",
      }
    : {
        bg: "bg-[#1e3a5f]",
        subBg: "bg-[#162a45]",
        border: "border-slate-700/60",
        badge: "bg-blue-600",
        subtitle: "text-blue-300",
        active: "bg-blue-600 text-white shadow-xs font-semibold",
        inactive: "text-slate-300 hover:bg-slate-800/60 hover:text-white",
        inactiveIcon: "text-slate-400 group-hover:text-slate-200",
        avatar: "bg-blue-500/20 border-blue-400/30 text-blue-300",
      };

  function checkIsActive(href: string) {
    if (href.includes("?")) {
      const [path, queryStr] = href.split("?");
      if (pathname !== path) return false;
      const targetTab = new URLSearchParams(queryStr).get("tab");
      if (targetTab === "student_fees") {
        return currentTab === "student_fees" || currentTab === "students";
      }
      if (targetTab === "structures") {
        return currentTab === "structures" || !currentTab;
      }
      return currentTab === targetTab;
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  const userInitialFirst = user.firstName ? user.firstName[0].toUpperCase() : "U";
  const userInitialLast = user.lastName ? user.lastName[0].toUpperCase() : "";

  return (
    <>
      {/* Desktop Sticky Viewport Sidebar */}
      <aside
        className={`hidden lg:flex flex-col sticky top-0 h-screen ${themeClasses.bg} text-white shrink-0 shadow-xl z-20 transition-all duration-300 ease-in-out ${
          isEffectiveCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand & Toggle Header */}
        <div
          className={`h-16 flex items-center border-b ${themeClasses.border} ${themeClasses.subBg} transition-all duration-300 ${
            isEffectiveCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className={`h-9 w-9 rounded-xl ${themeClasses.badge} flex items-center justify-center font-bold text-white shadow-md text-base shrink-0`}
            >
              {brandIcon || brandLetter}
            </div>
            {!isEffectiveCollapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <span className="font-bold text-lg tracking-tight text-white block leading-tight truncate">
                  {brandTitle}
                </span>
                <span className={`text-[10px] uppercase font-semibold ${themeClasses.subtitle} tracking-wider block truncate`}>
                  {roleTitle}
                </span>
              </div>
            )}
          </div>

          {collapsible && !isEffectiveCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              title="Collapse Sidebar"
              className="text-slate-400 hover:text-white hover:bg-slate-800/80 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
        </div>

        {/* Collapsed Expand Trigger Subheader */}
        {collapsible && isEffectiveCollapsed && (
          <div className={`flex justify-center py-2 border-b ${themeClasses.border} ${themeClasses.subBg}/40`}>
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              title="Expand Sidebar"
              className="text-slate-400 hover:text-white hover:bg-slate-800/80 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = checkIsActive(item.href);

            return (
              <div key={item.name} className="relative group">
                <Link
                  href={item.href}
                  title={isEffectiveCollapsed ? item.name : undefined}
                  className={`flex items-center rounded-xl text-sm font-medium transition-all ${
                    isEffectiveCollapsed
                      ? "justify-center px-0 py-2.5 w-full"
                      : "gap-3 px-3.5 py-2.5"
                  } ${isActive ? themeClasses.active : themeClasses.inactive}`}
                >
                  <span
                    className={`shrink-0 ${
                      isActive ? "text-white" : themeClasses.inactiveIcon
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!isEffectiveCollapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                </Link>

                {/* Instant Floating CSS Tooltip for Collapsed Mode */}
                {isEffectiveCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:flex items-center z-50 pointer-events-none">
                    <div className="bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-slate-700/80">
                      {item.name}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Desktop Sidebar Footer */}
        <div
          className={`border-t ${themeClasses.border} ${themeClasses.subBg}/50 transition-all duration-300 ${
            isEffectiveCollapsed ? "p-3 flex justify-center" : "p-4"
          }`}
        >
          {isEffectiveCollapsed ? (
            <div className="relative group">
              <div
                className={`h-9 w-9 rounded-full ${themeClasses.avatar} border flex items-center justify-center font-semibold text-sm cursor-default`}
              >
                {userInitialFirst}
                {userInitialLast}
              </div>
              <div className="absolute left-full bottom-0 ml-3 hidden group-hover:flex items-center z-50 pointer-events-none">
                <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap border border-slate-700/80">
                  <p className="font-semibold text-white">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[11px] text-slate-400">{user.email}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-full ${themeClasses.avatar} border flex items-center justify-center font-semibold text-sm shrink-0`}
              >
                {userInitialFirst}
                {userInitialLast}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer (Collapsible) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className={`relative flex flex-col w-64 ${themeClasses.bg} text-white z-10 shadow-2xl`}>
            <div className={`h-16 flex items-center justify-between px-6 border-b ${themeClasses.border} ${themeClasses.subBg}`}>
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg ${themeClasses.badge} flex items-center justify-center font-bold text-white text-sm`}>
                  {brandIcon || brandLetter}
                </div>
                <span className="font-bold text-base text-white">{brandTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = checkIsActive(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive ? themeClasses.active : themeClasses.inactive
                    }`}
                  >
                    <span className={isActive ? "text-white" : themeClasses.inactiveIcon}>
                      {item.icon}
                    </span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className={`p-4 border-t ${themeClasses.border} ${themeClasses.subBg}/50`}>
              <p className="text-xs font-semibold text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  return (
    <Suspense fallback={null}>
      <AppSidebarInner {...props} />
    </Suspense>
  );
}
