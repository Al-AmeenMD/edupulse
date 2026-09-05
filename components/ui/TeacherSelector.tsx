"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

export interface TeacherItem {
  id: string; // Teacher ID (CUID)
  userId: string;
  employeeId?: string | null;
  qualification?: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  };
  [key: string]: any;
}

export interface TeacherSelectorProps {
  teachers: TeacherItem[];
  value: string; // Selected teacher ID
  onChange: (teacherId: string, teacher?: TeacherItem) => void;
  classes?: Array<{ id: string; name: string; teacherId?: string | null }>;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function TeacherSelector({
  teachers,
  value,
  onChange,
  classes = [],
  placeholder = "Select Class Teacher (Optional)",
  label,
  required = false,
  disabled = false,
  error,
  className = "",
}: TeacherSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<"ALL" | "ASSIGNED" | "UNASSIGNED">("ALL");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "classes_desc" | "employeeId_asc">("name_asc");

  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Derive map of teacherId -> assigned classes from classes prop
  const teacherClassesMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>();
    if (!classes || classes.length === 0) return map;
    classes.forEach((cls) => {
      if (cls.teacherId) {
        const existing = map.get(cls.teacherId) || [];
        existing.push({ id: cls.id, name: cls.name });
        map.set(cls.teacherId, existing);
      }
    });
    return map;
  }, [classes]);

  // Find currently selected teacher
  const selectedTeacher = useMemo(() => {
    if (!value) return null;
    return teachers.find((t) => t.id === value || t.userId === value) || null;
  }, [teachers, value]);

  // Helper to get initials
  function getInitials(firstName?: string, lastName?: string): string {
    const f = (firstName || "").charAt(0).toUpperCase();
    const l = (lastName || "").charAt(0).toUpperCase();
    return `${f}${l}` || "TC";
  }

  // Filter and sort teachers
  const filteredTeachers = useMemo(() => {
    return teachers
      .filter((t) => {
        const assigned = teacherClassesMap.get(t.id) || [];
        const isAssigned = assigned.length > 0;

        // Assignment status filter
        if (assignmentFilter === "ASSIGNED" && !isAssigned) return false;
        if (assignmentFilter === "UNASSIGNED" && isAssigned) return false;

        // Search match (name, email, employeeId, assigned class name)
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const fullName = `${t.user?.firstName || ""} ${t.user?.lastName || ""}`.toLowerCase();
          const email = (t.user?.email || "").toLowerCase();
          const empId = (t.employeeId || "").toLowerCase();
          const qual = (t.qualification || "").toLowerCase();
          const classNames = assigned.map((c) => c.name.toLowerCase()).join(" ");

          if (
            !fullName.includes(q) &&
            !email.includes(q) &&
            !empId.includes(q) &&
            !qual.includes(q) &&
            !classNames.includes(q)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name_asc") {
          const nameA = `${a.user?.firstName || ""} ${a.user?.lastName || ""}`.toLowerCase();
          const nameB = `${b.user?.firstName || ""} ${b.user?.lastName || ""}`.toLowerCase();
          return nameA.localeCompare(nameB);
        }
        if (sortBy === "name_desc") {
          const nameA = `${a.user?.firstName || ""} ${a.user?.lastName || ""}`.toLowerCase();
          const nameB = `${b.user?.firstName || ""} ${b.user?.lastName || ""}`.toLowerCase();
          return nameB.localeCompare(nameA);
        }
        if (sortBy === "classes_desc") {
          const countA = (teacherClassesMap.get(a.id) || []).length;
          const countB = (teacherClassesMap.get(b.id) || []).length;
          return countB - countA;
        }
        if (sortBy === "employeeId_asc") {
          return (a.employeeId || "").localeCompare(b.employeeId || "");
        }
        return 0;
      });
  }, [teachers, teacherClassesMap, assignmentFilter, searchTerm, sortBy]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Close modal on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function handleSelect(teacher: TeacherItem) {
    onChange(teacher.id, teacher);
    setIsOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("", undefined);
  }

  const selectedAssignedClasses = selectedTeacher ? (teacherClassesMap.get(selectedTeacher.id) || []) : [];

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Selected Teacher Card View or Trigger Button */}
      {selectedTeacher ? (
        <div className="flex items-center justify-between p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {getInitials(selectedTeacher.user?.firstName, selectedTeacher.user?.lastName)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900 truncate">
                  {selectedTeacher.user?.firstName} {selectedTeacher.user?.lastName}
                </span>
                {selectedTeacher.employeeId && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800 text-[11px] font-mono font-bold">
                    {selectedTeacher.employeeId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 flex-wrap">
                <span className="text-slate-500 truncate">{selectedTeacher.user?.email}</span>
                {selectedAssignedClasses.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {selectedAssignedClasses.map((c) => c.name).join(", ")}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                    Unassigned / Available
                  </span>
                )}
                {selectedTeacher.qualification && (
                  <span className="text-slate-400">• {selectedTeacher.qualification}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              disabled={disabled}
              className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:bg-indigo-100/70 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              title="Clear selection / Unassign teacher"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-all text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? "border-rose-300 ring-1 ring-rose-300" : "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          }`}
        >
          <span className="flex items-center gap-2 text-slate-500">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <span>{placeholder}</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 text-xs font-semibold">
            Search ({teachers.length})
          </span>
        </button>
      )}

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

      {/* Modal Dialog for Teacher Search & Selection */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            ref={modalRef}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">Select Teacher</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search, filter, and assign a teacher ({filteredTeachers.length} available)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filter & Search Bar Toolbar */}
            <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
              {/* Search input */}
              <div className="relative">
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, employee ID, or assigned class..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Filters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Assignment Status Filter */}
                <div>
                  <select
                    value={assignmentFilter}
                    onChange={(e) => setAssignmentFilter(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Teachers ({teachers.length})</option>
                    <option value="ASSIGNED">Assigned to Class(es)</option>
                    <option value="UNASSIGNED">Unassigned (Available)</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="name_asc">Sort: Name (A to Z)</option>
                    <option value="name_desc">Sort: Name (Z to A)</option>
                    <option value="classes_desc">Sort: Most Assigned Classes</option>
                    <option value="employeeId_asc">Sort: Employee ID</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scrollable Teacher Table/List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredTeachers.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No teachers found</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    No teachers match your search &quot;{searchTerm}&quot; or selected filters.
                  </p>
                  {(searchTerm || assignmentFilter !== "ALL") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setAssignmentFilter("ALL");
                      }}
                      className="mt-3 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 rounded-lg"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredTeachers.map((t) => {
                    const isSelected = value === t.id || value === t.userId;
                    const assignedClasses = teacherClassesMap.get(t.id) || [];
                    const isAssigned = assignedClasses.length > 0;

                    return (
                      <div
                        key={t.id}
                        onClick={() => handleSelect(t)}
                        className={`px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? "bg-indigo-50/60" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {getInitials(t.user?.firstName, t.user?.lastName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-900 truncate">
                                {t.user?.firstName} {t.user?.lastName}
                              </span>
                              {t.employeeId && (
                                <span className="font-mono text-xs text-slate-500 font-semibold">
                                  {t.employeeId}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {t.user?.email}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                              {isAssigned ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {assignedClasses.map((c) => c.name).join(", ")}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  Unassigned / Available
                                </span>
                              )}
                              {t.qualification && (
                                <span className="text-slate-400 text-[11px]">• {t.qualification}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 ml-3">
                          {isSelected ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-100/80 px-2.5 py-1 rounded-lg">
                              <svg className="w-3.5 h-3.5 text-indigo-700" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                              Selected
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(t);
                              }}
                              className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                            >
                              Select
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>Showing {filteredTeachers.length} of {teachers.length} teachers</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
