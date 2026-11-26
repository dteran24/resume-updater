"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Target,
  Link as LinkIcon,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ResumeEditor } from "@/components/ResumeEditor";
import { ResumePreview } from "@/components/ResumePreview";
import { EMPTY_RESUME_DATA, type ResumeData, type ResumeVersion } from "@/types/resume";

function StudioWorkspace() {
  const searchParams = useSearchParams();
  const versionIdParam = searchParams.get("versionId");

  const [activeVersion, setActiveVersion] = useState<ResumeVersion | null>(null);
  const [draftData, setDraftData] = useState<ResumeData>(
    structuredClone(EMPTY_RESUME_DATA)
  );
  const [draftTitle, setDraftTitle] = useState("Working Draft");
  const [dirty, setDirty] = useState(false);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);

  const [tailorOpen, setTailorOpen] = useState(true);
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [fetchHint, setFetchHint] = useState("");

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const jdTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const loadInitial = useCallback(async () => {
    setLoadingInitial(true);
    setErrorMessage("");
    try {
      if (versionIdParam) {
        const res = await fetch(`/api/resumes/${versionIdParam}`);
        if (res.ok) {
          const json = await res.json();
          const v = json.version as ResumeVersion;
          setActiveVersion(v);
          setDraftData(v.data);
          setDraftTitle(v.title);
          setJobUrl(v.jobUrl || "");
          setJobDescription(v.jobDescription || "");
          setDirty(false);
          return;
        }
      }

      const [versionsRes, baseRes] = await Promise.all([
        fetch("/api/resumes"),
        fetch("/api/base-resume"),
      ]);

      if (versionsRes.ok) {
        const vJson = await versionsRes.json();
        const latest = (vJson.versions ?? [])[0] as ResumeVersion | undefined;
        if (latest) {
          setActiveVersion(latest);
          setDraftData(latest.data);
          setDraftTitle(latest.title);
          setJobUrl(latest.jobUrl || "");
          setJobDescription(latest.jobDescription || "");
          setDirty(false);
          return;
        }
      }

      if (baseRes.ok) {
        const bJson = await baseRes.json();
        setDraftData(bJson.data ?? structuredClone(EMPTY_RESUME_DATA));
        setDraftTitle("Base Resume Preview");
      }
    } catch {
      setErrorMessage("Failed to load workspace.");
    } finally {
      setLoadingInitial(false);
    }
  }, [versionIdParam]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function handleGenerateMaster() {
    setGenerating(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const res = await fetch("/api/resumes/generate", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate resume");

      const version = json.version as ResumeVersion;
      setActiveVersion(version);
      setDraftData(version.data);
      setDraftTitle(version.title);
      setDirty(false);
      setStatusMessage(
        `Master resume generated using ${version.usedPoolIds.length} work pool entries.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate master resume"
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleFetchJobUrl() {
    if (!jobUrl.trim()) return;
    setFetchingUrl(true);
    setFetchHint("");
    setErrorMessage("");
    try {
      const res = await fetch("/api/jobs/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl.trim() }),
      });
      const json = await res.json();
      if (json.ok && json.text) {
        setJobDescription(json.text);
        if (json.pageTitle && !customTitle) {
          setCustomTitle(json.pageTitle.slice(0, 80));
        }
        setFetchHint("Job description extracted! Review it below and click Tailor Resume.");
      } else {
        setFetchHint(
          json.reason ||
            "Could not extract text automatically. Please paste the job description below."
        );
        jdTextareaRef.current?.focus();
      }
    } catch {
      setFetchHint("Could not reach the URL. Please paste the job description below.");
      jdTextareaRef.current?.focus();
    } finally {
      setFetchingUrl(false);
    }
  }

  async function handleTailor(e: React.FormEvent) {
    e.preventDefault();
    if (!jobDescription.trim()) {
      setErrorMessage("Please fetch or paste a job description first.");
      return;
    }

    setTailoring(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const res = await fetch("/api/resumes/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customTitle.trim() || undefined,
          jobUrl: jobUrl.trim(),
          jobDescription: jobDescription.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Tailoring failed");

      const version = json.version as ResumeVersion;
      setActiveVersion(version);
      setDraftData(version.data);
      setDraftTitle(version.title);
      setDirty(false);
      setStatusMessage(
        `Tailored resume "${version.title}" saved using ${version.usedPoolIds.length} pool entries.`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Tailoring failed");
    } finally {
      setTailoring(false);
    }
  }

  async function handleSaveVersionEdits() {
    if (!activeVersion) return;
    setSavingVersion(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/resumes/${activeVersion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle, data: draftData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save edits");
      setActiveVersion(json.version);
      setDirty(false);
      setStatusMessage("Edits saved to this resume version.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save edits");
    } finally {
      setSavingVersion(false);
    }
  }

  return (
    <div className="space-y-5 print-container">
      {/* Top Action Bar */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Resume Studio
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Synthesize your Base Resume + Work Data Pool into a master resume or tailor it to a specific job.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleGenerateMaster}
              disabled={generating || tailoring}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? "Generating Master..." : "Generate Master Resume"}
            </button>

            <button
              type="button"
              onClick={() => setTailorOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Target className="w-4 h-4 text-indigo-600" />
              Tailor to Job
              {tailorOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Tailor Panel */}
        {tailorOpen && (
          <form
            onSubmit={handleTailor}
            className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Job Posting URL (best-effort fetch, paste fallback supported)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="https://boards.greenhouse.io/..."
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchJobUrl}
                    disabled={fetchingUrl || !jobUrl.trim()}
                    className="px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-50"
                  >
                    {fetchingUrl ? "Fetching..." : "Fetch JD"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Version Label (optional)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Stripe — Staff Engineer"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {fetchHint && (
              <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>{fetchHint}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Job Description
              </label>
              <textarea
                ref={jdTextareaRef}
                rows={4}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Fetched job description will appear here, or paste the full job posting text directly..."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Fact-grounded: Gemini only uses facts from your Base Resume & Work Data Pool.
              </span>
              <button
                type="submit"
                disabled={tailoring || generating || !jobDescription.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {tailoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Tailoring Resume...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4" />
                    Tailor Resume to Job
                  </>
                )}
              </button>
            </div>
          </form>
        )}

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
      </div>

      {/* Split Workspace */}
      {loadingInitial ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Loading studio...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start print-container">
          {/* Left Pane: Insights & Editor */}
          <div className="no-print xl:col-span-5 space-y-4">
            {activeVersion && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                        activeVersion.kind === "tailored"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {activeVersion.kind}
                    </span>
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => {
                        setDraftTitle(e.target.value);
                        setDirty(true);
                      }}
                      className="font-semibold text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none flex-1 min-w-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveVersionEdits}
                    disabled={savingVersion || !dirty}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingVersion ? "Saving..." : dirty ? "Save Edits" : "Saved"}
                  </button>
                </div>

                {activeVersion.analysis && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
                    <div className="text-slate-600">
                      Incorporated{" "}
                      <span className="font-semibold text-slate-900">
                        {activeVersion.usedPoolIds.length}
                      </span>{" "}
                      work pool entries.
                    </div>

                    {activeVersion.analysis.matchedKeywords.length > 0 && (
                      <div>
                        <div className="font-semibold text-emerald-800 mb-1">
                          Matched Keywords
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {activeVersion.analysis.matchedKeywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeVersion.analysis.missingKeywords.length > 0 && (
                      <div>
                        <div className="font-semibold text-amber-800 mb-1">
                          Gaps / Not Evidenced in Pool
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {activeVersion.analysis.missingKeywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeVersion.analysis.tailoringNotes.length > 0 && (
                      <div>
                        <div className="font-semibold text-slate-700 mb-1">
                          AI Notes & Reminders
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                          {activeVersion.analysis.tailoringNotes.map((note, i) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <ResumeEditor
              compact
              value={draftData}
              onChange={(next) => {
                setDraftData(next);
                setDirty(true);
              }}
            />
          </div>

          {/* Right Pane: Live ATS Preview */}
          <div className="xl:col-span-7 print-container">
            <ResumePreview data={draftData} title={draftTitle} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Loading studio...
        </div>
      }
    >
      <StudioWorkspace />
    </Suspense>
  );
}
