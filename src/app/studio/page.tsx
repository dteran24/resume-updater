"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  Check,
  X,
  Lightbulb,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { WindowChromeBar } from "@/components/Doodles";
import { ResumeEditor } from "@/components/ResumeEditor";
import { ResumePreview } from "@/components/ResumePreview";
import { applySuggestedEditToggle } from "@/lib/suggested-edits";
import {
  EMPTY_RESUME_DATA,
  type PageTarget,
  type PoolEntry,
  type ResumeData,
  type ResumeVersion,
  type TailoringAnalysis,
} from "@/types/resume";

const COACHING_LABELS: Record<
  string,
  { label: string; cls: string }
> = {
  "missing-metric": {
    label: "Add Metric",
    cls: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
  },
  "jd-gap-question": {
    label: "JD Gap Check",
    cls: "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]",
  },
  "weak-bullet": {
    label: "Tighten Bullet",
    cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  },
  formatting: {
    label: "Format Check",
    cls: "bg-[#F4F4F5] text-[#4B5563] border-[#E4E4E7]",
  },
};

function StudioWorkspace() {
  const searchParams = useSearchParams();
  const versionIdParam = searchParams.get("versionId");

  const [activeVersion, setActiveVersion] = useState<ResumeVersion | null>(null);
  const [draftData, setDraftData] = useState<ResumeData>(
    structuredClone(EMPTY_RESUME_DATA)
  );
  const [draftAnalysis, setDraftAnalysis] = useState<TailoringAnalysis | null>(null);
  const [draftTitle, setDraftTitle] = useState("Working Draft");
  const [pageTarget, setPageTarget] = useState<PageTarget>("1-page");
  const [poolEntries, setPoolEntries] = useState<PoolEntry[]>([]);
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

  const poolMap = useMemo(() => {
    const map = new Map<string, PoolEntry>();
    for (const entry of poolEntries) {
      map.set(entry.id, entry);
    }
    return map;
  }, [poolEntries]);

  const applyLoadedVersion = useCallback((v: ResumeVersion) => {
    setActiveVersion(v);
    setDraftData(v.data);
    setDraftAnalysis(v.analysis);
    setDraftTitle(v.title);
    setJobUrl(v.jobUrl || "");
    setJobDescription(v.jobDescription || "");
    if (v.analysis?.pageTarget) {
      setPageTarget(v.analysis.pageTarget);
    }
    setDirty(false);
  }, []);

  const loadInitial = useCallback(async () => {
    setLoadingInitial(true);
    setErrorMessage("");
    try {
      const poolPromise = fetch("/api/pool")
        .then((r) => (r.ok ? r.json() : { entries: [] }))
        .then((j) => setPoolEntries(j.entries ?? []))
        .catch(() => {});

      if (versionIdParam) {
        const res = await fetch(`/api/resumes/${versionIdParam}`);
        await poolPromise;
        if (res.ok) {
          const json = await res.json();
          applyLoadedVersion(json.version as ResumeVersion);
          return;
        }
      }

      const [versionsRes, baseRes] = await Promise.all([
        fetch("/api/resumes"),
        fetch("/api/base-resume"),
        poolPromise,
      ]);

      if (versionsRes.ok) {
        const vJson = await versionsRes.json();
        const latest = (vJson.versions ?? [])[0] as ResumeVersion | undefined;
        if (latest) {
          applyLoadedVersion(latest);
          return;
        }
      }

      if (baseRes.ok) {
        const bJson = await baseRes.json();
        setDraftData(bJson.data ?? structuredClone(EMPTY_RESUME_DATA));
        setDraftAnalysis(null);
        setDraftTitle("Base Resume Preview");
      }
    } catch {
      setErrorMessage("Failed to load workspace.");
    } finally {
      setLoadingInitial(false);
    }
  }, [versionIdParam, applyLoadedVersion]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function handleGenerateMaster() {
    setGenerating(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const res = await fetch("/api/resumes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageTarget }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate resume");

      const version = json.version as ResumeVersion;
      applyLoadedVersion(version);
      setStatusMessage(
        `Master resume (${pageTarget}) generated with ${
          version.analysis?.suggestedEdits?.length ?? 0
        } reviewable edits and ${version.usedPoolIds.length} pool entries.`
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
        const via =
          json.source === "json-ld"
            ? " (via structured JobPosting metadata)"
            : "";
        setFetchHint(
          `Job description extracted${via}! Review below and click Tailor Resume.`
        );
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
          pageTarget,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Tailoring failed");

      const version = json.version as ResumeVersion;
      applyLoadedVersion(version);
      const sourceLabel =
        version.analysis?.sourceResumeKind === "master"
          ? "latest Master Resume"
          : "Base Resume";
      setStatusMessage(
        `Tailored "${version.title}" (${pageTarget}) from your ${sourceLabel} + ${version.usedPoolIds.length} pool entries.`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Tailoring failed");
    } finally {
      setTailoring(false);
    }
  }

  function handleToggleSuggestedEdit(editId: string) {
    if (!draftAnalysis) return;
    const target = draftAnalysis.suggestedEdits.find((e) => e.id === editId);
    if (!target) return;

    const nextAccepted = !target.accepted;
    setDraftData((prev) => applySuggestedEditToggle(prev, target, nextAccepted));
    setDraftAnalysis((prev) =>
      prev
        ? {
            ...prev,
            suggestedEdits: prev.suggestedEdits.map((e) =>
              e.id === editId ? { ...e, accepted: nextAccepted } : e
            ),
          }
        : prev
    );
    setDirty(true);
  }

  function handleSetAllSuggestedEdits(accept: boolean) {
    if (!draftAnalysis) return;
    let nextData = draftData;
    const nextEdits = draftAnalysis.suggestedEdits.map((edit) => {
      if (edit.accepted !== accept) {
        nextData = applySuggestedEditToggle(nextData, edit, accept);
      }
      return { ...edit, accepted: accept };
    });
    setDraftData(nextData);
    setDraftAnalysis({ ...draftAnalysis, suggestedEdits: nextEdits });
    setDirty(true);
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
        body: JSON.stringify({
          title: draftTitle,
          data: draftData,
          analysis: draftAnalysis,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save edits");
      applyLoadedVersion(json.version as ResumeVersion);
      setStatusMessage("Edits saved to this resume version.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save edits");
    } finally {
      setSavingVersion(false);
    }
  }

  const suggestedEdits = draftAnalysis?.suggestedEdits ?? [];
  const acceptedCount = suggestedEdits.filter((e) => e.accepted).length;
  const coachingSuggestions = draftAnalysis?.coachingSuggestions ?? [];

  return (
    <div className="space-y-5 print-container">
      {/* Top Action Bar */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E4E4E7] pb-4">
          <div>
            <span className="font-mono-label text-[11px] font-semibold uppercase tracking-wider text-[#0D9488]">
              Step 03 · Build & Tailor
            </span>
            <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight mt-0.5">
              Resume Studio
            </h1>
            <p className="text-sm text-[#4B5563] mt-1">
              Generate an impact-first Master Resume or tailor to a job posting — then accept or reject each suggested edit individually.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1-Page / 2-Page Budget Toggle */}
            <div
              className="inline-flex rounded-lg bg-white border border-[#D4D4D8] p-0.5"
              role="group"
              aria-label="Target resume length"
            >
              {(["1-page", "2-page"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPageTarget(option)}
                  className={`font-mono-label px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    pageTarget === option
                      ? "bg-[#18181B] text-white"
                      : "text-[#4B5563] hover:text-[#111827]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleGenerateMaster}
              disabled={generating || tailoring}
              className="ph-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
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
              className="ph-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-sm"
            >
              <Target className="w-4 h-4 text-[#0D9488]" />
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
          <form onSubmit={handleTailor} className="ph-card overflow-hidden">
            <WindowChromeBar
              filename={`job-tailor.exe — target a posting (${pageTarget})`}
            />

            <div className="p-4 sm:p-5 space-y-3.5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-[#4B5563] mb-1">
                    Job Posting URL (supports JSON-LD & HTML, with paste fallback)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <LinkIcon className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        placeholder="https://boards.greenhouse.io/..."
                        className="ph-input pl-9 pr-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleFetchJobUrl}
                      disabled={fetchingUrl || !jobUrl.trim()}
                      className="ph-btn-secondary px-3.5 py-2 text-sm disabled:opacity-50"
                    >
                      {fetchingUrl ? "Fetching..." : "Fetch JD"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4B5563] mb-1">
                    Version Label (optional)
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Stripe — Staff Engineer"
                    className="ph-input px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {fetchHint && (
                <div className="flex items-start gap-2 text-xs font-medium text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">
                  <Info className="w-4 h-4 shrink-0 text-[#D97706] mt-0.5" />
                  <span>{fetchHint}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#4B5563] mb-1">
                  Job Description
                </label>
                <textarea
                  ref={jdTextareaRef}
                  rows={4}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Fetched job description lands here, or paste the full posting text directly..."
                  className="ph-input px-3.5 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="font-mono-label text-[11px] text-[#6B7280]">
                  starts from your latest Master Resume (or Base) + Work Pool · no hallucinated facts
                </span>
                <button
                  type="submit"
                  disabled={tailoring || generating || !jobDescription.trim()}
                  className="ph-btn-dark inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                >
                  {tailoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Tailoring Resume...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4 text-[#5EEAD4]" />
                      Tailor Resume to Job
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

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
      </div>

      {/* Split Workspace */}
      {loadingInitial ? (
        <div className="ph-card-soft p-10 text-center font-mono-label text-sm text-[#6B7280]">
          loading studio...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start print-container">
          {/* Left Pane: Match Report, Suggested Edits, Coaching & Editor */}
          <div className="no-print xl:col-span-5 space-y-4">
            {activeVersion && (
              <div className="ph-card overflow-hidden">
                <WindowChromeBar
                  filename={`match-report · ${activeVersion.kind}${
                    draftAnalysis?.pageTarget ? ` · ${draftAnalysis.pageTarget}` : ""
                  }`}
                  rightSlot={
                    <button
                      type="button"
                      onClick={handleSaveVersionEdits}
                      disabled={savingVersion || !dirty}
                      className="ph-btn-primary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] disabled:opacity-45"
                    >
                      <Save className="w-3 h-3" />
                      {savingVersion ? "Saving..." : dirty ? "Save Edits" : "Saved"}
                    </button>
                  }
                />

                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono-label px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        activeVersion.kind === "tailored"
                          ? "bg-[#CCFBF1] border-[#99F6E4] text-[#0F766E]"
                          : "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]"
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
                      className="font-bold text-sm text-[#111827] bg-transparent border-b border-transparent hover:border-[#D4D4D8] focus:border-[#0D9488] focus:outline-none flex-1 min-w-0"
                    />
                  </div>

                  {draftAnalysis && (
                    <div className="space-y-2.5 pt-2 border-t border-[#E4E4E7] text-xs">
                      <div className="font-mono-label text-[#4B5563] flex flex-wrap items-center gap-2">
                        <span>
                          incorporated{" "}
                          <span className="font-bold text-[#111827]">
                            {activeVersion.usedPoolIds.length}
                          </span>{" "}
                          work pool entries
                        </span>
                        {draftAnalysis.sourceResumeKind && (
                          <span>
                            · from{" "}
                            <span className="font-semibold text-[#111827]">
                              {draftAnalysis.sourceResumeKind === "master"
                                ? "latest Master"
                                : "Base Resume"}
                            </span>
                          </span>
                        )}
                      </div>

                      {draftAnalysis.matchedKeywords.length > 0 && (
                        <div>
                          <div className="font-bold text-[#047857] mb-1">
                            Matched Keywords
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {draftAnalysis.matchedKeywords.map((kw, i) => (
                              <span
                                key={i}
                                className="font-mono-label px-2 py-0.5 rounded bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {draftAnalysis.missingKeywords.length > 0 && (
                        <div>
                          <div className="font-bold text-[#B45309] mb-1">
                            Gaps (Not Evidenced in Pool)
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {draftAnalysis.missingKeywords.map((kw, i) => (
                              <span
                                key={i}
                                className="font-mono-label px-2 py-0.5 rounded bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {draftAnalysis.tailoringNotes.length > 0 && (
                        <div>
                          <div className="font-bold text-[#111827] mb-1">
                            Strategy Summary
                          </div>
                          <ul className="list-disc pl-4 space-y-0.5 text-[#4B5563]">
                            {draftAnalysis.tailoringNotes.map((note, i) => (
                              <li key={i}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Suggested Edits (Per-Bullet Accept / Reject) */}
            {suggestedEdits.length > 0 && (
              <div className="ph-card overflow-hidden">
                <WindowChromeBar
                  filename={`suggested-edits.diff · ${acceptedCount}/${suggestedEdits.length} accepted`}
                  rightSlot={
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSetAllSuggestedEdits(true)}
                        className="font-mono-label px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-[#D4D4D8] text-[#047857] hover:bg-[#ECFDF5]"
                      >
                        Accept all
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllSuggestedEdits(false)}
                        className="font-mono-label px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-[#D4D4D8] text-[#6B7280] hover:bg-[#F4F4F5]"
                      >
                        Reject all
                      </button>
                    </div>
                  }
                />

                <div className="p-3.5 space-y-3 max-h-[520px] overflow-y-auto">
                  {suggestedEdits.map((edit) => {
                    const actionStyle =
                      edit.action === "add"
                        ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                        : edit.action === "remove"
                          ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
                          : "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]";

                    return (
                      <div
                        key={edit.id}
                        className={`rounded-lg border p-3 space-y-2 transition-opacity ${
                          edit.accepted
                            ? "bg-white border-[#E4E4E7]"
                            : "bg-[#FAFAFA] border-[#E4E4E7] opacity-65"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span
                              className={`font-mono-label px-1.5 py-0.5 rounded font-bold uppercase border ${actionStyle}`}
                            >
                              {edit.action}
                            </span>
                            <span className="font-semibold text-[#111827]">
                              {edit.targetLabel || edit.section}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleSuggestedEdit(edit.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border shrink-0 transition-colors ${
                              edit.accepted
                                ? "bg-[#0D9488] text-white border-[#0F766E] hover:bg-[#0F766E]"
                                : "bg-white text-[#4B5563] border-[#D4D4D8] hover:border-[#18181B]"
                            }`}
                          >
                            {edit.accepted ? (
                              <>
                                <Check className="w-3 h-3" />
                                Accepted
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3" />
                                Rejected
                              </>
                            )}
                          </button>
                        </div>

                        {edit.before && (
                          <div className="rounded bg-[#FEF2F2]/70 border border-[#FECACA]/70 px-2.5 py-1.5 text-xs text-[#7F1D1D] line-through">
                            {edit.before}
                          </div>
                        )}

                        {edit.after && (
                          <div className="rounded bg-[#ECFDF5]/70 border border-[#A7F3D0]/80 px-2.5 py-1.5 text-xs text-[#064E3B]">
                            {edit.after}
                          </div>
                        )}

                        {edit.reason && (
                          <p className="text-[11.5px] text-[#4B5563] leading-snug">
                            <span className="font-semibold text-[#111827]">Why:</span>{" "}
                            {edit.reason}
                          </p>
                        )}

                        {edit.sourcePoolIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {edit.sourcePoolIds.map((pid) => {
                              const sourceEntry = poolMap.get(pid);
                              return (
                                <span
                                  key={pid}
                                  className="font-mono-label inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F4F4F5] border border-[#E4E4E7] text-[10px] text-[#4B5563]"
                                  title={sourceEntry?.rawText || pid}
                                >
                                  <Layers className="w-2.5 h-2.5 text-[#0D9488]" />
                                  {sourceEntry
                                    ? sourceEntry.rawText.slice(0, 52) +
                                      (sourceEntry.rawText.length > 52 ? "…" : "")
                                    : "Work Pool entry"}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actionable AI Coaching */}
            {coachingSuggestions.length > 0 && (
              <div className="ph-card-soft overflow-hidden">
                <WindowChromeBar filename="ai-coaching.md — ways to strengthen this" />
                <div className="p-3.5 space-y-2.5">
                  {coachingSuggestions.map((tip, idx) => {
                    const meta = COACHING_LABELS[tip.kind] ?? COACHING_LABELS.formatting;
                    return (
                      <div
                        key={idx}
                        className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-[#0D9488]" />
                            <span
                              className={`font-mono-label px-1.5 py-0.5 rounded text-[10px] font-semibold border ${meta.cls}`}
                            >
                              {meta.label}
                            </span>
                            {tip.targetLabel && (
                              <span className="font-semibold text-[#111827]">
                                {tip.targetLabel}
                              </span>
                            )}
                          </div>
                          {tip.kind === "jd-gap-question" && (
                            <Link
                              href="/pool"
                              className="font-mono-label inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#0D9488] hover:underline shrink-0"
                            >
                              Log in Pool
                              <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        <p className="text-[#4B5563] leading-relaxed">{tip.message}</p>
                      </div>
                    );
                  })}
                </div>
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
        <div className="ph-card-soft p-10 text-center font-mono-label text-sm text-[#6B7280]">
          loading studio...
        </div>
      }
    >
      <StudioWorkspace />
    </Suspense>
  );
}
