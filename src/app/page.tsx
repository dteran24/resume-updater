"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ResumeEditor } from "@/components/ResumeEditor";
import { EMPTY_RESUME_DATA, type ResumeData } from "@/types/resume";

export default function BaseResumePage() {
  const [data, setData] = useState<ResumeData>(structuredClone(EMPTY_RESUME_DATA));
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [rawPaste, setRawPaste] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadBaseResume = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/base-resume");
      if (!res.ok) throw new Error("Failed to load base resume");
      const json = await res.json();
      setData(json.data);
      setUpdatedAt(json.updatedAt);
      setDirty(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseResume();
  }, [loadBaseResume]);

  async function handleSave() {
    setSaving(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const res = await fetch("/api/base-resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setData(json.data);
      setUpdatedAt(json.updatedAt);
      setDirty(false);
      setStatusMessage("Base resume saved.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImporting(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      let res: Response;
      if (importMode === "file") {
        if (!selectedFile) {
          throw new Error("Please choose a PDF, DOCX, TXT, or MD file.");
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        res = await fetch("/api/base-resume/import", {
          method: "POST",
          body: formData,
        });
      } else {
        if (!rawPaste.trim()) {
          throw new Error("Please paste your resume text.");
        }
        res = await fetch("/api/base-resume/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText: rawPaste }),
        });
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setData(json.data);
      setUpdatedAt(json.updatedAt);
      setDirty(false);
      setSelectedFile(null);
      setRawPaste("");
      setStatusMessage("Resume parsed with AI and saved to your Base Resume.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Base Resume
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Upload or paste your existing resume once to seed your structured career foundation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Base Resume
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Import Card */}
      <form
        onSubmit={handleImport}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Import & Parse with Gemini AI
            </h2>
          </div>

          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setImportMode("file")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                importMode === "file"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload PDF / DOCX
            </button>
            <button
              type="button"
              onClick={() => setImportMode("paste")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                importMode === "paste"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Paste Text
            </button>
          </div>
        </div>

        {importMode === "file" ? (
          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-50 px-6 py-6 cursor-pointer transition-colors">
            <Upload className="w-6 h-6 text-slate-400 mb-2" />
            <span className="text-sm font-medium text-slate-700">
              {selectedFile
                ? selectedFile.name
                : "Click to select a .pdf, .docx, .txt, or .md resume"}
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Text is extracted locally and structured via Gemini
            </span>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <textarea
            rows={7}
            value={rawPaste}
            onChange={(e) => setRawPaste(e.target.value)}
            placeholder="Paste your entire current resume text here..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}

        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500">
            {updatedAt
              ? `Last saved: ${new Date(updatedAt).toLocaleString()}`
              : "No base resume saved yet."}
          </span>
          <button
            type="submit"
            disabled={importing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Parsing Resume...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Parse & Populate Editor
              </>
            )}
          </button>
        </div>
      </form>

      {/* Structured Editor */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Loading base resume...
        </div>
      ) : (
        <ResumeEditor
          value={data}
          onChange={(next) => {
            setData(next);
            setDirty(true);
          }}
        />
      )}
    </div>
  );
}
