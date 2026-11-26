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
import { WindowChromeBar } from "@/components/Doodles";
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
      setStatusMessage("Base resume saved locally.");
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
      setStatusMessage("Resume parsed and loaded into your editor below.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E4E4E7] pb-4">
        <div>
          <span className="font-mono-label text-[11px] font-semibold uppercase tracking-wider text-[#0D9488]">
            Step 01 · Foundation
          </span>
          <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight mt-0.5">
            Base Resume
          </h1>
          <p className="text-sm text-[#4B5563] mt-1 max-w-2xl">
            Start with what you already have. Upload a PDF/DOCX or dump raw text — we&apos;ll organize it into clean sections you can keep fresh anytime.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {dirty && (
            <span className="font-mono-label text-xs font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-1 rounded-md">
              unsaved edits
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="ph-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
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
        <div className="flex items-center gap-2 text-sm font-medium text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 text-sm font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Import Card */}
      <form onSubmit={handleImport} className="ph-card overflow-hidden">
        <WindowChromeBar
          filename="resume-importer.sh"
          rightSlot={
            <div className="inline-flex rounded-md bg-white border border-[#D4D4D8] p-0.5">
              <button
                type="button"
                onClick={() => setImportMode("file")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  importMode === "file"
                    ? "bg-[#0D9488] text-white"
                    : "text-[#4B5563] hover:text-[#111827]"
                }`}
              >
                <Upload className="w-3 h-3" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setImportMode("paste")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  importMode === "paste"
                    ? "bg-[#0D9488] text-white"
                    : "text-[#4B5563] hover:text-[#111827]"
                }`}
              >
                <FileText className="w-3 h-3" />
                Paste Text
              </button>
            </div>
          }
        />

        <div className="p-5 space-y-4">
          {importMode === "file" ? (
            <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#D4D4D8] bg-[#FAFAFA] hover:bg-[#F0FDFA]/60 hover:border-[#0D9488] px-6 py-7 cursor-pointer transition-colors">
              <Upload className="w-6 h-6 text-[#0D9488] mb-2" />
              <span className="text-sm font-bold text-[#111827]">
                {selectedFile
                  ? selectedFile.name
                  : "Drop or click to pick a .pdf, .docx, .txt, or .md resume"}
              </span>
              <span className="font-mono-label text-xs text-[#6B7280] mt-1">
                parsed locally · structured with Gemini
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
              className="ph-input px-3.5 py-2.5 text-sm"
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono-label text-xs text-[#6B7280]">
              {updatedAt
                ? `last saved: ${new Date(updatedAt).toLocaleString()}`
                : "no base resume saved yet"}
            </span>
            <button
              type="submit"
              disabled={importing}
              className="ph-btn-dark inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing Resume...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#5EEAD4]" />
                  Parse & Populate Editor
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="ph-card-soft p-10 text-center font-mono-label text-sm text-[#6B7280]">
          loading base resume...
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
