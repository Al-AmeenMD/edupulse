"use client";

import { useEffect, useState, useRef, FormEvent } from "react";

// Types
type FeeType = "TUITION" | "TRANSPORT" | "UNIFORM" | "EXAM" | "MISCELLANEOUS";
type FeeStatus = "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" | "WAIVED";

interface FeeStructureItem {
  id: string;
  name: string;
  type: FeeType;
  amount: number | string;
  academicYear: string;
  term?: string | null;
  dueDate: string;
  _count?: {
    fees?: number;
  };
}

interface StudentItem {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
}

interface ClassItem {
  id: string;
  name: string;
  section?: string | null;
  academicYear: string;
}

interface StudentFeeItem {
  id: string;
  studentId: string;
  feeStructureId: string;
  amountDue: number | string;
  amountPaid: number | string;
  status: FeeStatus;
  dueDate: string;
  note?: string | null;
  student: {
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
  };
  feeStructure: {
    id: string;
    name: string;
    type: FeeType;
    academicYear: string;
    term?: string | null;
  };
}

// Helper currency/number formatters for Nigerian Naira (₦)
function formatAmount(amount: number | string): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount) || 0;
  return num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNaira(amount: number | string): string {
  return `₦${formatAmount(amount)}`;
}

export default function FeesManagementPage() {
  const [activeTab, setActiveTab] = useState<"structures" | "student_fees">("structures");

  // Tab 1: Fee Structures State
  const [structures, setStructures] = useState<FeeStructureItem[]>([]);
  const [loadingStructures, setLoadingStructures] = useState(true);
  const [isCreateStructureOpen, setIsCreateStructureOpen] = useState(false);
  const [createStructureForm, setCreateStructureForm] = useState({
    name: "",
    type: "TUITION" as FeeType,
    amount: "",
    academicYear: "2025/2026",
    term: "Term 1",
    dueDate: "",
  });
  const [createStructureDisplayAmount, setCreateStructureDisplayAmount] = useState("");
  const [creatingStructure, setCreatingStructure] = useState(false);

  // Assign Fee Modal State
  const [assigningStructure, setAssigningStructure] = useState<FeeStructureItem | null>(null);
  const [assignMode, setAssignMode] = useState<"single" | "class">("single");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [assigningFee, setAssigningFee] = useState(false);
  const [assignSummary, setAssignSummary] = useState<string | null>(null);

  // Tab 2: Student Fees State
  const [studentFees, setStudentFees] = useState<StudentFeeItem[]>([]);
  const [loadingStudentFees, setLoadingStudentFees] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Record Payment Modal State
  const [payingFee, setPayingFee] = useState<StudentFeeItem | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
  });
  const [rawAmount, setRawAmount] = useState("");
  const [displayAmount, setDisplayAmount] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Waive Modal State
  const [waivingFee, setWaivingFee] = useState<StudentFeeItem | null>(null);
  const [submittingWaive, setSubmittingWaive] = useState(false);

  // Alerts & Notifications
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const searchAbortControllerRef = useRef<AbortController | null>(null);

  function formatDisplayAmount(raw: string): string {
    if (!raw) return "";
    const parts = raw.split(".");
    const sanitizedRaw = parts.length > 2 
      ? parts[0] + "." + parts.slice(1).join("") 
      : raw;

    if (sanitizedRaw.includes(".")) {
      const [intPart, decPart] = sanitizedRaw.split(".");
      const numInt = parseInt(intPart || "0", 10);
      const formattedInt = isNaN(numInt) ? "0" : numInt.toLocaleString("en-NG");
      return `${formattedInt}.${decPart}`;
    }

    const num = parseFloat(sanitizedRaw);
    return !isNaN(num) ? num.toLocaleString("en-NG") : sanitizedRaw;
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    const sanitizedRaw = parts.length > 2 
      ? parts[0] + "." + parts.slice(1).join("") 
      : raw;
    setRawAmount(sanitizedRaw);
    setPaymentForm((prev) => ({ ...prev, amount: sanitizedRaw }));
    setDisplayAmount(formatDisplayAmount(sanitizedRaw));
  };

  const handleCreateStructureAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    const sanitizedRaw = parts.length > 2 
      ? parts[0] + "." + parts.slice(1).join("") 
      : raw;
    setCreateStructureForm((prev) => ({ ...prev, amount: sanitizedRaw }));
    setCreateStructureDisplayAmount(formatDisplayAmount(sanitizedRaw));
  };

  // ---------------------------------------------------------------------------
  // Data Fetchers
  // ---------------------------------------------------------------------------

  // Fetch Fee Structures
  async function fetchStructures() {
    try {
      setLoadingStructures(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/fees/structures", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load fee structures");
      const data = await res.json();
      setStructures(data.data || []);
    } catch (err: any) {
      setError(err.message || "Error loading fee structures");
    } finally {
      setLoadingStructures(false);
    }
  }

  // Fetch Students & Classes for Assign Modal
  async function fetchStudentsAndClasses() {
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const [studentsRes, classesRes] = await Promise.all([
        fetch("/api/students", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/classes", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (studentsRes.ok) {
        const sData = await studentsRes.json();
        setStudents(sData.data || []);
      }
      if (classesRes.ok) {
        const cData = await classesRes.json();
        setClasses(cData.data || []);
      }
    } catch (err) {
      console.error("Error loading dropdown data:", err);
    }
  }

  // Fetch Student Fees with Search & Status Filter
  async function fetchStudentFees(query: string = searchQuery, status: string = statusFilter) {
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    searchAbortControllerRef.current = new AbortController();

    try {
      setLoadingStudentFees(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const params = new URLSearchParams();
      if (status !== "ALL") params.append("status", status);

      const url = `/api/fees?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: searchAbortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error("Failed to load student fees");
      const data = await res.json();
      let list: StudentFeeItem[] = data.data || [];

      // Filter client side by student name if search query present
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        list = list.filter((f) => {
          const fullName = `${f.student.firstName} ${f.student.lastName}`.toLowerCase();
          const sId = f.student.studentId.toLowerCase();
          return fullName.includes(q) || sId.includes(q);
        });
      }

      setStudentFees(list);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Error loading student fees");
      }
    } finally {
      setLoadingStudentFees(false);
    }
  }

  useEffect(() => {
    fetchStructures();
    fetchStudentsAndClasses();
  }, []);

  useEffect(() => {
    if (activeTab === "student_fees") {
      fetchStudentFees();
    }
  }, [activeTab, statusFilter]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    fetchStudentFees(q, statusFilter);
  }

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  // Handle Create Fee Structure
  async function handleCreateStructureSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!createStructureForm.name.trim() || !createStructureForm.amount || !createStructureForm.dueDate) {
      setError("Please fill in all required fields.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setCreatingStructure(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload = {
        name: createStructureForm.name.trim(),
        type: createStructureForm.type,
        amount: parseFloat(createStructureForm.amount),
        academicYear: createStructureForm.academicYear.trim(),
        term: createStructureForm.term.trim() || undefined,
        dueDate: createStructureForm.dueDate,
      };

      const res = await fetch("/api/fees/structures", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create fee structure.");

      setIsCreateStructureOpen(false);
      setCreateStructureForm({
        name: "",
        type: "TUITION",
        amount: "",
        academicYear: "2025/2026",
        term: "Term 1",
        dueDate: "",
      });
      setCreateStructureDisplayAmount("");
      setSuccessMessage(`Fee structure "${payload.name}" created successfully!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchStructures();
    } catch (err: any) {
      setError(err.message || "An error occurred while creating fee structure.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setCreatingStructure(false);
    }
  }

  // Handle Assign Fee (Single or Bulk)
  async function handleAssignFeeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!assigningStructure) return;
    setError("");
    setSuccessMessage("");
    setAssignSummary(null);

    if (assignMode === "single" && !selectedStudentId) {
      setError("Please select a student to assign this fee.");
      setTimeout(() => setError(""), 4000);
      return;
    }
    if (assignMode === "class" && !selectedClassId) {
      setError("Please select a class to assign this fee.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setAssigningFee(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload = {
        feeStructureId: assigningStructure.id,
        ...(assignMode === "single" ? { studentId: selectedStudentId } : { classId: selectedClassId }),
      };

      const res = await fetch("/api/fees", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign fee.");

      if (assignMode === "class" && data.summary) {
        setSuccessMessage(
          `Fee assigned to class! Assigned: ${data.summary.assigned}, Skipped (Already Assigned): ${data.summary.skipped}`
        );
      } else {
        setSuccessMessage("Fee structure assigned successfully!");
      }
      setTimeout(() => setSuccessMessage(""), 4000);

      setAssigningStructure(null);
      setSelectedStudentId("");
      setSelectedClassId("");
      fetchStructures();
      if (activeTab === "student_fees") fetchStudentFees();
    } catch (err: any) {
      setError(err.message || "An error occurred while assigning fee.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setAssigningFee(false);
    }
  }

  // Handle Record Payment
  async function handleRecordPaymentSubmit(e: FormEvent) {
    e.preventDefault();
    if (!payingFee) return;
    setError("");
    setSuccessMessage("");

    const payAmount = parseFloat(rawAmount || paymentForm.amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setSubmittingPayment(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload = {
        amount: payAmount,
        method: paymentForm.method,
        reference: paymentForm.reference.trim() || undefined,
      };

      const res = await fetch(`/api/fees/${payingFee.id}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment.");

      setPayingFee(null);
      setPaymentForm({ amount: "", method: "cash", reference: "" });
      setRawAmount("");
      setDisplayAmount("");
      setSuccessMessage(`Payment of ${formatNaira(payAmount)} recorded successfully!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchStudentFees();
    } catch (err: any) {
      setError(err.message || "An error occurred while recording payment.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setSubmittingPayment(false);
    }
  }

  // Handle Waive Fee
  async function handleWaiveFeeConfirm() {
    if (!waivingFee) return;
    setError("");
    setSuccessMessage("");

    try {
      setSubmittingWaive(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/fees/${waivingFee.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "WAIVED" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to waive fee.");

      setWaivingFee(null);
      setSuccessMessage("Fee waived successfully.");
      fetchStudentFees();
    } catch (err: any) {
      setError(err.message || "An error occurred while waiving fee.");
    } finally {
      setSubmittingWaive(false);
    }
  }

  // Helper for Status Badge Styling
  function renderStatusBadge(status: FeeStatus) {
    const styles: Record<FeeStatus, string> = {
      PENDING: "bg-amber-50 text-amber-800 border-amber-200",
      PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
      OVERDUE: "bg-rose-50 text-rose-800 border-rose-200",
      PARTIAL: "bg-blue-50 text-blue-800 border-blue-200",
      WAIVED: "bg-slate-100 text-slate-800 border-slate-200",
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status]}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Fees Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage fee structures, assign fees to students/classes, record payments, and process waivers.
          </p>
        </div>

        {activeTab === "structures" && (
          <button
            onClick={() => {
              setError("");
              setCreateStructureForm({
                name: "",
                type: "TUITION",
                amount: "",
                academicYear: "2025/2026",
                term: "Term 1",
                dueDate: "",
              });
              setCreateStructureDisplayAmount("");
              setIsCreateStructureOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Create Structure</span>
          </button>
        )}
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-700 hover:text-rose-900 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between gap-3">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab("structures")}
            className={`pb-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "structures"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Fee Structures
          </button>
          <button
            onClick={() => setActiveTab("student_fees")}
            className={`pb-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "student_fees"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Student Fees
          </button>
        </nav>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: FEE STRUCTURES TAB                                           */}
      {/* =================================================================== */}
      {activeTab === "structures" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loadingStructures ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : structures.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5m-16.5 3.75h16.5m-16.5 3.75h16.5m-16.5 3.75h16.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-800">No fee structures created yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Click &quot;Create Structure&quot; above to set up your school fee templates.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Structure Name</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Amount (₦)</th>
                    <th className="px-6 py-3.5">Academic Year / Term</th>
                    <th className="px-6 py-3.5">Due Date</th>
                    <th className="px-6 py-3.5 text-center">Assigned Count</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {structures.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {st.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {st.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-extrabold text-slate-900 font-mono">
                        {formatAmount(st.amount)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {st.academicYear} {st.term ? `(${st.term})` : ""}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                        {new Date(st.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                          {st._count?.fees ?? 0} Students
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setError("");
                            setAssigningStructure(st);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          <span>Assign Fee</span>
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

      {/* =================================================================== */}
      {/* TAB 2: STUDENT FEES TAB                                             */}
      {/* =================================================================== */}
      {activeTab === "student_fees" && (
        <div className="space-y-6">
          {/* Controls & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search by student name or ID..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {["ALL", "PENDING", "PAID", "OVERDUE", "PARTIAL", "WAIVED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === st
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Student Fees Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loadingStudentFees ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : studentFees.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-semibold text-slate-800">No student fees found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your search filter or assign fee structures to students.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Student</th>
                      <th className="px-6 py-3.5">Fee Name</th>
                      <th className="px-6 py-3.5">Amount Due (₦)</th>
                      <th className="px-6 py-3.5">Amount Paid (₦)</th>
                      <th className="px-6 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5">Due Date</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {studentFees.map((fee) => {
                      const isFullyPaid = fee.status === "PAID" || fee.status === "WAIVED";

                      return (
                        <tr key={fee.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">
                            <div>{fee.student.firstName} {fee.student.lastName}</div>
                            <span className="text-[11px] font-mono text-slate-400 font-normal">
                              {fee.student.studentId}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-700">
                            {fee.feeStructure.name}
                          </td>
                          <td className="px-6 py-4 font-extrabold text-slate-900 font-mono">
                            {formatAmount(fee.amountDue)}
                          </td>
                          <td className="px-6 py-4 font-extrabold text-emerald-700 font-mono">
                            {formatAmount(fee.amountPaid)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {renderStatusBadge(fee.status)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                            {new Date(fee.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            {!isFullyPaid && (
                              <>
                                <button
                                  onClick={() => {
                                    setError("");
                                    setPayingFee(fee);
                                    const remaining = parseFloat(String(fee.amountDue)) - parseFloat(String(fee.amountPaid));
                                    const raw = remaining > 0 ? String(remaining) : "";
                                    setRawAmount(raw);
                                    setPaymentForm({
                                      amount: raw,
                                      method: "cash",
                                      reference: "",
                                    });
                                    setDisplayAmount(formatDisplayAmount(raw));
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                                >
                                  Record Payment
                                </button>
                                <button
                                  onClick={() => {
                                    setError("");
                                    setWaivingFee(fee);
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  Waive
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: CREATE FEE STRUCTURE                                       */}
      {/* =================================================================== */}
      {isCreateStructureOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base">Create Fee Structure</h3>
              <button
                onClick={() => {
                  setIsCreateStructureOpen(false);
                  setCreateStructureDisplayAmount("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateStructureSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Structure Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. First Term Tuition 2025/2026"
                  value={createStructureForm.name}
                  onChange={(e) => setCreateStructureForm({ ...createStructureForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Type & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Fee Type *
                  </label>
                  <select
                    value={createStructureForm.type}
                    onChange={(e) => setCreateStructureForm({ ...createStructureForm, type: e.target.value as FeeType })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="TUITION">TUITION</option>
                    <option value="TRANSPORT">TRANSPORT</option>
                    <option value="UNIFORM">UNIFORM</option>
                    <option value="EXAM">EXAM</option>
                    <option value="MISCELLANEOUS">MISCELLANEOUS</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Amount (₦) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="50,000.00"
                    value={createStructureDisplayAmount}
                    onChange={handleCreateStructureAmountChange}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                  />
                </div>
              </div>

              {/* Academic Year & Term */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Academic Year *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2025/2026"
                    value={createStructureForm.academicYear}
                    onChange={(e) => setCreateStructureForm({ ...createStructureForm, academicYear: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Term
                  </label>
                  <select
                    value={createStructureForm.term}
                    onChange={(e) => setCreateStructureForm({ ...createStructureForm, term: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={createStructureForm.dueDate}
                  onChange={(e) => setCreateStructureForm({ ...createStructureForm, dueDate: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateStructureOpen(false);
                    setCreateStructureDisplayAmount("");
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingStructure}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {creatingStructure && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Create Structure</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: ASSIGN FEE                                                 */}
      {/* =================================================================== */}
      {assigningStructure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Assign Fee Structure</h3>
                <p className="text-xs text-slate-500">{assigningStructure.name} — {formatNaira(assigningStructure.amount)}</p>
              </div>
              <button
                onClick={() => setAssigningStructure(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAssignFeeSubmit} className="p-6 space-y-5">
              {/* Option Selector Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Assignment Target
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAssignMode("single")}
                    className={`py-2 rounded-lg transition-all ${
                      assignMode === "single" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    Single Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignMode("class")}
                    className={`py-2 rounded-lg transition-all ${
                      assignMode === "class" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    Entire Class
                  </button>
                </div>
              </div>

              {/* Option 1: Single Student */}
              {assignMode === "single" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Student *
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">Select a student...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.studentId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Option 2: Entire Class */}
              {assignMode === "class" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Class *
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">Select a class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ""} — {c.academicYear}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningStructure(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningFee}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {assigningFee && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Assign Fee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: RECORD PAYMENT                                             */}
      {/* =================================================================== */}
      {payingFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Record Payment</h3>
                <p className="text-xs text-slate-500">
                  {payingFee.student.firstName} {payingFee.student.lastName} — {payingFee.feeStructure.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setPayingFee(null);
                  setRawAmount("");
                  setDisplayAmount("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-6 space-y-4">
              {/* Fee Summary Info */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Fee Amount:</span>
                  <strong className="text-slate-900">{formatNaira(payingFee.amountDue)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Already Paid:</span>
                  <strong className="text-emerald-700">{formatNaira(payingFee.amountPaid)}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-700 font-bold">Remaining Balance:</span>
                  <strong className="text-blue-700 font-bold">
                    {formatNaira(parseFloat(String(payingFee.amountDue)) - parseFloat(String(payingFee.amountPaid)))}
                  </strong>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Payment Amount (₦) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter amount paid..."
                  value={displayAmount}
                  onChange={handleAmountChange}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Payment Method *
                </label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Debit / Credit Card</option>
                </select>
              </div>

              {/* Reference */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Payment Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank teller / transaction ref..."
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPayingFee(null);
                    setRawAmount("");
                    setDisplayAmount("");
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingPayment && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Record Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: WAIVE FEE CONFIRMATION                                     */}
      {/* =================================================================== */}
      {waivingFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-lg">Waive Student Fee?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to waive the fee <strong className="text-slate-800">&quot;{waivingFee.feeStructure.name}&quot;</strong> ({formatNaira(waivingFee.amountDue)}) for student <strong className="text-slate-800">{waivingFee.student.firstName} {waivingFee.student.lastName}</strong>?
              </p>
              <p className="text-[11px] text-amber-700 font-medium pt-2">
                This action will mark the fee status as WAIVED.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWaivingFee(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWaiveFeeConfirm}
                disabled={submittingWaive}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {submittingWaive && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Confirm Waive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
