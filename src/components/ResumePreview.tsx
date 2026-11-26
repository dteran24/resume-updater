"use client";

import React, { useState } from "react";
import { Printer, Download, Copy, Check } from "lucide-react";
import type { ResumeData } from "@/types/resume";
import { resumeToMarkdown } from "@/lib/markdown-export";

interface ResumePreviewProps {
  data: ResumeData;
  title?: string;
}

export function ResumePreview({ data, title = "resume" }: ResumePreviewProps) {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadMarkdown = () => {
    const md = resumeToMarkdown(data);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (data.basics.name || title || "resume")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    a.href = url;
    a.download = `${slug || "resume"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    const md = resumeToMarkdown(data);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const { basics, experience, projects, education, skills } = data;
  const contactItems = [
    basics.email,
    basics.phone,
    basics.location,
    ...basics.links,
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 print-container">
      <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xs">
        <span className="text-xs font-medium text-slate-500">
          ATS-Friendly Live Preview
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy MD
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export .md
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable ATS Resume Sheet */}
      <article
        id="resume-print-area"
        className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 sm:p-10 text-slate-900 leading-relaxed max-w-[820px] mx-auto"
      >
        {/* Header */}
        <header className="border-b border-slate-300 pb-3 mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            {basics.name || "Your Name"}
          </h1>
          {basics.title && (
            <p className="text-sm font-medium text-slate-700 mt-0.5">
              {basics.title}
            </p>
          )}
          {contactItems.length > 0 && (
            <p className="text-xs text-slate-600 mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
              {contactItems.map((item, idx) => (
                <span key={idx}>
                  {idx > 0 && <span className="mr-2 text-slate-400">•</span>}
                  {item}
                </span>
              ))}
            </p>
          )}
        </header>

        {/* Summary */}
        {basics.summary.trim() && (
          <section className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2">
              Summary
            </h2>
            <p className="text-[13px] text-slate-800 whitespace-pre-line">
              {basics.summary.trim()}
            </p>
          </section>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <section className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2.5">
              Experience
            </h2>
            <div className="space-y-3.5">
              {experience.map((exp, idx) => {
                const dateRange = [exp.startDate, exp.endDate]
                  .filter(Boolean)
                  .join(" – ");
                const cleanBullets = exp.bullets.map((b) => b.trim()).filter(Boolean);
                return (
                  <div key={exp.id || idx} className="resume-block">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <div className="text-[13.5px] font-semibold text-slate-950">
                        {exp.role || "Role"}
                        {exp.company && (
                          <span className="font-normal text-slate-700">
                            {" "}
                            — {exp.company}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">
                        {[dateRange, exp.location].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {cleanBullets.length > 0 && (
                      <ul className="mt-1.5 list-disc pl-5 space-y-1 text-[13px] text-slate-800">
                        {cleanBullets.map((bullet, bIdx) => (
                          <li key={bIdx}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <section className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2.5">
              Projects
            </h2>
            <div className="space-y-3">
              {projects.map((proj, idx) => {
                const cleanBullets = proj.bullets.map((b) => b.trim()).filter(Boolean);
                return (
                  <div key={proj.id || idx} className="resume-block">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[13.5px] font-semibold text-slate-950">
                        {proj.name || "Project"}
                      </span>
                      {proj.technologies.length > 0 && (
                        <span className="text-xs text-slate-600">
                          {proj.technologies.join(", ")}
                        </span>
                      )}
                    </div>
                    {proj.description.trim() && (
                      <p className="text-[13px] text-slate-800 mt-0.5">
                        {proj.description.trim()}
                      </p>
                    )}
                    {cleanBullets.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 space-y-1 text-[13px] text-slate-800">
                        {cleanBullets.map((bullet, bIdx) => (
                          <li key={bIdx}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Education */}
        {education.length > 0 && (
          <section className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2">
              Education
            </h2>
            <div className="space-y-2">
              {education.map((edu, idx) => {
                const degreeLine = [edu.degree, edu.field]
                  .filter(Boolean)
                  .join(" in ");
                const dates = [edu.startDate, edu.endDate].filter(Boolean).join(" – ");
                return (
                  <div key={edu.id || idx} className="resume-block">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <div className="text-[13px] font-semibold text-slate-950">
                        {edu.institution}
                        {degreeLine && (
                          <span className="font-normal text-slate-700">
                            {" "}
                            — {degreeLine}
                          </span>
                        )}
                      </div>
                      {dates && <span className="text-xs text-slate-600">{dates}</span>}
                    </div>
                    {edu.details.trim() && (
                      <p className="text-xs text-slate-700 mt-0.5">{edu.details}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Skills */}
        {skills.some((g) => g.items.length > 0) && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2">
              Skills
            </h2>
            <div className="space-y-1 text-[13px] text-slate-800">
              {skills
                .filter((g) => g.items.length > 0)
                .map((group, idx) => (
                  <div key={idx}>
                    <span className="font-semibold text-slate-950">
                      {group.category || "Skills"}:{" "}
                    </span>
                    <span>{group.items.join(", ")}</span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
