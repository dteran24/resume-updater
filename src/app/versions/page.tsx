"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  ExternalLink,
  Trash2,
  ArrowRight,
  Sparkles,
  Target,
} from "lucide-react";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Saved Versions
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Every Master and Job-Tailored resume you generate is saved here for editing and PDF/Markdown export.
          </p>
        </div>

        <Link
          href="/studio"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <Sparkles className="w-4 h-4" />
          Open Studio
        </Link>
      </div>

      {error && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Loading saved versions...
        </div>
      ) : versions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <History className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-600">
            No generated resumes yet. Head to Studio to create your first Master or Tailored resume.
          </p>
          <Link
            href="/studio"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
          >
            Go to Studio
            <ArrowRight className="w-4 h-4" />
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
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                          v.kind === "tailored"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {v.kind === "tailored" ? (
                          <Target className="w-3 h-3" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        {v.kind}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(v.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete version"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h2 className="text-base font-semibold text-slate-900">
                    {v.title}
                  </h2>

                  {v.jobUrl && (
                    <a
                      href={v.jobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline break-all"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {v.jobUrl}
                    </a>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs text-slate-600 pt-1">
                    <span>{v.usedPoolIds.length} pool items used</span>
                    {v.kind === "tailored" && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">
                          {matchedCount} matched keywords
                        </span>
                        {missingCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-700">
                              {missingCount} gaps
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                  <Link
                    href={`/studio?versionId=${v.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
                  >
                    Open in Studio
                    <ArrowRight className="w-3.5 h-3.5" />
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
