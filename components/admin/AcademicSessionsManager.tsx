"use client";

import { useEffect, useState } from "react";

interface Term {
  id: string;
  sessionId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent: boolean;
  createdAt: string;
}

interface AcademicSession {
  id: string;
  schoolId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent: boolean;
  createdAt: string;
  terms: Term[];
  _count?: {
    enrollments?: number;
    feeStructures?: number;
    budgets?: number;
    feePackages?: number;
  };
}

export default function AcademicSessionsManager() {
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Session Modal State
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [sessionStartDate, setSessionStartDate] = useState("");
  const [sessionEndDate, setSessionEndDate] = useState("");
  const [sessionIsCurrent, setSessionIsCurrent] = useState(false);

  // Term Modal State
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState<string>("");
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [termName, setTermName] = useState("");
  const [termStartDate, setTermStartDate] = useState("");
  const [termEndDate, setTermEndDate] = useState("");

  async function fetchSessions() {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch("/api/academic-sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load academic sessions");
      }

      const data = await res.json();
      setSessions(data.data || []);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading academic sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSessions();
  }, []);

  function openCreateSessionModal() {
    setEditingSession(null);
    setSessionName("");
    setSessionStartDate("");
    setSessionEndDate("");
    setSessionIsCurrent(false);
    setSessionModalOpen(true);
  }

  function openEditSessionModal(sess: AcademicSession) {
    setEditingSession(sess);
    setSessionName(sess.name);
    setSessionStartDate(sess.startDate ? sess.startDate.slice(0, 10) : "");
    setSessionEndDate(sess.endDate ? sess.endDate.slice(0, 10) : "");
    setSessionIsCurrent(sess.isCurrent);
    setSessionModalOpen(true);
  }

  function openCreateTermModal(sessionId: string) {
    setTargetSessionId(sessionId);
    setEditingTerm(null);
    setTermName("");
    setTermStartDate("");
    setTermEndDate("");
    setTermModalOpen(true);
  }

  function openEditTermModal(sessionId: string, term: Term) {
    setTargetSessionId(sessionId);
    setEditingTerm(term);
    setTermName(term.name);
    setTermStartDate(term.startDate ? term.startDate.slice(0, 10) : "");
    setTermEndDate(term.endDate ? term.endDate.slice(0, 10) : "");
    setTermModalOpen(true);
  }

  async function handleSaveSession(e: React.FormEvent) {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload: any = {
        name: sessionName.trim(),
        startDate: sessionStartDate ? new Date(sessionStartDate).toISOString() : null,
        endDate: sessionEndDate ? new Date(sessionEndDate).toISOString() : null,
      };

      if (!editingSession) {
        payload.isCurrent = sessionIsCurrent;
      }

      const url = editingSession
        ? `/api/academic-sessions/${editingSession.id}`
        : "/api/academic-sessions";
      const method = editingSession ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save academic session");
      }

      setSuccess(
        editingSession
          ? `Academic session '${payload.name}' updated successfully.`
          : `Academic session '${payload.name}' created with default standard terms.`
      );
      setSessionModalOpen(false);
      await fetchSessions();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleActivateSession(sess: AcademicSession) {
    if (sess.isCurrent) return;
    if (
      !confirm(
        `Are you sure you want to activate '${sess.name}'? This will make it the active session for the school and automatically activate its First Term.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/academic-sessions/${sess.id}/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to activate session");
      }

      setSuccess(`Academic session '${sess.name}' is now current and its First Term is active.`);
      await fetchSessions();
    } catch (err: any) {
      setError(err.message || "Failed to activate session");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteSession(sess: AcademicSession) {
    if (
      !confirm(
        `Are you sure you want to delete session '${sess.name}'? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/academic-sessions/${sess.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete session");
      }

      setSuccess(`Academic session '${sess.name}' deleted successfully.`);
      await fetchSessions();
    } catch (err: any) {
      setError(err.message || "Failed to delete session");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveTerm(e: React.FormEvent) {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const payload: any = {
        name: termName.trim(),
        startDate: termStartDate ? new Date(termStartDate).toISOString() : null,
        endDate: termEndDate ? new Date(termEndDate).toISOString() : null,
      };

      const url = editingTerm
        ? `/api/academic-sessions/${targetSessionId}/terms/${editingTerm.id}`
        : `/api/academic-sessions/${targetSessionId}/terms`;
      const method = editingTerm ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save term");
      }

      setSuccess(
        editingTerm
          ? `Term '${payload.name}' updated successfully.`
          : `Term '${payload.name}' added successfully.`
      );
      setTermModalOpen(false);
      await fetchSessions();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleActivateTerm(sess: AcademicSession, term: Term) {
    if (term.isCurrent) return;
    if (!sess.isCurrent) {
      setError(
        `Cannot activate '${term.name}': parent session '${sess.name}' is not current. Please activate session '${sess.name}' first.`
      );
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/academic-sessions/${sess.id}/terms/${term.id}/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to activate term");
      }

      setSuccess(`Term '${term.name}' is now active under session '${sess.name}'.`);
      await fetchSessions();
    } catch (err: any) {
      setError(err.message || "Failed to activate term");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteTerm(sess: AcademicSession, term: Term) {
    if (
      !confirm(
        `Are you sure you want to delete term '${term.name}' from session '${sess.name}'?`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("edupulse_token");
      if (!token) return;

      const res = await fetch(`/api/academic-sessions/${sess.id}/terms/${term.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete term");
      }

      setSuccess(`Term '${term.name}' deleted successfully.`);
      await fetchSessions();
    } catch (err: any) {
      setError(err.message || "Failed to delete term");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between gap-3 shadow-xs">
          <span>{success}</span>
          <button
            onClick={() => setSuccess("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between gap-3 shadow-xs">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-rose-700 hover:text-rose-900 font-bold text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header and Add Session button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Academic Sessions & Terms</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure school sessions, activate current terms, and manage academic calendar periods.
          </p>
        </div>
        <button
          onClick={openCreateSessionModal}
          disabled={actionLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>New Academic Session</span>
        </button>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
          <p className="text-sm font-semibold text-slate-800">No academic sessions found</p>
          <p className="text-xs text-slate-500 mt-1">
            Create your first academic session (e.g. 2025/2026) to begin.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className={`p-6 bg-white rounded-2xl border transition-all ${
                sess.isCurrent
                  ? "border-blue-500 shadow-sm ring-1 ring-blue-500/20"
                  : "border-slate-200/80 shadow-xs hover:border-slate-300"
              }`}
            >
              {/* Session Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">
                    {sess.name}
                  </span>
                  {sess.isCurrent ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      Active Session
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      Inactive
                    </span>
                  )}

                  {sess.startDate && sess.endDate && (
                    <span className="text-xs text-slate-500 font-medium">
                      ({new Date(sess.startDate).toLocaleDateString()} –{" "}
                      {new Date(sess.endDate).toLocaleDateString()})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!sess.isCurrent && (
                    <button
                      onClick={() => handleActivateSession(sess)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-colors cursor-pointer"
                    >
                      Set as Active Session
                    </button>
                  )}

                  <button
                    onClick={() => openEditSessionModal(sess)}
                    disabled={actionLoading}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Edit Session"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDeleteSession(sess)}
                    disabled={actionLoading}
                    className="p-2 rounded-lg text-rose-500 hover:text-rose-800 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Session"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Terms Grid */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Academic Terms ({sess.terms?.length || 0})
                  </span>
                  <button
                    onClick={() => openCreateTermModal(sess.id)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Add Term</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {sess.terms?.map((term) => (
                    <div
                      key={term.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
                        term.isCurrent
                          ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">{term.name}</span>
                        {term.isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Active Term
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">Inactive</span>
                        )}
                      </div>

                      {term.startDate && term.endDate && (
                        <p className="text-[11px] text-slate-500">
                          {new Date(term.startDate).toLocaleDateString()} –{" "}
                          {new Date(term.endDate).toLocaleDateString()}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 mt-1">
                        {!term.isCurrent ? (
                          <button
                            onClick={() => handleActivateTerm(sess, term)}
                            disabled={actionLoading || !sess.isCurrent}
                            title={!sess.isCurrent ? "Parent session must be active first" : ""}
                            className={`text-xs font-bold cursor-pointer ${
                              sess.isCurrent
                                ? "text-emerald-700 hover:text-emerald-900"
                                : "text-slate-400 cursor-not-allowed opacity-60"
                            }`}
                          >
                            Activate Term
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-800">Current</span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditTermModal(sess.id, term)}
                            disabled={actionLoading}
                            className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                            title="Edit Term"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTerm(sess, term)}
                            disabled={actionLoading}
                            className="p-1 text-rose-500 hover:text-rose-800 rounded cursor-pointer"
                            title="Delete Term"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session Modal */}
      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingSession ? "Edit Academic Session" : "New Academic Session"}
            </h3>

            <form onSubmit={handleSaveSession} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Session Name (e.g. 2026/2027)
                </label>
                <input
                  type="text"
                  required
                  placeholder="2026/2027"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={sessionStartDate}
                    onChange={(e) => setSessionStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={sessionEndDate}
                    onChange={(e) => setSessionEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                  />
                </div>
              </div>

              {!editingSession && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={sessionIsCurrent}
                    onChange={(e) => setSessionIsCurrent(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    Set as Active Academic Session immediately
                  </span>
                </label>
              )}

              <p className="text-[11px] text-slate-400">
                {!editingSession &&
                  "Three standard terms (First Term, Second Term, Third Term) will be auto-generated under this session."}
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Saving..." : "Save Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Term Modal */}
      {termModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingTerm ? "Edit Term" : "Add Term"}
            </h3>

            <form onSubmit={handleSaveTerm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Term Name (e.g. First Term, Summer Term)
                </label>
                <input
                  type="text"
                  required
                  placeholder="First Term"
                  value={termName}
                  onChange={(e) => setTermName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={termStartDate}
                    onChange={(e) => setTermStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={termEndDate}
                    onChange={(e) => setTermEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTermModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Saving..." : "Save Term"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
