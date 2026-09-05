"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

export interface StudentItem {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  admissionLevel?: string | null;
  classEnrollments?: Array<{
    class?: {
      id: string;
      name: string;
      section?: string | null;
    } | null;
  }>;
  [key: string]: any;
}

export interface StudentSelectorProps {
  students: StudentItem[];
  value: string; // Selected student ID
  onChange: (studentId: string, student?: StudentItem) => void;
  classes?: Array<{ id: string; name: string; section?: string | null }>;
  excludeStudentIds?: string[]; // IDs to exclude (e.g. already enrolled)
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function StudentSelector({
  students,
  value,
  onChange,
  classes = [],
  excludeStudentIds = [],
  placeholder = "Select a student...",
  label,
  required = false,
  disabled = false,
  error,
  className = "",
}: StudentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [selectedLevel, setSelectedLevel] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "class_asc" | "studentId_asc">("name_asc");

  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected student
  const selectedStudent = useMemo(() => {
    if (!value) return null;
    return students.find((s) => s.id === value || s.studentId === value) || null;
  }, [students, value]);

  // Extract unique admission levels across students for the filter
  const availableLevels = useMemo(() => {
    const levels = new Set<string>();
    students.forEach((s) => {
      if (s.admissionLevel && s.admissionLevel.trim()) {
        levels.add(s.admissionLevel.trim());
      }
    });
    return Array.from(levels).sort();
  }, [students]);

  // Extract available classes from classes prop or student enrollments
  const availableClasses = useMemo(() => {
    if (classes && classes.length > 0) return classes;
    const classMap = new Map<string, { id: string; name: string }>();
    students.forEach((s) => {
      const cls = s.classEnrollments?.[0]?.class;
      if (cls && cls.id && cls.name) {
        classMap.set(cls.id, { id: cls.id, name: cls.name });
      }
    });
    return Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes, students]);

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    const excludedSet = new Set(excludeStudentIds);

    return students
      .filter((s) => {
        // Exclude specified IDs (e.g. already enrolled in class)
        if (excludedSet.has(s.id)) return false;

        // Search match (name, studentId)
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const fullName = `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
          const sId = (s.studentId || "").toLowerCase();
          if (!fullName.includes(q) && !sId.includes(q)) {
            return false;
          }
        }

        // Class filter
        if (selectedClassId !== "ALL") {
          const enrolledClassId = s.classEnrollments?.[0]?.class?.id;
          if (selectedClassId === "UNASSIGNED") {
            if (enrolledClassId) return false;
          } else if (enrolledClassId !== selectedClassId) {
            return false;
          }
        }

        // Admission level filter
        if (selectedLevel !== "ALL") {
          if ((s.admissionLevel || "").trim() !== selectedLevel) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name_asc") {
          const nameA = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
          const nameB = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
          return nameA.localeCompare(nameB);
        }
        if (sortBy === "name_desc") {
          const nameA = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
          const nameB = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
          return nameB.localeCompare(nameA);
        }
        if (sortBy === "class_asc") {
          const classA = a.classEnrollments?.[0]?.class?.name || "ZZZ";
          const classB = b.classEnrollments?.[0]?.class?.name || "ZZZ";
          return classA.localeCompare(classB);
        }
        if (sortBy === "studentId_asc") {
          return (a.studentId || "").localeCompare(b.studentId || "");
        }
        return 0;
      });
  }, [students, excludeStudentIds, searchTerm, selectedClassId, selectedLevel, sortBy]);

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

  function handleSelect(student: StudentItem) {
    onChange(student.id, student);
    setIsOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("", undefined);
  }

  function getStudentClassName(student: StudentItem): string {
    const enrolledClass = student.classEnrollments?.[0]?.class;
    return enrolledClass?.name || "Unassigned";
  }

  function getInitials(firstName?: string, lastName?: string): string {
    const f = (firstName || "").charAt(0).toUpperCase();
    const l = (lastName || "").charAt(0).toUpperCase();
    return `${f}${l}` || "ST";
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Selected Student Card View or Trigger Button */}
      {selectedStudent ? (
        <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {getInitials(selectedStudent.firstName, selectedStudent.lastName)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900 truncate">
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100/80 text-blue-800 text-[11px] font-mono font-bold">
                  {selectedStudent.studentId}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                  getStudentClassName(selectedStudent) === "Unassigned"
                    ? "bg-slate-100 text-slate-500 border border-slate-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold"
                }`}>
                  {getStudentClassName(selectedStudent)}
                </span>
                {selectedStudent.admissionLevel && (
                  <span className="text-slate-400">• {selectedStudent.admissionLevel}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              disabled={disabled}
              className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-100/70 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              title="Clear selection"
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
            error ? "border-rose-300 ring-1 ring-rose-300" : "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          }`}
        >
          <span className="flex items-center gap-2 text-slate-500">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <span>{placeholder}</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 text-xs font-semibold">
            Search ({students.length})
          </span>
        </button>
      )}

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

      {/* Modal Dialog for Student Search & Selection */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            ref={modalRef}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">Select Student</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search, filter, and choose a student ({filteredStudents.length} available)
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
                  placeholder="Search by student name or student ID..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {/* Class Filter */}
                <div>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Classes</option>
                    <option value="UNASSIGNED">Unassigned Only</option>
                    {availableClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Admission Level Filter */}
                <div>
                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Admission Levels</option>
                    {availableLevels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="name_asc">Sort: Name (A to Z)</option>
                    <option value="name_desc">Sort: Name (Z to A)</option>
                    <option value="class_asc">Sort: Class</option>
                    <option value="studentId_asc">Sort: Student ID</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scrollable Student Table/List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No students found</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    No students match your search &quot;{searchTerm}&quot; or selected filters.
                  </p>
                  {(searchTerm || selectedClassId !== "ALL" || selectedLevel !== "ALL") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedClassId("ALL");
                        setSelectedLevel("ALL");
                      }}
                      className="mt-3 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 rounded-lg"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredStudents.map((st) => {
                    const isSelected = value === st.id || value === st.studentId;
                    const classNameLabel = getStudentClassName(st);
                    const isUnassigned = classNameLabel === "Unassigned";

                    return (
                      <div
                        key={st.id}
                        onClick={() => handleSelect(st)}
                        className={`px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {getInitials(st.firstName, st.lastName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 truncate">
                                {st.firstName} {st.lastName}
                              </span>
                              <span className="font-mono text-xs text-slate-500 font-semibold">
                                {st.studentId}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                  isUnassigned
                                    ? "bg-slate-100 text-slate-500 border border-slate-200"
                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                }`}
                              >
                                {classNameLabel}
                              </span>
                              {st.admissionLevel && (
                                <span className="text-slate-400 text-[11px]">• {st.admissionLevel}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 ml-3">
                          {isSelected ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-lg">
                              <svg className="w-3.5 h-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                              Selected
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(st);
                              }}
                              className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
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
              <span>Showing {filteredStudents.length} of {students.length} students</span>
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
