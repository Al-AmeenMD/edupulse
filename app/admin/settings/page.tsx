"use client";

import { useEffect, useState } from "react";

interface SchoolSettings {
  id: string;
  name: string;
  studentIdTemplate: string;
  studentIdPrefix: string;
  _count?: {
    students: number;
  };
}

export default function AdminSettingsPage() {
  const [schoolName, setSchoolName] = useState("");
  const [prefix, setPrefix] = useState("STU");
  const [template, setTemplate] = useState("{PREFIX}/{YEAR}/{SEQ:3}");
  const [studentCount, setStudentCount] = useState(0);

  const [debouncedPrefix, setDebouncedPrefix] = useState("STU");
  const [debouncedTemplate, setDebouncedTemplate] = useState("{PREFIX}/{YEAR}/{SEQ:3}");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch current settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        setError("");
        const token = localStorage.getItem("edupulse_token");
        if (!token) return;

        const res = await fetch("/api/schools/my-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error("Failed to load school settings");
        }

        const data = await res.json();
        const school: SchoolSettings = data.data;

        setSchoolName(school.name || "");
        setPrefix(school.studentIdPrefix || "STU");
        setTemplate(school.studentIdTemplate || "{PREFIX}/{YEAR}/{SEQ:3}");
        setStudentCount(school._count?.students || 0);

        setDebouncedPrefix(school.studentIdPrefix || "STU");
        setDebouncedTemplate(school.studentIdTemplate || "{PREFIX}/{YEAR}/{SEQ:3}");
      } catch (err: any) {
        setError(err.message || "An error occurred while loading settings");
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  // Debounce preview inputs (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPrefix(prefix);
      setDebouncedTemplate(template);
    }, 300);

    return () => clearTimeout(handler);
  }, [prefix, template]);

  // Compute live preview string
  function computeLivePreview(currentPrefix: string, currentTemplate: string) {
    const p = currentPrefix || "STU";
    const t = currentTemplate || "{PREFIX}/{YEAR}/{SEQ:3}";
    const currentYear = new Date().getFullYear().toString();

    return t
      .replace("{PREFIX}", p)
      .replace("{YEAR}", currentYear)
      .replace("{LEVEL}", "Primary")
      .replace(/\{SEQ:(\d+)\}/, (_, digits) =>
        "1".padStart(parseInt(digits, 10), "0")
      );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const token = localStorage.getItem("edupulse_token");
      if (!token) throw new Error("Authentication token not found");

      const upperPrefix = prefix.trim().toUpperCase();
      const trimmedTemplate = template.trim();

      if (!upperPrefix) {
        throw new Error("Student ID prefix is required");
      }

      if (upperPrefix.length > 10) {
        throw new Error("Student ID prefix must not exceed 10 characters");
      }

      if (!trimmedTemplate) {
        throw new Error("Student ID template is required");
      }

      if (!/\{SEQ:\d+\}/.test(trimmedTemplate)) {
        throw new Error("Template must contain a sequence token (e.g. {SEQ:3})");
      }

      const res = await fetch("/api/schools/my-settings", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentIdPrefix: upperPrefix,
          studentIdTemplate: trimmedTemplate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setPrefix(data.data.studentIdPrefix);
      setTemplate(data.data.studentIdTemplate);
      setSuccess("School Student ID configuration saved successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "An error occurred while saving settings");
      setTimeout(() => setError(""), 4000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
          <div className="h-10 bg-slate-100 animate-pulse rounded-lg"></div>
          <div className="h-10 bg-slate-100 animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  const livePreviewString = computeLivePreview(debouncedPrefix, debouncedTemplate);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          School Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure how student ID numbers are generated for {schoolName || "your school"}.
        </p>
      </div>

      {/* Success Alert */}
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

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-rose-700 hover:text-rose-900 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Existing Students Warning Banner */}
      {studentCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-sm flex items-start gap-3.5 shadow-xs">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-amber-900">Existing Student Records Present ({studentCount})</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Changing the ID template will not affect existing student IDs. New students enrolled in your school will automatically use the new format.
            </p>
          </div>
        </div>
      )}

      {/* Main Settings Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">
            Student ID Template Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Define custom student identification patterns for automated enrollment IDs.
          </p>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Prefix Input */}
          <div className="space-y-1.5 max-w-sm">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Student ID Prefix
            </label>
            <input
              type="text"
              maxLength={10}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="STU"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono tracking-wider"
              required
            />
            <p className="text-[11px] text-slate-400">
              Up to 10 uppercase characters (e.g. STU, ADM).
            </p>
          </div>

          {/* Template Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Student ID Template Format
            </label>
            <input
              type="text"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="{PREFIX}/{YEAR}/{SEQ:3}"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono"
              required
            />
          </div>

          {/* Available Tokens Helper Reference Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Available Format Tokens
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <code className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-bold text-blue-600 shrink-0">
                  {"{PREFIX}"}
                </code>
                <span className="text-slate-600">Your school prefix value above</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-bold text-blue-600 shrink-0">
                  {"{YEAR}"}
                </code>
                <span className="text-slate-600">4-digit enrollment year (e.g. 2026)</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-bold text-blue-600 shrink-0">
                  {"{LEVEL}"}
                </code>
                <span className="text-slate-600">Admission level (e.g. Nursery, Primary)</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-bold text-blue-600 shrink-0">
                  {"{SEQ:3}"}
                </code>
                <span className="text-slate-600">Sequence number padded to 3 digits (e.g. 001). Use {"{SEQ:4}"} for 4 digits.</span>
              </div>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold tracking-wider">
              <span>Next Generated Student ID Preview</span>
              <span className="text-emerald-400 font-mono text-[11px] font-normal">Live Dynamic Preview</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tracking-wider">
              {livePreviewString}
            </div>
            <p className="text-[11px] text-slate-400">
              Sample output calculated dynamically using current year ({new Date().getFullYear()}) and sequence 001.
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save ID Configuration</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
