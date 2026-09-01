"use client";

import { useEffect, useState, useMemo, useRef, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Types
type FeeType = "TUITION" | "TRANSPORT" | "UNIFORM" | "EXAM" | "MISCELLANEOUS" | "FEEDING";
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

interface FeePackageItem {
  id: string;
  name: string;
  description?: string | null;
  academicYear: string;
  term?: string | null;
  totalAmount: string;
  structuresCount: number;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    feeStructureId: string;
    feeStructure: {
      id: string;
      name: string;
      type: FeeType;
      amount: string;
      academicYear: string;
      term?: string | null;
      dueDate: string;
    } | null;
  }>;
}

interface PackageBalanceComponent {
  feeId: string | null;
  feeStructureId: string;
  name: string;
  type: FeeType;
  amountDue: string;
  amountPaid: string;
  remainingBalance: string;
  status: string;
  isAssigned: boolean;
}

interface PackageBalanceData {
  package: { id: string; name: string; academicYear: string; term?: string | null; totalAmount: string };
  student: { id: string; studentId: string; firstName: string; lastName: string; admissionLevel?: string | null; className?: string | null };
  components: PackageBalanceComponent[];
  totalDue: string;
  totalPaid: string;
  totalRemaining: string;
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
  payments?: PaymentItem[];
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

function FeesTabSync({ onTabChange }: { onTabChange: (tab: "structures" | "student_fees" | "packages") => void }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get("tab") : null;

  useEffect(() => {
    if (tabParam === "student_fees" || tabParam === "students") {
      onTabChange("student_fees");
    } else if (tabParam === "packages") {
      onTabChange("packages");
    } else if (tabParam === "structures") {
      onTabChange("structures");
    }
  }, [tabParam, onTabChange]);

  return null;
}

export default function FeesManagementPage() {
  const [activeTab, setActiveTab] = useState<"structures" | "student_fees" | "packages">("structures");

  // Tab 1: Fee Structures State & Filters
  const [structures, setStructures] = useState<FeeStructureItem[]>([]);
  const [allStructuresForFilters, setAllStructuresForFilters] = useState<FeeStructureItem[]>([]);
  const [loadingStructures, setLoadingStructures] = useState(true);
  const [structureSessionFilter, setStructureSessionFilter] = useState<string>("ALL");
  const [structureTermFilter, setStructureTermFilter] = useState<string>("ALL");
  const [isCreateStructureOpen, setIsCreateStructureOpen] = useState(false);
  const [createStructureForm, setCreateStructureForm] = useState({
    name: "",
    type: "TUITION" as FeeType,
    amount: "",
    academicYear: "2025/2026",
    term: "First Term",
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
  const [assignModalError, setAssignModalError] = useState("");

  // Multi-Select Fee Structures State
  const [selectedStructureIds, setSelectedStructureIds] = useState<string[]>([]);
  const [isMultiAssignOpen, setIsMultiAssignOpen] = useState(false);
  const [multiAssignMode, setMultiAssignMode] = useState<"single" | "class" | "admissionLevel">("single");
  const [multiAssignStudentId, setMultiAssignStudentId] = useState("");
  const [multiAssignClassId, setMultiAssignClassId] = useState("");
  const [multiAssignAdmissionLevel, setMultiAssignAdmissionLevel] = useState("");
  const [submittingMultiAssign, setSubmittingMultiAssign] = useState(false);

  // Tab 3: Fee Packages State & Filters
  const [packages, setPackages] = useState<FeePackageItem[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageSessionFilter, setPackageSessionFilter] = useState<string>("ALL");
  const [packageTermFilter, setPackageTermFilter] = useState<string>("ALL");

  // Create Package State
  const [isCreatePackageOpen, setIsCreatePackageOpen] = useState(false);
  const [createPackageForm, setCreatePackageForm] = useState({
    name: "",
    description: "",
    academicYear: "2025/2026",
    term: "First Term",
    feeStructureIds: [] as string[],
  });
  const [submittingCreatePackage, setSubmittingCreatePackage] = useState(false);

  // Edit Package State
  const [editingPackage, setEditingPackage] = useState<FeePackageItem | null>(null);
  const [editPackageForm, setEditPackageForm] = useState({
    name: "",
    description: "",
    academicYear: "2025/2026",
    term: "First Term",
    feeStructureIds: [] as string[],
  });
  const [submittingEditPackage, setSubmittingEditPackage] = useState(false);

  // Delete Package State
  const [deletingPackage, setDeletingPackage] = useState<FeePackageItem | null>(null);
  const [submittingDeletePackage, setSubmittingDeletePackage] = useState(false);

  // Assign Package State
  const [assigningPackage, setAssigningPackage] = useState<FeePackageItem | null>(null);
  const [assignPackageMode, setAssignPackageMode] = useState<"single" | "class" | "admissionLevel">("single");
  const [assignPackageStudentId, setAssignPackageStudentId] = useState("");
  const [assignPackageClassId, setAssignPackageClassId] = useState("");
  const [assignPackageAdmissionLevel, setAssignPackageAdmissionLevel] = useState("");
  const [submittingAssignPackage, setSubmittingAssignPackage] = useState(false);

  // Record Package Payment State
  const [payingPackage, setPayingPackage] = useState<FeePackageItem | null>(null);
  const [payPackageStudentId, setPayPackageStudentId] = useState("");
  const [loadingPackageBalances, setLoadingPackageBalances] = useState(false);
  const [packageBalanceData, setPackageBalanceData] = useState<PackageBalanceData | null>(null);
  const [packagePaymentAmount, setPackagePaymentAmount] = useState("");
  const [packagePaymentMethod, setPackagePaymentMethod] = useState("cash");
  const [packagePaymentReference, setPackagePaymentReference] = useState("");
  const [packagePaymentNote, setPackagePaymentNote] = useState("");
  const [customAllocations, setCustomAllocations] = useState<Record<string, string>>({});
  const [submittingPackagePayment, setSubmittingPackagePayment] = useState(false);
  const [packagePaymentModalError, setPackagePaymentModalError] = useState("");
  const [downloadingPackagePaymentId, setDownloadingPackagePaymentId] = useState<string | null>(null);
  const [lastPackagePaymentResult, setLastPackagePaymentResult] = useState<{ id: string; receiptNumber: string } | null>(null);

  // Package Payment History State (Modal 11)
  const [historyPackage, setHistoryPackage] = useState<FeePackageItem | null>(null);
  const [packageHistoryPayments, setPackageHistoryPayments] = useState<Array<{
    id: string;
    receiptNumber: string;
    amount: string;
    method: string;
    reference: string | null;
    note: string | null;
    createdAt: string;
    student?: {
      id: string;
      firstName: string;
      lastName: string;
      studentId: string;
      admissionLevel: string | null;
    };
  }>>([]);
  const [loadingPackageHistory, setLoadingPackageHistory] = useState(false);
  const [packageHistoryError, setPackageHistoryError] = useState("");

  // Tab 2: Student Fees State & Filters
  const [studentFees, setStudentFees] = useState<StudentFeeItem[]>([]);
  const [loadingStudentFees, setLoadingStudentFees] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [admissionLevelFilter, setAdmissionLevelFilter] = useState<string>("ALL");
  const [studentFeeSessionFilter, setStudentFeeSessionFilter] = useState<string>("ALL");
  const [studentFeeTermFilter, setStudentFeeTermFilter] = useState<string>("ALL");
  const [paidFromFilter, setPaidFromFilter] = useState<string>("");
  const [paidToFilter, setPaidToFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Derived distinct Academic Years (Sessions) across all fee structures
  const availableStructureSessions = useMemo(() => {
    const set = new Set<string>();
    allStructuresForFilters.forEach((s) => {
      if (s.academicYear?.trim()) set.add(s.academicYear.trim());
    });
    return Array.from(set).sort().reverse();
  }, [allStructuresForFilters]);

  // Derived distinct Terms for Tab 1 (Fee Structures) based on selected structure session
  const availableStructureTerms = useMemo(() => {
    const set = new Set<string>();
    const filtered = structureSessionFilter === "ALL"
      ? allStructuresForFilters
      : allStructuresForFilters.filter((s) => s.academicYear === structureSessionFilter);
    filtered.forEach((s) => {
      if (s.term?.trim()) set.add(s.term.trim());
    });
    return Array.from(set).sort();
  }, [allStructuresForFilters, structureSessionFilter]);

  // Derived distinct Terms for Tab 2 (Student Fees) based on selected student fee session
  const availableStudentFeeTerms = useMemo(() => {
    const set = new Set<string>();
    const filtered = studentFeeSessionFilter === "ALL"
      ? allStructuresForFilters
      : allStructuresForFilters.filter((s) => s.academicYear === studentFeeSessionFilter);
    filtered.forEach((s) => {
      if (s.term?.trim()) set.add(s.term.trim());
    });
    return Array.from(set).sort();
  }, [allStructuresForFilters, studentFeeSessionFilter]);

  // Derived distinct Sessions for Tab 3 (Fee Packages)
  const availablePackageSessions = useMemo(() => {
    const set = new Set<string>();
    packages.forEach((p) => {
      if (p.academicYear?.trim()) set.add(p.academicYear.trim());
    });
    allStructuresForFilters.forEach((s) => {
      if (s.academicYear?.trim()) set.add(s.academicYear.trim());
    });
    return Array.from(set).sort();
  }, [packages, allStructuresForFilters]);

  // Derived distinct Terms for Tab 3 (Fee Packages)
  const availablePackageTerms = useMemo(() => {
    const set = new Set<string>();
    const filtered = packageSessionFilter === "ALL"
      ? packages
      : packages.filter((p) => p.academicYear === packageSessionFilter);
    filtered.forEach((p) => {
      if (p.term?.trim()) set.add(p.term.trim());
    });
    allStructuresForFilters
      .filter((s) => packageSessionFilter === "ALL" || s.academicYear === packageSessionFilter)
      .forEach((s) => {
        if (s.term?.trim()) set.add(s.term.trim());
      });
    return Array.from(set).sort();
  }, [packages, allStructuresForFilters, packageSessionFilter]);

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

  // Table Row Kebab Menu State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-row-menu]")) {
        setOpenMenuId(null);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenuId(null);
      }
    }

    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

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
      fetchAllStructuresForFilters();
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

  // Fetch Fee Structures (with optional Session & Term filtering)
  async function fetchStructures(session: string = structureSessionFilter, term: string = structureTermFilter) {
    try {
      setLoadingStructures(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const params = new URLSearchParams();
      if (session !== "ALL") params.append("academicYear", session);
      if (term !== "ALL") params.append("term", term);

      const url = `/api/fees/structures${params.toString() ? `?${params.toString()}` : ""}`;

      const res = await fetch(url, {
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

  // Fetch all structures once to populate filter options across both tabs
  async function fetchAllStructuresForFilters() {
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/fees/structures", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAllStructuresForFilters(data.data || []);
      }
    } catch (err) {
      console.error("Error loading filter structures:", err);
    }
  }

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

  // Fetch Student Fees with Search, Status, Class, Admission Level, Session, Term & Date-Paid Filters
  async function fetchStudentFees(
    query: string = searchQuery,
    status: string = statusFilter,
    classId: string = classFilter,
    admLevel: string = admissionLevelFilter,
    session: string = studentFeeSessionFilter,
    term: string = studentFeeTermFilter,
    paidFrom: string = paidFromFilter,
    paidTo: string = paidToFilter
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
      if (session !== "ALL") params.append("academicYear", session);
      if (term !== "ALL") params.append("term", term);
      if (paidFrom.trim()) params.append("paidFrom", paidFrom.trim());
      if (paidTo.trim()) params.append("paidTo", paidTo.trim());

      const url = `/api/fees${params.toString() ? `?${params.toString()}` : ""}`;

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

  // Fetch Fee Packages with Session & Term Filters
  async function fetchPackages(
    session: string = packageSessionFilter,
    term: string = packageTermFilter
  ) {
    try {
      setLoadingPackages(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const params = new URLSearchParams();
      if (session !== "ALL") params.append("academicYear", session);
      if (term !== "ALL") params.append("term", term);

      const url = `/api/fees/packages${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPackages(data.data || []);
      }
    } catch (err) {
      console.error("Error loading fee packages:", err);
    } finally {
      setLoadingPackages(false);
    }
  }

  useEffect(() => {
    fetchStructures();
    fetchAllStructuresForFilters();
    fetchStudentsAndClasses();
  }, []);

  useEffect(() => {
    if (activeTab === "student_fees") {
      fetchStudentFees(
        searchQuery,
        statusFilter,
        classFilter,
        admissionLevelFilter,
        studentFeeSessionFilter,
        studentFeeTermFilter,
        paidFromFilter,
        paidToFilter
      );
    } else if (activeTab === "packages") {
      fetchPackages(packageSessionFilter, packageTermFilter);
    }
  }, [activeTab]);

  // Tab 3 Filter Handlers
  const hasActivePackageFilters = packageSessionFilter !== "ALL" || packageTermFilter !== "ALL";

  const handlePackageSessionChange = (session: string) => {
    setPackageSessionFilter(session);
    let nextTerm = packageTermFilter;
    if (session === "ALL") {
      nextTerm = "ALL";
    } else {
      const validTerms = Array.from(new Set(
        allStructuresForFilters
          .filter((s) => s.academicYear === session)
          .map((s) => s.term?.trim())
          .filter(Boolean)
      ));
      if (!validTerms.includes(packageTermFilter)) {
        nextTerm = "ALL";
      }
    }
    setPackageTermFilter(nextTerm);
    fetchPackages(session, nextTerm);
  };

  const handlePackageTermChange = (term: string) => {
    setPackageTermFilter(term);
    fetchPackages(packageSessionFilter, term);
  };

  const handleResetPackageFilters = () => {
    setPackageSessionFilter("ALL");
    setPackageTermFilter("ALL");
    fetchPackages("ALL", "ALL");
  };

  // Tab 1 Filter Handlers
  const hasActiveStructureFilters = structureSessionFilter !== "ALL" || structureTermFilter !== "ALL";

  const handleStructureSessionChange = (session: string) => {
    setStructureSessionFilter(session);
    let nextTerm = structureTermFilter;
    if (session === "ALL") {
      nextTerm = "ALL";
    } else {
      const validTerms = Array.from(new Set(
        allStructuresForFilters
          .filter((s) => s.academicYear === session)
          .map((s) => s.term?.trim())
          .filter(Boolean)
      ));
      if (!validTerms.includes(structureTermFilter)) {
        nextTerm = "ALL";
      }
    }
    setStructureTermFilter(nextTerm);
    fetchStructures(session, nextTerm);
  };

  const handleStructureTermChange = (term: string) => {
    setStructureTermFilter(term);
    fetchStructures(structureSessionFilter, term);
  };

  const handleResetStructureFilters = () => {
    setStructureSessionFilter("ALL");
    setStructureTermFilter("ALL");
    fetchStructures("ALL", "ALL");
  };

  // Tab 2 Filter Handlers
  const hasActiveStudentFeeFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "ALL" ||
    classFilter !== "ALL" ||
    admissionLevelFilter !== "ALL" ||
    studentFeeSessionFilter !== "ALL" ||
    studentFeeTermFilter !== "ALL" ||
    paidFromFilter !== "" ||
    paidToFilter !== "";

  const handleStudentFeeSessionChange = (session: string) => {
    setStudentFeeSessionFilter(session);
    let nextTerm = studentFeeTermFilter;
    if (session === "ALL") {
      nextTerm = "ALL";
    } else {
      const validTerms = Array.from(new Set(
        allStructuresForFilters
          .filter((s) => s.academicYear === session)
          .map((s) => s.term?.trim())
          .filter(Boolean)
      ));
      if (!validTerms.includes(studentFeeTermFilter)) {
        nextTerm = "ALL";
      }
    }
    setStudentFeeTermFilter(nextTerm);
    fetchStudentFees(
      searchQuery,
      statusFilter,
      classFilter,
      admissionLevelFilter,
      session,
      nextTerm,
      paidFromFilter,
      paidToFilter
    );
  };

  const handleStudentFeeTermChange = (term: string) => {
    setStudentFeeTermFilter(term);
    fetchStudentFees(
      searchQuery,
      statusFilter,
      classFilter,
      admissionLevelFilter,
      studentFeeSessionFilter,
      term,
      paidFromFilter,
      paidToFilter
    );
  };

  const handleClassFilterChange = (classId: string) => {
    setClassFilter(classId);
    fetchStudentFees(
      searchQuery,
      statusFilter,
      classId,
      admissionLevelFilter,
      studentFeeSessionFilter,
      studentFeeTermFilter,
      paidFromFilter,
      paidToFilter
    );
  };

  const handleAdmissionLevelFilterChange = (lvl: string) => {
    setAdmissionLevelFilter(lvl);
    fetchStudentFees(
      searchQuery,
      statusFilter,
      classFilter,
      lvl,
      studentFeeSessionFilter,
      studentFeeTermFilter,
      paidFromFilter,
      paidToFilter
    );
  };

  const handleStatusFilterChange = (st: string) => {
    setStatusFilter(st);
    fetchStudentFees(
      searchQuery,
      st,
      classFilter,
      admissionLevelFilter,
      studentFeeSessionFilter,
      studentFeeTermFilter,
      paidFromFilter,
      paidToFilter
    );
  };

  const handlePaidFromChange = (val: string) => {
    setPaidFromFilter(val);
    fetchStudentFees(
      searchQuery,
      statusFilter,
      classFilter,
      admissionLevelFilter,
      studentFeeSessionFilter,
      studentFeeTermFilter,
      val,
      paidToFilter
    );
  };

  const handlePaidToChange = (val: string) => {
    setPaidToFilter(val);
    fetchStudentFees(
      searchQuery,
      statusFilter,
      classFilter,
      admissionLevelFilter,
      studentFeeSessionFilter,
      studentFeeTermFilter,
      paidFromFilter,
      val
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    fetchStudentFees(
      q,
      statusFilter,
      classFilter,
      admissionLevelFilter,
      studentFeeSessionFilter,
      studentFeeTermFilter,
      paidFromFilter,
      paidToFilter
    );
  };

  const handleResetStudentFeeFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setClassFilter("ALL");
    setAdmissionLevelFilter("ALL");
    setStudentFeeSessionFilter("ALL");
    setStudentFeeTermFilter("ALL");
    setPaidFromFilter("");
    setPaidToFilter("");
    fetchStudentFees("", "ALL", "ALL", "ALL", "ALL", "ALL", "", "");
  };

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
      fetchAllStructuresForFilters();
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
      fetchAllStructuresForFilters();
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
    setAssignModalError("");
    setSuccessMessage("");
    setAssignSummary(null);

    if (assignMode === "single" && !selectedStudentId) {
      setAssignModalError("Please select a student to assign this fee.");
      return;
    }
    if (assignMode === "class" && !selectedClassId) {
      setAssignModalError("Please select a class to assign this fee.");
      return;
    }
    if (assignMode === "admissionLevel" && !selectedAdmissionLevel) {
      setAssignModalError("Please select an admission level to assign this fee.");
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
      setAssignModalError("");
      fetchStructures();
      if (activeTab === "student_fees") fetchStudentFees();
    } catch (err: any) {
      setAssignModalError(err.message || "An error occurred while assigning fee.");
    } finally {
      setAssigningFee(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Multi-Select Fee Structures Handlers
  // ---------------------------------------------------------------------------
  function toggleStructureSelection(id: string) {
    setSelectedStructureIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAllStructures() {
    if (selectedStructureIds.length === structures.length) {
      setSelectedStructureIds([]);
    } else {
      setSelectedStructureIds(structures.map((s) => s.id));
    }
  }

  const selectedStructures = useMemo(() => {
    return structures.filter((s) => selectedStructureIds.includes(s.id));
  }, [structures, selectedStructureIds]);

  const selectedTotalAmount = useMemo(() => {
    return selectedStructures.reduce(
      (sum, s) => sum + (typeof s.amount === "number" ? s.amount : parseFloat(s.amount as string) || 0),
      0
    );
  }, [selectedStructures]);

  async function handleMultiAssignSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedStructureIds.length === 0) return;
    setError("");
    setSuccessMessage("");

    if (multiAssignMode === "single" && !multiAssignStudentId) {
      setError("Please select a student.");
      setTimeout(() => setError(""), 4000);
      return;
    }
    if (multiAssignMode === "class" && !multiAssignClassId) {
      setError("Please select a class.");
      setTimeout(() => setError(""), 4000);
      return;
    }
    if (multiAssignMode === "admissionLevel" && !multiAssignAdmissionLevel) {
      setError("Please select an admission level.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setSubmittingMultiAssign(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload = {
        feeStructureIds: selectedStructureIds,
        ...(multiAssignMode === "single"
          ? { studentId: multiAssignStudentId }
          : multiAssignMode === "class"
          ? { classId: multiAssignClassId }
          : { admissionLevel: multiAssignAdmissionLevel }),
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
      if (!res.ok) throw new Error(data.error || "Failed to assign fees.");

      const summary = data.data;
      setSuccessMessage(
        `Successfully assigned ${summary.structuresProcessed} fee structures! Created ${summary.totalFeesCreated} fee records (Skipped ${summary.totalFeesSkipped} already assigned).`
      );
      setTimeout(() => setSuccessMessage(""), 5000);

      setIsMultiAssignOpen(false);
      setSelectedStructureIds([]);
      setMultiAssignStudentId("");
      setMultiAssignClassId("");
      setMultiAssignAdmissionLevel("");
      fetchStructures();
      if (activeTab === "student_fees") fetchStudentFees();
    } catch (err: any) {
      setError(err.message || "An error occurred while assigning fees.");
      setTimeout(() => setError(""), 5000);
    } finally {
      setSubmittingMultiAssign(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Fee Package Handlers
  // ---------------------------------------------------------------------------
  async function handleCreatePackageSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!createPackageForm.name.trim() || !createPackageForm.academicYear.trim()) {
      setError("Please fill in package name and academic session.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    if (createPackageForm.feeStructureIds.length === 0) {
      setError("Please select at least one fee structure for this package.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setSubmittingCreatePackage(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload = {
        name: createPackageForm.name.trim(),
        description: createPackageForm.description.trim() || undefined,
        academicYear: createPackageForm.academicYear.trim(),
        term: createPackageForm.term.trim() || undefined,
        feeStructureIds: createPackageForm.feeStructureIds,
      };

      const res = await fetch("/api/fees/packages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create fee package.");

      setIsCreatePackageOpen(false);
      setCreatePackageForm({
        name: "",
        description: "",
        academicYear: "2025/2026",
        term: "First Term",
        feeStructureIds: [],
      });
      setSuccessMessage(`Fee package "${payload.name}" created successfully!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchPackages();
    } catch (err: any) {
      setError(err.message || "An error occurred while creating fee package.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setSubmittingCreatePackage(false);
    }
  }

  function handleOpenEditPackage(pkg: FeePackageItem) {
    setError("");
    setEditingPackage(pkg);
    setEditPackageForm({
      name: pkg.name,
      description: pkg.description || "",
      academicYear: pkg.academicYear,
      term: pkg.term || "First Term",
      feeStructureIds: pkg.items.map((it) => it.feeStructureId),
    });
  }

  async function handleEditPackageSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingPackage) return;
    setError("");
    setSuccessMessage("");

    if (!editPackageForm.name.trim() || !editPackageForm.academicYear.trim()) {
      setError("Please fill in package name and academic session.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    if (editPackageForm.feeStructureIds.length === 0) {
      setError("Please select at least one fee structure for this package.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setSubmittingEditPackage(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload = {
        name: editPackageForm.name.trim(),
        description: editPackageForm.description.trim() || undefined,
        academicYear: editPackageForm.academicYear.trim(),
        term: editPackageForm.term.trim() || undefined,
        feeStructureIds: editPackageForm.feeStructureIds,
      };

      const res = await fetch(`/api/fees/packages/${editingPackage.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update fee package.");

      setEditingPackage(null);
      setSuccessMessage(`Fee package "${payload.name}" updated successfully!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchPackages();
    } catch (err: any) {
      setError(err.message || "An error occurred while updating fee package.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setSubmittingEditPackage(false);
    }
  }

  function handleDeletePackageClick(pkg: FeePackageItem) {
    setError("");
    setDeletingPackage(pkg);
  }

  async function handleDeletePackageConfirm() {
    if (!deletingPackage) return;
    setError("");
    setSuccessMessage("");

    try {
      setSubmittingDeletePackage(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/fees/packages/${deletingPackage.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete fee package.");

      setDeletingPackage(null);
      setSuccessMessage("Fee package deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchPackages();
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting fee package.");
      setTimeout(() => setError(""), 4000);
      setDeletingPackage(null);
    } finally {
      setSubmittingDeletePackage(false);
    }
  }

  function handleOpenAssignPackage(pkg: FeePackageItem) {
    setError("");
    setAssigningPackage(pkg);
    setAssignPackageMode("single");
    setAssignPackageStudentId("");
    setAssignPackageClassId("");
    setAssignPackageAdmissionLevel("");
  }

  async function handleAssignPackageSubmit(e: FormEvent) {
    e.preventDefault();
    if (!assigningPackage) return;
    setError("");
    setSuccessMessage("");

    if (assignPackageMode === "single" && !assignPackageStudentId) {
      setError("Please select a student.");
      setTimeout(() => setError(""), 4000);
      return;
    }
    if (assignPackageMode === "class" && !assignPackageClassId) {
      setError("Please select a class.");
      setTimeout(() => setError(""), 4000);
      return;
    }
    if (assignPackageMode === "admissionLevel" && !assignPackageAdmissionLevel) {
      setError("Please select an admission level.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      setSubmittingAssignPackage(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload = {
        ...(assignPackageMode === "single"
          ? { studentId: assignPackageStudentId }
          : assignPackageMode === "class"
          ? { classId: assignPackageClassId }
          : { admissionLevel: assignPackageAdmissionLevel }),
      };

      const res = await fetch(`/api/fees/packages/${assigningPackage.id}/assign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign fee package.");

      const summary = data.data?.summary;
      setSuccessMessage(
        `Package "${assigningPackage.name}" assigned successfully! Created ${summary?.totalFeesCreated ?? 0} fee records (Skipped ${summary?.totalFeesSkipped ?? 0} already assigned).`
      );
      setTimeout(() => setSuccessMessage(""), 5000);

      setAssigningPackage(null);
      setAssignPackageStudentId("");
      setAssignPackageClassId("");
      setAssignPackageAdmissionLevel("");
      fetchStructures();
      if (activeTab === "student_fees") fetchStudentFees();
    } catch (err: any) {
      setError(err.message || "An error occurred while assigning package.");
      setTimeout(() => setError(""), 5000);
    } finally {
      setSubmittingAssignPackage(false);
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

  // Handle Open Package Payment Modal
  function handleOpenPayPackageModal(pkg: FeePackageItem) {
    setError("");
    setPackagePaymentModalError("");
    setPayingPackage(pkg);
    setPayPackageStudentId("");
    setPackageBalanceData(null);
    setPackagePaymentAmount("");
    setPackagePaymentMethod("cash");
    setPackagePaymentReference("");
    setPackagePaymentNote("");
    setCustomAllocations({});
  }

  // Handle Package Student Selection & Balance Lookup
  async function handlePackageStudentSelect(studentId: string) {
    setPayPackageStudentId(studentId);
    setPackagePaymentModalError("");
    setPackageBalanceData(null);
    setCustomAllocations({});
    if (!studentId || !payingPackage) return;

    try {
      setLoadingPackageBalances(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/fees/packages/${payingPackage.id}/students/${studentId}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch student package fee balances.");

      const balanceInfo = data.data as PackageBalanceData;
      setPackageBalanceData(balanceInfo);
      setPackagePaymentAmount(balanceInfo.totalRemaining);

      const initialAlloc: Record<string, string> = {};
      for (const comp of balanceInfo.components) {
        if (comp.feeId && parseFloat(comp.remainingBalance) > 0) {
          initialAlloc[comp.feeId] = comp.remainingBalance;
        }
      }
      setCustomAllocations(initialAlloc);
    } catch (err: any) {
      setPackagePaymentModalError(err.message || "Failed to load student package balance.");
    } finally {
      setLoadingPackageBalances(false);
    }
  }

  // Handle Package Payment Submit
  async function handlePackagePaymentSubmit(e: FormEvent) {
    e.preventDefault();
    if (!payingPackage || !payPackageStudentId) return;
    setPackagePaymentModalError("");

    const totalAmt = parseFloat(packagePaymentAmount);
    if (isNaN(totalAmt) || totalAmt <= 0) {
      setPackagePaymentModalError("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (!packageBalanceData) {
      setPackagePaymentModalError("Student fee balances not loaded.");
      return;
    }

    const isFullSettlement = totalAmt === parseFloat(packageBalanceData.totalRemaining);
    let allocationsPayload: Array<{ feeId: string; amount: number }> | undefined = undefined;

    if (!isFullSettlement) {
      let sum = 0;
      const allocList: Array<{ feeId: string; amount: number }> = [];
      for (const comp of packageBalanceData.components) {
        if (comp.feeId) {
          const val = parseFloat(customAllocations[comp.feeId] || "0") || 0;
          if (val < 0) {
            setPackagePaymentModalError(`Allocation for ${comp.name} cannot be negative.`);
            return;
          }
          if (val > parseFloat(comp.remainingBalance)) {
            setPackagePaymentModalError(`Allocation for ${comp.name} exceeds remaining balance (₦${formatAmount(comp.remainingBalance)}).`);
            return;
          }
          if (val > 0) {
            allocList.push({ feeId: comp.feeId, amount: val });
          }
          sum += val;
        }
      }

      if (Math.abs(sum - totalAmt) > 0.009) {
        setPackagePaymentModalError(`Sum of component allocations (₦${formatAmount(sum)}) must equal total payment amount (₦${formatAmount(totalAmt)}).`);
        return;
      }

      allocationsPayload = allocList;
    }

    try {
      setSubmittingPackagePayment(true);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/fees/packages/${payingPackage.id}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: payPackageStudentId,
          amount: totalAmt,
          method: packagePaymentMethod,
          reference: packagePaymentReference.trim() || undefined,
          note: packagePaymentNote.trim() || undefined,
          allocations: allocationsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record package payment.");

      const pkgPayment = data.data?.packagePayment;
      const receiptNumber = pkgPayment?.receiptNumber || "";
      const paymentId = pkgPayment?.id || "";

      setPayingPackage(null);
      setLastPackagePaymentResult({ id: paymentId, receiptNumber });
      setSuccessMessage(`Package payment of ₦${formatAmount(totalAmt)} recorded successfully! (Receipt: ${receiptNumber})`);
      fetchStudentFees();
    } catch (err: any) {
      setPackagePaymentModalError(err.message || "An error occurred while recording package payment.");
    } finally {
      setSubmittingPackagePayment(false);
    }
  }

  // Handle Open Package Payment History Modal
  async function handleOpenPackagePaymentHistory(pkg: FeePackageItem) {
    setError("");
    setHistoryPackage(pkg);
    setPackageHistoryPayments([]);
    setPackageHistoryError("");
    setLoadingPackageHistory(true);
    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/fees/packages/${pkg.id}/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch package payment history.");

      setPackageHistoryPayments(data.data || []);
    } catch (err: any) {
      setPackageHistoryError(err.message || "Failed to load payment history.");
    } finally {
      setLoadingPackageHistory(false);
    }
  }

  // Handle Download Package Receipt PDF
  async function handleDownloadPackageReceipt(paymentId: string, receiptNumber: string) {
    try {
      setDownloadingPackagePaymentId(paymentId);
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/fees/package-payments/${paymentId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to download receipt.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `package-receipt-${receiptNumber.replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || "Failed to download package receipt.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setDownloadingPackagePaymentId(null);
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
      <Suspense fallback={null}>
        <FeesTabSync onTabChange={setActiveTab} />
      </Suspense>
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
                term: "First Term",
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

        {activeTab === "packages" && (
          <button
            onClick={() => {
              setError("");
              setCreatePackageForm({
                name: "",
                description: "",
                academicYear: structureSessionFilter !== "ALL" ? structureSessionFilter : "2025/2026",
                term: structureTermFilter !== "ALL" ? structureTermFilter : "First Term",
                feeStructureIds: [],
              });
              setIsCreatePackageOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Create Package</span>
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
          <div className="flex items-center gap-3">
            <span>{successMessage}</span>
            {lastPackagePaymentResult && (
              <button
                type="button"
                onClick={() => handleDownloadPackageReceipt(lastPackagePaymentResult.id, lastPackagePaymentResult.receiptNumber)}
                disabled={downloadingPackagePaymentId === lastPackagePaymentResult.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                {downloadingPackagePaymentId === lastPackagePaymentResult.id ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
                <span>Download Package Receipt (PDF)</span>
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setSuccessMessage("");
              setLastPackagePaymentResult(null);
            }}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
          >
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
          <button
            onClick={() => setActiveTab("packages")}
            className={`pb-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "packages"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Fee Packages
          </button>
        </nav>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: FEE STRUCTURES TAB                                           */}
      {/* =================================================================== */}
      {activeTab === "structures" && (
        <div className="space-y-4">
          {/* Fee Structures Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Session Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session:</label>
                <select
                  value={structureSessionFilter}
                  onChange={(e) => handleStructureSessionChange(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="ALL">All Sessions</option>
                  {availableStructureSessions.map((session) => (
                    <option key={session} value={session}>
                      {session}
                    </option>
                  ))}
                </select>
              </div>

              {/* Term Filter (Cascading) */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Term:</label>
                <select
                  value={structureTermFilter}
                  onChange={(e) => handleStructureTermChange(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="ALL">All Terms</option>
                  {availableStructureTerms.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reset Filters */}
            {hasActiveStructureFilters && (
              <button
                type="button"
                onClick={handleResetStructureFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Floating Multi-Select Toolbar */}
          {selectedStructureIds.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span>{selectedStructureIds.length} fee {selectedStructureIds.length === 1 ? "structure" : "structures"} selected</span>
                <span className="text-blue-700 font-mono">({formatNaira(selectedTotalAmount)})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setIsMultiAssignOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.765Z" />
                  </svg>
                  <span>Assign Selected</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStructureIds([])}
                  className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-blue-100/70 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Fee Structures Table */}
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
                <p className="text-sm font-semibold text-slate-800">
                  {hasActiveStructureFilters ? "No fee structures match the selected filters" : "No fee structures created yet"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {hasActiveStructureFilters
                    ? "Try adjusting or clearing your session and term filters."
                    : "Click \"Create Structure\" above to set up your school fee templates."}
                </p>
                {hasActiveStructureFilters && (
                  <button
                    type="button"
                    onClick={handleResetStructureFilters}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={structures.length > 0 && selectedStructureIds.length === structures.length}
                          onChange={toggleSelectAllStructures}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                          aria-label="Select all structures"
                        />
                      </th>
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
                    {structures.map((st) => {
                      const isSelected = selectedStructureIds.includes(st.id);
                      return (
                        <tr
                          key={st.id}
                          className={`transition-colors ${
                            isSelected ? "bg-blue-50/40 hover:bg-blue-50/70" : "hover:bg-slate-50/60"
                          }`}
                        >
                          <td className="w-10 px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStructureSelection(st.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                              aria-label={`Select ${st.name}`}
                            />
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900">
                            {st.name}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                st.type === "FEEDING"
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
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
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setError("");
                                  setAssignModalError("");
                                  setAssigningStructure(st);
                                  setSelectedStudentId("");
                                  setSelectedClassId("");
                                  setSelectedAdmissionLevel("");
                                }}
                                className="inline-flex items-center justify-center gap-1 w-28 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                              >
                                <span>Assign fee</span>
                              </button>

                              <div className="relative inline-block text-left" data-row-menu="true">
                                <button
                                  type="button"
                                  aria-label="More actions"
                                  aria-expanded={openMenuId === `structure-${st.id}`}
                                  onClick={() => setOpenMenuId(openMenuId === `structure-${st.id}` ? null : `structure-${st.id}`)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="5" r="1.75" />
                                    <circle cx="12" cy="12" r="1.75" />
                                    <circle cx="12" cy="19" r="1.75" />
                                  </svg>
                                </button>

                                {openMenuId === `structure-${st.id}` && (
                                  <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-white border border-slate-200/90 shadow-lg py-1 z-40 animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleOpenEditStructure(st);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                      </svg>
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleDeleteStructureClick(st);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                      </svg>
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
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
      {/* TAB 3: FEE PACKAGES TAB                                             */}
      {/* =================================================================== */}
      {activeTab === "packages" && (
        <div className="space-y-4">
          {/* Fee Packages Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Session Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session:</label>
                <select
                  value={packageSessionFilter}
                  onChange={(e) => handlePackageSessionChange(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="ALL">All Sessions</option>
                  {availablePackageSessions.map((session) => (
                    <option key={session} value={session}>
                      {session}
                    </option>
                  ))}
                </select>
              </div>

              {/* Term Filter (Cascading) */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Term:</label>
                <select
                  value={packageTermFilter}
                  onChange={(e) => handlePackageTermChange(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="ALL">All Terms</option>
                  {availablePackageTerms.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reset Filters */}
            {hasActivePackageFilters && (
              <button
                type="button"
                onClick={handleResetPackageFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Fee Packages Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loadingPackages ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {hasActivePackageFilters ? "No fee packages match the selected filters" : "No fee packages created yet"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {hasActivePackageFilters
                    ? "Try adjusting or clearing your session and term filters."
                    : "Create reusable fee bundles like \"Full Term Package\" (Tuition + Transport + Feeding) to assign in one click."}
                </p>
                {hasActivePackageFilters && (
                  <button
                    type="button"
                    onClick={handleResetPackageFilters}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Package Name</th>
                      <th className="px-6 py-3.5">Session / Term</th>
                      <th className="px-6 py-3.5">Bundled Structures</th>
                      <th className="px-6 py-3.5">Total Value (₦)</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {packages.map((pkg) => (
                      <tr key={pkg.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{pkg.name}</div>
                          {pkg.description && (
                            <div className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{pkg.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                          {pkg.academicYear} {pkg.term ? `(${pkg.term})` : ""}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {pkg.items.map((it) => (
                              <span
                                key={it.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                              >
                                <span>{it.feeStructure?.name || "Fee"}</span>
                                {it.feeStructure?.amount && (
                                  <span className="font-mono text-slate-500 font-bold">₦{formatAmount(it.feeStructure.amount)}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-extrabold text-slate-900 font-mono text-base">
                          {formatNaira(pkg.totalAmount)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenAssignPackage(pkg)}
                              className="inline-flex items-center justify-center gap-1 w-32 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                            >
                              <span>Assign package</span>
                            </button>

                            <div className="relative inline-block text-left" data-row-menu="true">
                              <button
                                type="button"
                                aria-label="More actions"
                                aria-expanded={openMenuId === `package-${pkg.id}`}
                                onClick={() => setOpenMenuId(openMenuId === `package-${pkg.id}` ? null : `package-${pkg.id}`)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="5" r="1.75" />
                                  <circle cx="12" cy="12" r="1.75" />
                                  <circle cx="12" cy="19" r="1.75" />
                                </svg>
                              </button>

                              {openMenuId === `package-${pkg.id}` && (
                                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white border border-slate-200/90 shadow-lg py-1 z-40 animate-in fade-in zoom-in-95 duration-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleOpenPayPackageModal(pkg);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0v-.75A.75.75 0 0 1 3 4.5h.75m0 0a9.015 9.015 0 0 1 7.5-3.75 9.015 9.015 0 0 1 7.5 3.75h.75a.75.75 0 0 1.75.75V6m0 0v.75a.75.75 0 0 1-.75.75H18m0 0a60.07 60.07 0 0 0-15.797-2.101M3.75 6H18" />
                                    </svg>
                                    <span>Record Payment</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleOpenPackagePaymentHistory(pkg);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                    </svg>
                                    <span>Payment History</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleOpenEditPackage(pkg);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                    </svg>
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleDeletePackageClick(pkg);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                    </svg>
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: STUDENT FEES TAB                                             */}
      {/* =================================================================== */}
      {activeTab === "student_fees" && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            {/* Top row: Search, Session, Term, Class, Admission Level */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search student or ID..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Session Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session:</label>
                <select
                  value={studentFeeSessionFilter}
                  onChange={(e) => handleStudentFeeSessionChange(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="ALL">All Sessions</option>
                  {availableStructureSessions.map((session) => (
                    <option key={session} value={session}>
                      {session}
                    </option>
                  ))}
                </select>
              </div>

              {/* Term Filter (Cascading) */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Term:</label>
                <select
                  value={studentFeeTermFilter}
                  onChange={(e) => handleStudentFeeTermChange(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="ALL">All Terms</option>
                  {availableStudentFeeTerms.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Filter Dropdown (FIX-008) */}
              <select
                value={classFilter}
                onChange={(e) => handleClassFilterChange(e.target.value)}
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
                onChange={(e) => handleAdmissionLevelFilterChange(e.target.value)}
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

            {/* Bottom row: Date-Paid Range Filters, Status Pills, and Reset Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Paid Range */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Paid Date:</span>
                  <input
                    type="date"
                    value={paidFromFilter}
                    onChange={(e) => handlePaidFromChange(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    title="Paid From Date"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={paidToFilter}
                    onChange={(e) => handlePaidToChange(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    title="Paid To Date"
                  />
                </div>

                {/* Status Filter Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {["ALL", "PENDING", "PAID", "OVERDUE", "PARTIAL", "WAIVED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusFilterChange(st)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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

              {/* Reset Filters */}
              {hasActiveStudentFeeFilters && (
                <button
                  type="button"
                  onClick={handleResetStudentFeeFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer ml-auto"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  <span>Reset Filters</span>
                </button>
              )}
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
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {hasActiveStudentFeeFilters ? "No student fees match the selected filters" : "No student fees found"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {hasActiveStudentFeeFilters
                    ? "Try adjusting or clearing your filters to see more results."
                    : "Try adjusting your search filter or assign fee structures to students."}
                </p>
                {hasActiveStudentFeeFilters && (
                  <button
                    type="button"
                    onClick={handleResetStudentFeeFilters}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span>Reset Filters</span>
                  </button>
                )}
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
                            <div>{fee.feeStructure.name}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {fee.feeStructure.academicYear} {fee.feeStructure.term ? `(${fee.feeStructure.term})` : ""}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-extrabold text-slate-900 font-mono">
                            {formatAmount(fee.amountDue)}
                          </td>
                          <td className="px-6 py-4 font-extrabold text-emerald-700 font-mono">
                            <div>{formatAmount(fee.amountPaid)}</div>
                            {fee.payments && fee.payments.length > 0 && (
                              <div className="text-[11px] font-sans font-medium text-slate-500 mt-0.5 whitespace-nowrap">
                                Last paid: {new Date(fee.payments[0].paidAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {renderStatusBadge(fee.status)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                            {new Date(fee.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Case A: Unpaid or Partially Paid Fees (PENDING, PARTIAL, OVERDUE) */}
                              {!isFullyPaid && (
                                <>
                                  <button
                                    type="button"
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
                                    className="inline-flex items-center justify-center gap-1.5 w-[130px] h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                                  >
                                    Record Payment
                                  </button>

                                  <div className="relative inline-block text-left" data-row-menu="true">
                                    <button
                                      type="button"
                                      aria-label="More actions"
                                      aria-expanded={openMenuId === `fee-${fee.id}`}
                                      onClick={() => setOpenMenuId(openMenuId === `fee-${fee.id}` ? null : `fee-${fee.id}`)}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="5" r="1.75" />
                                        <circle cx="12" cy="12" r="1.75" />
                                        <circle cx="12" cy="19" r="1.75" />
                                      </svg>
                                    </button>

                                    {openMenuId === `fee-${fee.id}` && (
                                      <div className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-white border border-slate-200/90 shadow-lg py-1 z-40 animate-in fade-in zoom-in-95 duration-100">
                                        {Number(fee.amountPaid) > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenMenuId(null);
                                              handleOpenViewReceipts(fee);
                                            }}
                                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
                                          >
                                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                            </svg>
                                            <span>Receipts</span>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenMenuId(null);
                                            handleOpenChangeStatus(fee);
                                          }}
                                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                          </svg>
                                          <span>Change Status</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Case B: Fully Paid or Waived Fees (PAID, WAIVED) */}
                              {isFullyPaid && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenViewReceipts(fee)}
                                    className="inline-flex items-center justify-center gap-1.5 w-[130px] h-8 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-700 font-semibold text-xs transition-colors cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                    <span>Receipts</span>
                                  </button>

                                  <div className="relative inline-block text-left" data-row-menu="true">
                                    <button
                                      type="button"
                                      aria-label="More actions"
                                      aria-expanded={openMenuId === `fee-${fee.id}`}
                                      onClick={() => setOpenMenuId(openMenuId === `fee-${fee.id}` ? null : `fee-${fee.id}`)}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="5" r="1.75" />
                                        <circle cx="12" cy="12" r="1.75" />
                                        <circle cx="12" cy="19" r="1.75" />
                                      </svg>
                                    </button>

                                    {openMenuId === `fee-${fee.id}` && (
                                      <div className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-white border border-slate-200/90 shadow-lg py-1 z-40 animate-in fade-in zoom-in-95 duration-100">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenMenuId(null);
                                            handleOpenChangeStatus(fee);
                                          }}
                                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                          </svg>
                                          <span>Change Status</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
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
                    <option value="FEEDING">FEEDING</option>
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
                    <option value="FEEDING">FEEDING</option>
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
                onClick={() => {
                  setAssigningStructure(null);
                  setAssignModalError("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAssignFeeSubmit} className="p-6 space-y-5">
              {/* Modal Error Alert Banner */}
              {assignModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-medium animate-in fade-in duration-150">
                  <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span className="flex-1">{assignModalError}</span>
                </div>
              )}

              {/* Option Selector Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Assignment Target
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignMode("single");
                      setAssignModalError("");
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      assignMode === "single" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    Single Student
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignMode("class");
                      setAssignModalError("");
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      assignMode === "class" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    Entire Class
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignMode("admissionLevel");
                      setAssignModalError("");
                    }}
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
                    onChange={(e) => {
                      setSelectedStudentId(e.target.value);
                      setAssignModalError("");
                    }}
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
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setAssignModalError("");
                    }}
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
                    onChange={(e) => {
                      setSelectedAdmissionLevel(e.target.value);
                      setAssignModalError("");
                    }}
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
                  onClick={() => {
                    setAssigningStructure(null);
                    setAssignModalError("");
                  }}
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
              {viewingReceiptsFee.status === "WAIVED" ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">Waived</span>
                    <span className="text-sm font-extrabold text-amber-800 font-mono">
                      {formatNaira(
                        Math.max(
                          0,
                          parseFloat(String(viewingReceiptsFee.amountDue)) - parseFloat(String(viewingReceiptsFee.amountPaid))
                        )
                      )}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Balance</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">
                      {formatNaira(0)}
                    </span>
                  </div>
                </div>
              ) : (
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
              )}

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

      {/* =================================================================== */}
      {/* MODAL 5: MULTI-ASSIGN FEES MODAL                                    */}
      {/* =================================================================== */}
      {isMultiAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Assign Selected Fee Structures</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign {selectedStructureIds.length} fee structures at once to a student, class, or admission level.
                </p>
              </div>
              <button
                onClick={() => setIsMultiAssignOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleMultiAssignSubmit} className="p-6 space-y-4">
              {/* Selected Structures Summary Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Selected Structures ({selectedStructures.length})</span>
                  <span className="text-blue-700 font-mono font-extrabold text-sm">{formatNaira(selectedTotalAmount)}</span>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs text-slate-600">
                  {selectedStructures.map((s) => (
                    <div key={s.id} className="py-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">{s.name}</span>
                        <span className="text-[10px] text-slate-400">({s.academicYear})</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-700">{formatNaira(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assignment Target Mode */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Assign To *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMultiAssignMode("single")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      multiAssignMode === "single"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Single Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiAssignMode("class")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      multiAssignMode === "class"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Entire Class
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiAssignMode("admissionLevel")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      multiAssignMode === "admissionLevel"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Admission Level
                  </button>
                </div>
              </div>

              {/* Dynamic Target Selection */}
              {multiAssignMode === "single" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Student *
                  </label>
                  <select
                    required
                    value={multiAssignStudentId}
                    onChange={(e) => setMultiAssignStudentId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.firstName} {st.lastName} ({st.studentId}) {st.admissionLevel ? `• ${st.admissionLevel}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {multiAssignMode === "class" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Class *
                  </label>
                  <select
                    required
                    value={multiAssignClassId}
                    onChange={(e) => setMultiAssignClassId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.academicYear})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {multiAssignMode === "admissionLevel" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Admission Level *
                  </label>
                  <select
                    required
                    value={multiAssignAdmissionLevel}
                    onChange={(e) => setMultiAssignAdmissionLevel(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Choose Level --</option>
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
                  onClick={() => setIsMultiAssignOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMultiAssign}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingMultiAssign && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Assign Selected Fees</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 6: CREATE FEE PACKAGE MODAL                                   */}
      {/* =================================================================== */}
      {isCreatePackageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Create Fee Package</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bundle multiple fee structures into a reusable single-click package.
                </p>
              </div>
              <button
                onClick={() => setIsCreatePackageOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreatePackageSubmit} className="p-6 space-y-4">
              {/* Package Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full Term Package 2025/2026"
                  value={createPackageForm.name}
                  onChange={(e) => setCreatePackageForm({ ...createPackageForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Includes Tuition, Transport, and Feeding fees"
                  value={createPackageForm.description}
                  onChange={(e) => setCreatePackageForm({ ...createPackageForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
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
                    value={createPackageForm.academicYear}
                    onChange={(e) => setCreatePackageForm({ ...createPackageForm, academicYear: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Term (Optional)
                  </label>
                  <select
                    value={createPackageForm.term}
                    onChange={(e) => setCreatePackageForm({ ...createPackageForm, term: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">All Terms / Unspecified</option>
                    <option value="First Term">First Term</option>
                    <option value="Second Term">Second Term</option>
                    <option value="Third Term">Third Term</option>
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
              </div>

              {/* Fee Structures Selection Checklist */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Fee Structures to Bundle *
                  </label>
                  <span className="text-xs font-mono font-bold text-blue-700">
                    Total: {formatNaira(
                      allStructuresForFilters
                        .filter((s) => createPackageForm.feeStructureIds.includes(s.id))
                        .reduce((sum, s) => sum + (typeof s.amount === "number" ? s.amount : parseFloat(s.amount as string) || 0), 0)
                    )}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto p-2 divide-y divide-slate-100 bg-slate-50/50">
                  {allStructuresForFilters.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No fee structures available. Create structures first.
                    </div>
                  ) : (
                    allStructuresForFilters
                      .filter(
                        (s) =>
                          s.academicYear === createPackageForm.academicYear &&
                          (!createPackageForm.term || !s.term || s.term === createPackageForm.term)
                      )
                      .map((st) => {
                        const checked = createPackageForm.feeStructureIds.includes(st.id);
                        return (
                          <label
                            key={st.id}
                            className="py-2 px-2 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-100/70 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setCreatePackageForm((prev) => ({
                                    ...prev,
                                    feeStructureIds: checked
                                      ? prev.feeStructureIds.filter((id) => id !== st.id)
                                      : [...prev.feeStructureIds, st.id],
                                  }));
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                              />
                              <div>
                                <span className="font-semibold text-slate-900">{st.name}</span>
                                <span className="text-[10px] text-slate-400 ml-1.5">({st.type})</span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-slate-800">{formatNaira(st.amount)}</span>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatePackageOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreatePackage}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingCreatePackage && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Create Package</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 7: EDIT FEE PACKAGE MODAL                                     */}
      {/* =================================================================== */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Edit Fee Package</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update package name, session, term, or bundled fee structures.
                </p>
              </div>
              <button
                onClick={() => setEditingPackage(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditPackageSubmit} className="p-6 space-y-4">
              {/* Package Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  value={editPackageForm.name}
                  onChange={(e) => setEditPackageForm({ ...editPackageForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={editPackageForm.description}
                  onChange={(e) => setEditPackageForm({ ...editPackageForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
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
                    value={editPackageForm.academicYear}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, academicYear: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Term (Optional)
                  </label>
                  <select
                    value={editPackageForm.term}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, term: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">All Terms / Unspecified</option>
                    <option value="First Term">First Term</option>
                    <option value="Second Term">Second Term</option>
                    <option value="Third Term">Third Term</option>
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
              </div>

              {/* Fee Structures Selection Checklist */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Bundled Fee Structures *
                  </label>
                  <span className="text-xs font-mono font-bold text-blue-700">
                    Total: {formatNaira(
                      allStructuresForFilters
                        .filter((s) => editPackageForm.feeStructureIds.includes(s.id))
                        .reduce((sum, s) => sum + (typeof s.amount === "number" ? s.amount : parseFloat(s.amount as string) || 0), 0)
                    )}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto p-2 divide-y divide-slate-100 bg-slate-50/50">
                  {allStructuresForFilters
                    .filter(
                      (s) =>
                        s.academicYear === editPackageForm.academicYear &&
                        (!editPackageForm.term || !s.term || s.term === editPackageForm.term)
                    )
                    .map((st) => {
                      const checked = editPackageForm.feeStructureIds.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="py-2 px-2 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-100/70 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setEditPackageForm((prev) => ({
                                  ...prev,
                                  feeStructureIds: checked
                                    ? prev.feeStructureIds.filter((id) => id !== st.id)
                                    : [...prev.feeStructureIds, st.id],
                                }));
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <div>
                              <span className="font-semibold text-slate-900">{st.name}</span>
                              <span className="text-[10px] text-slate-400 ml-1.5">({st.type})</span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-slate-800">{formatNaira(st.amount)}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPackage(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEditPackage}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingEditPackage && (
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
      {/* MODAL 8: DELETE FEE PACKAGE CONFIRMATION                            */}
      {/* =================================================================== */}
      {deletingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Delete Fee Package</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete <span className="font-bold text-slate-800">"{deletingPackage.name}"</span>?
              </p>
              <p className="text-[11px] text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                Note: Deleting this package removes the bundle definition only. Underlying fee structures and student fee records already generated will remain completely intact.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingPackage(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePackageConfirm}
                disabled={submittingDeletePackage}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {submittingDeletePackage && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Delete Package</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 9: ASSIGN FEE PACKAGE MODAL                                   */}
      {/* =================================================================== */}
      {assigningPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Assign Fee Package</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign all bundled fee structures in <span className="font-bold text-slate-800">"{assigningPackage.name}"</span>.
                </p>
              </div>
              <button
                onClick={() => setAssigningPackage(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAssignPackageSubmit} className="p-6 space-y-4">
              {/* Package Summary Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Bundled Fees ({assigningPackage.items.length})</span>
                  <span className="text-blue-700 font-mono font-extrabold text-sm">{formatNaira(assigningPackage.totalAmount)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {assigningPackage.items.map((it) => (
                    <span
                      key={it.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-2xs"
                    >
                      <span>{it.feeStructure?.name || "Fee"}</span>
                      {it.feeStructure?.amount && (
                        <span className="font-mono text-blue-600 font-bold">₦{formatAmount(it.feeStructure.amount)}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* Assignment Target Mode */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Assign To *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignPackageMode("single")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      assignPackageMode === "single"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Single Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignPackageMode("class")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      assignPackageMode === "class"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Entire Class
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignPackageMode("admissionLevel")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      assignPackageMode === "admissionLevel"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Admission Level
                  </button>
                </div>
              </div>

              {/* Dynamic Target Selection */}
              {assignPackageMode === "single" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Student *
                  </label>
                  <select
                    required
                    value={assignPackageStudentId}
                    onChange={(e) => setAssignPackageStudentId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.firstName} {st.lastName} ({st.studentId}) {st.admissionLevel ? `• ${st.admissionLevel}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {assignPackageMode === "class" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Class *
                  </label>
                  <select
                    required
                    value={assignPackageClassId}
                    onChange={(e) => setAssignPackageClassId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.academicYear})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {assignPackageMode === "admissionLevel" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Select Admission Level *
                  </label>
                  <select
                    required
                    value={assignPackageAdmissionLevel}
                    onChange={(e) => setAssignPackageAdmissionLevel(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Choose Level --</option>
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
                  onClick={() => setAssigningPackage(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssignPackage}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingAssignPackage && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Assign Package</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 10: RECORD PACKAGE PAYMENT MODAL                              */}
      {/* =================================================================== */}
      {payingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Record Package Payment</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Package: <span className="font-bold text-slate-800">"{payingPackage.name}"</span> ({payingPackage.academicYear} {payingPackage.term ? "• " + payingPackage.term : ""})
                </p>
              </div>
              <button
                onClick={() => setPayingPackage(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePackagePaymentSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Modal Inline Error */}
              {packagePaymentModalError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2">
                  <span>{packagePaymentModalError}</span>
                  <button type="button" onClick={() => setPackagePaymentModalError("")} className="text-rose-600 font-bold text-xs hover:underline">
                    Dismiss
                  </button>
                </div>
              )}

              {/* Student Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Select Student *
                </label>
                <select
                  required
                  value={payPackageStudentId}
                  onChange={(e) => handlePackageStudentSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="">-- Choose Student Assigned to this Package --</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName} {st.lastName} ({st.studentId}) {st.admissionLevel ? "• " + st.admissionLevel : ""}
                    </option>
                  ))}
                </select>
              </div>

              {loadingPackageBalances && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <span className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p>Loading student package balances...</p>
                </div>
              )}

              {packageBalanceData && (
                <div className="space-y-4">
                  {/* Balance Summary Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Due</span>
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        ₦{formatAmount(packageBalanceData.totalDue)}
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Paid</span>
                      <span className="text-sm font-extrabold text-emerald-700 font-mono">
                        ₦{formatAmount(packageBalanceData.totalPaid)}
                      </span>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-blue-700 block">Total Remaining</span>
                      <span className="text-sm font-extrabold text-blue-700 font-mono">
                        ₦{formatAmount(packageBalanceData.totalRemaining)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                          Payment Amount (₦) *
                        </label>
                        {parseFloat(packageBalanceData.totalRemaining) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPackagePaymentAmount(packageBalanceData.totalRemaining);
                              const fullAlloc: Record<string, string> = {};
                              for (const comp of packageBalanceData.components) {
                                if (comp.feeId && parseFloat(comp.remainingBalance) > 0) {
                                  fullAlloc[comp.feeId] = comp.remainingBalance;
                                }
                              }
                              setCustomAllocations(fullAlloc);
                            }}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                          >
                            Pay Full Balance (₦{formatAmount(packageBalanceData.totalRemaining)})
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={packagePaymentAmount}
                        onChange={(e) => setPackagePaymentAmount(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Payment Method *
                      </label>
                      <select
                        value={packagePaymentMethod}
                        onChange={(e) => setPackagePaymentMethod(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                      >
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="card">Debit / Credit Card</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Reference / Teller # (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. TRF-928471"
                        value={packagePaymentReference}
                        onChange={(e) => setPackagePaymentReference(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Payment Note (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Paid by parent at admin desk"
                        value={packagePaymentNote}
                        onChange={(e) => setPackagePaymentNote(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* Component Allocation Breakdown */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Component Allocation
                      </label>
                      {parseFloat(packagePaymentAmount || "0") === parseFloat(packageBalanceData.totalRemaining) ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          ✓ Full Settlement: all active components will be settled automatically
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono font-semibold text-slate-600">
                          Allocated: ₦{formatAmount(
                            Object.values(customAllocations).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
                          )} / Total: ₦{formatAmount(packagePaymentAmount || 0)}
                        </span>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {packageBalanceData.components.map((comp) => {
                        const remNum = parseFloat(comp.remainingBalance);
                        const isSettled = remNum <= 0;

                        return (
                          <div key={comp.feeStructureId} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 text-xs">{comp.name}</span>
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">({comp.type})</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                Due: ₦{formatAmount(comp.amountDue)} • Paid: ₦{formatAmount(comp.amountPaid)} • Remaining: <span className="font-bold text-slate-700">₦{formatAmount(comp.remainingBalance)}</span>
                              </div>
                            </div>

                            <div className="w-36 text-right">
                              {isSettled ? (
                                <span className="text-[11px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-md">
                                  {comp.status === "WAIVED" ? "Waived" : "Settled (₦0)"}
                                </span>
                              ) : parseFloat(packagePaymentAmount || "0") === parseFloat(packageBalanceData.totalRemaining) ? (
                                <span className="text-xs font-mono font-bold text-emerald-700">
                                  +₦{formatAmount(comp.remainingBalance)}
                                </span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-slate-500 font-mono">₦</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={remNum}
                                    value={customAllocations[comp.feeId || ""] || ""}
                                    onChange={(e) => {
                                      if (!comp.feeId) return;
                                      const val = e.target.value;
                                      setCustomAllocations({
                                        ...customAllocations,
                                        [comp.feeId]: val,
                                      });
                                    }}
                                    placeholder="0.00"
                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-right"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingPackage(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPackagePayment || !payPackageStudentId || !packageBalanceData || loadingPackageBalances}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingPackagePayment && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Record Package Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 11: PACKAGE PAYMENT HISTORY MODAL                             */}
      {/* =================================================================== */}
      {historyPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Package Payment History</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Package: <span className="font-bold text-slate-800">"{historyPackage.name}"</span> ({historyPackage.academicYear} {historyPackage.term ? "• " + historyPackage.term : ""})
                </p>
              </div>
              <button
                onClick={() => setHistoryPackage(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {packageHistoryError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2">
                  <span>{packageHistoryError}</span>
                  <button type="button" onClick={() => setPackageHistoryError("")} className="text-rose-600 font-bold text-xs hover:underline">
                    Dismiss
                  </button>
                </div>
              )}

              {loadingPackageHistory ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <span className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p>Loading package payment history...</p>
                </div>
              ) : packageHistoryPayments.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">No package payments recorded yet</p>
                  <p className="text-xs text-slate-500 mt-1">Payments recorded for this package will appear here with downloadable receipts.</p>
                </div>
              ) : (
                <div className="border border-slate-200/90 rounded-2xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Receipt #</th>
                        <th className="px-4 py-3">Amount (₦)</th>
                        <th className="px-4 py-3">Method / Ref</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {packageHistoryPayments.map((pmt) => (
                        <tr key={pmt.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-slate-600 font-medium">
                            {new Date(pmt.createdAt).toLocaleDateString()} {new Date(pmt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            {pmt.student ? (
                              <div>
                                <div className="font-bold text-slate-900">{pmt.student.firstName} {pmt.student.lastName}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{pmt.student.studentId}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-700">
                            {pmt.receiptNumber}
                          </td>
                          <td className="px-4 py-3 font-extrabold text-slate-900 font-mono">
                            ₦{formatAmount(pmt.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="capitalize font-semibold text-slate-700">{pmt.method.replace('_', ' ')}</span>
                            {pmt.reference && (
                              <div className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">Ref: {pmt.reference}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDownloadPackageReceipt(pmt.id, pmt.receiptNumber)}
                              disabled={downloadingPackagePaymentId === pmt.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                            >
                              {downloadingPackagePaymentId === pmt.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                              )}
                              <span>Download Receipt (PDF)</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryPackage(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
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
