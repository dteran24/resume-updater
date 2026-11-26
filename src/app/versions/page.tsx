"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Trash2,
  ArrowRight,
  Sparkles,
  Target,
} from "lucide-react";
import { NotebookDoodle, WindowChromeBar } from "@/components/Doodles";
import type { ResumeVersion } from "@/types/resume";

export default function SavedVersionsPage() {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/resumes");
      if (!res.ok) throw new Error("Failed to load versions");
      const json = await res.json();
      setVersions(json.versions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setVersions((prev) => prev.filter((v) => v.id !== id));
    } catch {
      setError("Could not delete resume version.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E4E4E7] pb-4">
        <div>
          <span className="font-mono-label text-[11px] font-semibold uppercase tracking-wider text-[#0D9488]">
            Step 04 · Archive
          </span>
          <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight mt-0.5">
            Saved Versions
          </h1>
          <p className="text-sm text-[#4B5563] mt-1">
            Every Master and Job-Tailored resume snapshot lives here for quick tweaks or PDF export.
          </p>
        </div>

        <Link
          href="/studio"
          className="ph-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Sparkles className="w-4 h-4" />
          Open Studio
        </Link>
      </div>

      {error && (
        <div className="text-sm font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="ph-card-soft p-10 text-center font-mono-label text-sm text-[#6B7280]">
          loading saved versions...
        </div>
      ) : versions.length === 0 ? (
        <div className="ph-card-soft p-10 text-center space-y-3">
          <NotebookDoodle className="w-14 h-14 mx-auto" />
          <p className="text-sm font-medium text-[#4B5563]">
            No generated resumes yet. Hop into Studio to build your first Master or Tailored version.
          </p>
          <Link
            href="/studio"
            className="ph-btn-dark inline-flex items-center gap-1.5 px-4 py-2 text-sm"
          >
            Go to Studio
            <ArrowRight className="w-4 h-4 text-[#5EEAD4]" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {versions.map((v) => {
            const matchedCount = v.analysis?.matchedKeywords.length ?? 0;
            const missingCount = v.analysis?.missingKeywords.length ?? 0;
            return (
              <div
                key={v.id}
                className="ph-card overflow-hidden flex flex-col justify-between"
              >
                <WindowChromeBar
                  filename={`${v.kind}-${new Date(v.updatedAt).toISOString().slice(0, 10)}.md`}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="p-0.5 rounded text-[#6B7280] hover:text-[#DC2626]"
                      title="Delete version"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  }
                />

                <div className="p-4 space-y-2.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono-label inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        v.kind === "tailored"
                          ? "bg-[#CCFBF1] border-[#99F6E4] text-[#0F766E]"
                          : "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]"
                      }`}
                    >
                      {v.kind === "tailored" ? (
                        <Target className="w-3 h-3" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {v.kind}
                    </span>
                    <span className="font-mono-label text-xs text-[#6B7280]">
                      {new Date(v.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h2 className="text-base font-extrabold text-[#111827]">
                    {v.title}
                  </h2>

                  {v.jobUrl && (
                    <a
                      href={v.jobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono-label inline-flex items-center gap-1 text-xs text-[#0D9488] hover:underline break-all"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {v.jobUrl}
                    </a>
                  )}

                  <div className="font-mono-label flex flex-wrap gap-2 text-xs text-[#4B5563] pt-1">
                    <span>{v.usedPoolIds.length} pool items</span>
                    {v.kind === "tailored" && (
                      <>
                        <span>·</span>
                        <span className="text-[#047857] font-semibold">
                          {matchedCount} matched
                        </span>
                        {missingCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-[#B45309]">
                              {missingCount} gaps
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 bg-[#FAFAFA] border-t border-[#E4E4E7] flex items-center justify-end">
                  <Link
                    href={`/studio?versionId=${v.id}`}
                    className="ph-btn-dark inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    Open in Studio
                    <ArrowRight className="w-3.5 h-3.5 text-[#5EEAD4]" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
