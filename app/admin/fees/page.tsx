"use client";

import { useEffect, useState, useMemo, useRef, FormEvent } from "react";

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
  admissionLevel?: string | null;
}

interface ClassItem {
  id: string;
  name: string;
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
    admissionLevel?: string | null;
    classEnrollments?: Array<{
      class: {
        id: string;
        name: string;
      };
    }>;
  };
  feeStructure: {
    id: string;
    name: string;
    type: FeeType;
    academicYear: string;
    term?: string | null;
  };
}

interface PaymentItem {
  id: string;
  feeId: string;
  schoolId: string;
  receiptNumber: string;
  amount: number | string;
  method: string;
  reference?: string | null;
  recordedBy: string;
  paidAt: string;
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
  const [assignMode, setAssignMode] = useState<"single" | "class" | "admissionLevel">("single");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedAdmissionLevel, setSelectedAdmissionLevel] = useState("");
  const [assigningFee, setAssigningFee] = useState(false);
  const [assignSummary, setAssignSummary] = useState<string | null>(null);

  // Tab 2: Student Fees State & Filters (FIX-008 & FIX-016)
  const [studentFees, setStudentFees] = useState<StudentFeeItem[]>([]);
  const [loadingStudentFees, setLoadingStudentFees] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [admissionLevelFilter, setAdmissionLevelFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Derived distinct Admission Levels for filters & modals (FIX-016 & FIX-009)
  const availableLevels = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.admissionLevel?.trim()) set.add(s.admissionLevel.trim());
    });
    return Array.from(set).sort();
  }, [students]);

  // Change Fee Status Modal State (FIX-017)
  const [changingStatusFee, setChangingStatusFee] = useState<StudentFeeItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>("OVERDUE");
  const [statusReason, setStatusReason] = useState<string>("");
  const [submittingStatusChange, setSubmittingStatusChange] = useState<boolean>(false);

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

  // Edit Fee Structure State (FIX-011)
  const [editingStructure, setEditingStructure] = useState<FeeStructureItem | null>(null);
  const [editStructureForm, setEditStructureForm] = useState({
    name: "",
    type: "TUITION" as FeeType,
    amount: "",
    academicYear: "2025/2026",
    term: "Term 1",
    dueDate: "",
  });
  const [editStructureDisplayAmount, setEditStructureDisplayAmount] = useState("");
  const [editingStructureSubmitting, setEditingStructureSubmitting] = useState(false);

  const handleEditStructureAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    const sanitizedRaw = parts.length > 2 
      ? parts[0] + "." + parts.slice(1).join("") 
      : raw;
    setEditStructureForm((prev) => ({ ...prev, amount: sanitizedRaw }));
    setEditStructureDisplayAmount(formatDisplayAmount(sanitizedRaw));
  };

  function handleOpenEditStructure(st: FeeStructureItem) {
    setError("");
    setSuccessMessage("");
    setEditingStructure(st);
    const amountStr = String(st.amount);
    setEditStructureForm({
      name: st.name,
      type: st.type,
      amount: amountStr,
      academicYear: st.academicYear,
      term: st.term || "",
      dueDate: st.dueDate ? st.dueDate.split("T")[0] : "",
    });
    setEditStructureDisplayAmount(formatDisplayAmount(amountStr));
  }

  // Delete Fee Structure State (FIX-012)
  const [deletingStructure, setDeletingStructure] = useState<FeeStructureItem | null>(null);
  const [deletingStructureSubmitting, setDeletingStructureSubmitting] = useState(false);

  // Payment Receipts Modal State (FIX-010)
  const [viewingReceiptsFee, setViewingReceiptsFee] = useState<StudentFeeItem | null>(null);
  const [feePayments, setFeePayments] = useState<PaymentItem[]>([]);
  const [loadingFeePayments, setLoadingFeePayments] = useState(false);
  const [downloadingPaymentId, setDownloadingPaymentId] = useState<string | null>(null);

  async function handleOpenViewReceipts(fee: StudentFeeItem) {
    setError("");
    setSuccessMessage("");
    setViewingReceiptsFee(fee);
    setFeePayments([]);
    try {
      setLoadingFeePayments(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;
      const res = await fetch(`/api/fees/${fee.id}/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch payments.");
      setFeePayments(data.data?.payments || []);
    } catch (err: any) {
      setError(err.message || "Failed to load payment receipts.");
    } finally {
      setLoadingFeePayments(false);
    }
  }

  async function handleDownloadReceipt(feeId: string, paymentId: string, receiptNumber: string) {
    setError("");
    try {
      setDownloadingPaymentId(paymentId);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/fees/${feeId}/payments/${paymentId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to download receipt.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${receiptNumber.replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || "An error occurred while downloading receipt.");
    } finally {
      setDownloadingPaymentId(null);
    }
  }

  function handleDeleteStructureClick(st: FeeStructureItem) {
    setError("");
    setSuccessMessage("");

    const assignedCount = st._count?.fees ?? 0;
    if (assignedCount > 0) {
      setError(`Cannot delete — ${assignedCount} students are assigned this fee structure. Remove or waive those fees first.`);
      setTimeout(() => setError(""), 6000);
      return;
    }

    setDeletingStructure(st);
  }

  async function handleDeleteStructureConfirm() {
    if (!deletingStructure) return;
    setError("");
    setSuccessMessage("");

    try {
      setDeletingStructureSubmitting(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/fees/structures/${deletingStructure.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete fee structure.");

      setDeletingStructure(null);
      setSuccessMessage(data.data?.message || "Fee structure deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchStructures();
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting fee structure.");
      setTimeout(() => setError(""), 6000);
      setDeletingStructure(null);
    } finally {
      setDeletingStructureSubmitting(false);
    }
  }

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
  // Fetch Students & Classes for Assign Modal & Filters
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
        const studentList: StudentItem[] = sData.data || [];
        setStudents(studentList);
      }
      if (classesRes.ok) {
        const cData = await classesRes.json();
        setClasses(cData.data || []);
      }
    } catch (err) {
      console.error("Error loading dropdown data:", err);
    }
  }

  // Fetch Student Fees with Search, Status, Class & Admission Level Filters (FIX-008 & FIX-016)
  async function fetchStudentFees(
    query: string = searchQuery,
    status: string = statusFilter,
    classId: string = classFilter,
    admLevel: string = admissionLevelFilter
  ) {
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
      if (classId !== "ALL") params.append("classId", classId);
      if (admLevel !== "ALL") params.append("admissionLevel", admLevel);

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
      fetchStudentFees(searchQuery, statusFilter, classFilter, admissionLevelFilter);
    }
  }, [activeTab, statusFilter, classFilter, admissionLevelFilter]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    fetchStudentFees(q, statusFilter, classFilter, admissionLevelFilter);
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

  // Handle Edit Fee Structure (FIX-011)
  async function handleEditStructureSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingStructure) return;
    setError("");
    setSuccessMessage("");

    if (!editStructureForm.name.trim() || !editStructureForm.amount || !editStructureForm.dueDate) {
      setError("Please fill in all required fields.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setEditingStructureSubmitting(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload = {
        name: editStructureForm.name.trim(),
        type: editStructureForm.type,
        amount: editStructureForm.amount.trim(),
        academicYear: editStructureForm.academicYear.trim(),
        term: editStructureForm.term.trim() || undefined,
        dueDate: editStructureForm.dueDate,
      };

      const res = await fetch(`/api/fees/structures/${editingStructure.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update fee structure.");

      setEditingStructure(null);
      setSuccessMessage(`Fee structure "${payload.name}" updated successfully!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchStructures();
    } catch (err: any) {
      setError(err.message || "An error occurred while updating fee structure.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setEditingStructureSubmitting(false);
    }
  }

  // Handle Assign Fee (Single, Class, or Admission Level)
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
    if (assignMode === "admissionLevel" && !selectedAdmissionLevel) {
      setError("Please select an admission level to assign this fee.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setAssigningFee(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload = {
        feeStructureId: assigningStructure.id,
        ...(assignMode === "single"
          ? { studentId: selectedStudentId }
          : assignMode === "class"
          ? { classId: selectedClassId }
          : { admissionLevel: selectedAdmissionLevel }),
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

      if ((assignMode === "class" || assignMode === "admissionLevel") && data.summary) {
        setSuccessMessage(
          `Fee assigned to ${assignMode === "class" ? "class" : "admission level"}! Assigned: ${data.summary.assigned}, Skipped (Already Assigned): ${data.summary.skipped}`
        );
      } else {
        setSuccessMessage("Fee structure assigned successfully!");
      }
      setTimeout(() => setSuccessMessage(""), 4000);

      setAssigningStructure(null);
      setSelectedStudentId("");
      setSelectedClassId("");
      setSelectedAdmissionLevel("");
      fetchStructures();
      if (activeTab === "student_fees") fetchStudentFees();
    } catch (err: any) {
      setError(err.message || "An error occurred while assigning fee.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setAssigningFee(false);
    }
  }

  // Handle Manual Fee Status Change (FIX-017)
  function handleOpenChangeStatus(fee: StudentFeeItem) {
    setError("");
    setSuccessMessage("");
    if (fee.status === "PAID") {
      setError("Cannot manually change status of a fully paid fee. Fully paid fees are locked to preserve payment audit integrity.");
      setTimeout(() => setError(""), 6000);
      return;
    }
    setChangingStatusFee(fee);
    let defaultTarget = "PENDING";
    if (fee.status === "PENDING") defaultTarget = "OVERDUE";
    else if (fee.status === "OVERDUE") defaultTarget = "PENDING";
    else if (fee.status === "WAIVED") defaultTarget = "PENDING";
    else if (fee.status === "PARTIAL") defaultTarget = "PENDING";
    setTargetStatus(defaultTarget);
    setStatusReason("");
  }

  async function handleChangeStatusSubmit(e: FormEvent) {
    e.preventDefault();
    if (!changingStatusFee) return;
    setError("");
    setSuccessMessage("");

    if (!statusReason.trim()) {
      setError("A reason is required when changing fee status.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setSubmittingStatusChange(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/fees/${changingStatusFee.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: targetStatus,
          note: statusReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update fee status.");

      setChangingStatusFee(null);
      setSuccessMessage(`Fee status updated to ${targetStatus} successfully!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchStudentFees();
    } catch (err: any) {
      setError(err.message || "An error occurred while updating fee status.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setSubmittingStatusChange(false);
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

      const createdPayment = data.data?.payment;
      setPayingFee(null);
      setPaymentForm({ amount: "", method: "cash", reference: "" });
      setRawAmount("");
      setDisplayAmount("");
      const receiptMsg = createdPayment?.receiptNumber ? ` (Receipt: ${createdPayment.receiptNumber})` : "";
      setSuccessMessage(`Payment of ${formatNaira(payAmount)} recorded successfully!${receiptMsg}`);
      setTimeout(() => setSuccessMessage(""), 5000);
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setError("");
                              setAssigningStructure(st);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <span>Assign Fee</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditStructure(st)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteStructureClick(st)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-xs transition-colors border border-rose-200/80 cursor-pointer"
                          >
                            <span>Delete</span>
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
      )}

      {/* =================================================================== */}
      {/* TAB 2: STUDENT FEES TAB                                             */}
      {/* =================================================================== */}
      {activeTab === "student_fees" && (
        <div className="space-y-6">
          {/* Controls & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input & Filters Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
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

              {/* Class Filter Dropdown (FIX-008) */}
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
              >
                <option value="ALL">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Admission Level Filter Dropdown (FIX-016) */}
              <select
                value={admissionLevelFilter}
                onChange={(e) => setAdmissionLevelFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
              >
                <option value="ALL">All Admission Levels</option>
                {availableLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 md:pt-0">
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
                            <div className="text-[11px] font-mono text-slate-400 font-normal">
                              {fee.student.studentId}
                            </div>
                            <div className="text-xs text-blue-600 font-semibold mt-0.5">
                              {fee.student.classEnrollments?.[0]?.class?.name || "—"}
                            </div>
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
                            {Number(fee.amountPaid) > 0 && (
                              <button
                                onClick={() => handleOpenViewReceipts(fee)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-700 font-semibold text-xs transition-colors cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                <span>Receipts</span>
                              </button>
                            )}
                            {!isFullyPaid && (
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
                            )}
                            {fee.status !== "PAID" && (
                              <button
                                onClick={() => handleOpenChangeStatus(fee)}
                                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                              >
                                Change Status
                              </button>
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
      {/* MODAL 1B: EDIT FEE STRUCTURE (FIX-011)                              */}
      {/* =================================================================== */}
      {editingStructure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base">Edit Fee Structure</h3>
              <button
                onClick={() => setEditingStructure(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditStructureSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Structure Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. First Term Tuition 2025/2026"
                  value={editStructureForm.name}
                  onChange={(e) => setEditStructureForm({ ...editStructureForm, name: e.target.value })}
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
                    value={editStructureForm.type}
                    onChange={(e) => setEditStructureForm({ ...editStructureForm, type: e.target.value as FeeType })}
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
                    value={editStructureDisplayAmount}
                    onChange={handleEditStructureAmountChange}
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
                    value={editStructureForm.academicYear}
                    onChange={(e) => setEditStructureForm({ ...editStructureForm, academicYear: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Term
                  </label>
                  <select
                    value={editStructureForm.term}
                    onChange={(e) => setEditStructureForm({ ...editStructureForm, term: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">None</option>
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
                  value={editStructureForm.dueDate}
                  onChange={(e) => setEditStructureForm({ ...editStructureForm, dueDate: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStructure(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingStructureSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {editingStructureSubmitting && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1C: DELETE FEE STRUCTURE CONFIRMATION (FIX-012)               */}
      {/* =================================================================== */}
      {deletingStructure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-lg">Delete Fee Structure?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete <strong className="text-slate-800">&quot;{deletingStructure.name}&quot;</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingStructure(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStructureConfirm}
                disabled={deletingStructureSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {deletingStructureSubmitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Delete Structure</span>
              </button>
            </div>
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
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
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
                  <button
                    type="button"
                    onClick={() => setAssignMode("admissionLevel")}
                    className={`py-2 rounded-lg transition-all ${
                      assignMode === "admissionLevel" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    By Admission Level
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
                        {c.name} — {c.academicYear}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Option 3: By Admission Level (FIX-009 / FIX-014) */}
              {assignMode === "admissionLevel" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Admission Level *
                  </label>
                  <select
                    value={selectedAdmissionLevel}
                    onChange={(e) => setSelectedAdmissionLevel(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">Select an admission level...</option>
                    {availableLevels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
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
      {/* MODAL 5: CHANGE FEE STATUS (FIX-017)                                */}
      {/* =================================================================== */}
      {changingStatusFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Change Fee Status</h3>
                <p className="text-xs text-slate-500">
                  {changingStatusFee.student.firstName} {changingStatusFee.student.lastName} ({changingStatusFee.feeStructure.name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChangingStatusFee(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleChangeStatusSubmit} className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Status:</span>
                  <span>{renderStatusBadge(changingStatusFee.status)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Due:</span>
                  <strong className="text-slate-900">{formatNaira(changingStatusFee.amountDue)}</strong>
                </div>
              </div>

              {/* Target Status Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  New Status *
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                >
                  {changingStatusFee.status === "PENDING" && (
                    <>
                      <option value="OVERDUE">OVERDUE</option>
                      <option value="WAIVED">WAIVED</option>
                    </>
                  )}
                  {changingStatusFee.status === "OVERDUE" && (
                    <>
                      <option value="PENDING">PENDING</option>
                      <option value="WAIVED">WAIVED</option>
                    </>
                  )}
                  {changingStatusFee.status === "WAIVED" && (
                    <>
                      <option value="PENDING">PENDING</option>
                      <option value="OVERDUE">OVERDUE</option>
                    </>
                  )}
                  {changingStatusFee.status === "PARTIAL" && (
                    <option value="PENDING">PENDING</option>
                  )}
                </select>
              </div>

              {/* Reason Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Reason for Status Change *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Correcting status after administrative review..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setChangingStatusFee(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStatusChange}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingStatusChange && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Update Status</span>
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

      {/* =================================================================== */}
      {/* MODAL 6: PAYMENT RECEIPTS HISTORY (FIX-010)                        */}
      {/* =================================================================== */}
      {viewingReceiptsFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Payment Receipts</h3>
                <p className="text-xs text-slate-500">
                  {viewingReceiptsFee.student.firstName} {viewingReceiptsFee.student.lastName} — {viewingReceiptsFee.feeStructure.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingReceiptsFee(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Due</span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    {formatNaira(viewingReceiptsFee.amountDue)}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Paid</span>
                  <span className="text-sm font-extrabold text-emerald-700 font-mono">
                    {formatNaira(viewingReceiptsFee.amountPaid)}
                  </span>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">Balance</span>
                  <span className="text-sm font-extrabold text-blue-700 font-mono">
                    {formatNaira(
                      Math.max(
                        0,
                        parseFloat(String(viewingReceiptsFee.amountDue)) - parseFloat(String(viewingReceiptsFee.amountPaid))
                      )
                    )}
                  </span>
                </div>
              </div>

              {/* Payments List */}
              {loadingFeePayments ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <span className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p>Loading receipts...</p>
                </div>
              ) : feePayments.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No payment records found for this fee.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {feePayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {payment.receiptNumber}
                          </span>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {payment.method.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Paid on {new Date(payment.paidAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          {payment.reference ? ` • Ref: ${payment.reference}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="text-sm font-extrabold text-emerald-700 font-mono">
                          {formatNaira(payment.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(viewingReceiptsFee.id, payment.id, payment.receiptNumber)}
                          disabled={downloadingPaymentId === payment.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {downloadingPaymentId === payment.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                          )}
                          <span>Download Receipt (PDF)</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 flex justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingReceiptsFee(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
