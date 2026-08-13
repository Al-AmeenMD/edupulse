"use client";

import { useEffect, useState } from "react";

interface ClassEnrollment {
  id: string;
  class: {
    id: string;
    name: string;
    level?: string;
    section?: string;
    academicYear?: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Add Student Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");

  // Dynamic admissionLevel state
  const [requiresLevel, setRequiresLevel] = useState(false);
  const [existingLevels, setExistingLevels] = useState<string[]>([]);
  const [selectedLevelOption, setSelectedLevelOption] = useState("");
  const [customAdmissionLevel, setCustomAdmissionLevel] = useState("");

  // Fetch Students
  async function fetchStudents() {
    try {
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/students", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch students");
      }

      const data = await res.json();
      setStudents(data.data || []);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  // Check School Settings & Template on Modal Open
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

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      // 1. Fetch GET /api/schools/my-settings
      const settingsRes = await fetch("/api/schools/my-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const template = settingsData.data?.studentIdTemplate || "";
        const hasLevelToken = template.includes("{LEVEL}");
        setRequiresLevel(hasLevelToken);
      }

      // 2. Extract unique admissionLevel values from existing students
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
    } catch (err: any) {
      console.error("Failed to load school settings for modal:", err);
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

      let finalAdmissionLevel: string | undefined = undefined;

      if (requiresLevel) {
        if (selectedLevelOption === "__new__") {
          finalAdmissionLevel = customAdmissionLevel.trim();
        } else {
          finalAdmissionLevel = selectedLevelOption.trim();
        }

        if (!finalAdmissionLevel) {
          throw new Error("Admission level is required for your school's ID format");
        }
      }

      const res = await fetch("/api/students", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
      fetchStudents();
    } catch (err: any) {
      setModalError(err.message || "An error occurred while creating student");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredStudents = students.filter((student) => {
    const query = search.toLowerCase();
    return (
      student.firstName.toLowerCase().includes(query) ||
      student.lastName.toLowerCase().includes(query) ||
      student.studentId.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Student Roster
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage student registrations, admission records, and class enrollments.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add New Student</span>
        </button>
      </div>

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
        {/* Search Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name or ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">No students found</p>
            <p className="text-xs text-slate-500 mt-1">No student records match your query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Student Name</th>
                  <th className="px-6 py-3.5">Student ID</th>
                  <th className="px-6 py-3.5">Class</th>
                  <th className="px-6 py-3.5">Admission Level</th>
                  <th className="px-6 py-3.5 text-right">Enrolled Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.map((student) => {
                  const assignedClass =
                    student.classEnrollments?.[0]?.class?.name || "Unassigned";

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {student.studentId}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {assignedClass}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {student.admissionLevel ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                            {student.admissionLevel}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-500">
                        {new Date(student.createdAt).toLocaleDateString()}
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
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddStudentSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
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

              {/* Conditional Admission Level Field (Rendered ONLY if template contains {LEVEL}) */}
              {requiresLevel && (
                <div className="space-y-2 p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl">
                  <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Admission Level <span className="text-rose-500">*</span>
                  </label>

                  {existingLevels.length > 0 && (
                    <select
                      value={selectedLevelOption}
                      onChange={(e) => setSelectedLevelOption(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-medium"
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
                      placeholder="e.g. Primary, Nursery, JSS1"
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
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors"
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
    </div>
  );
}
