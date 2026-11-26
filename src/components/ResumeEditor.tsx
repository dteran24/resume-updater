"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  EducationItem,
  ExperienceItem,
  ProjectItem,
  ResumeData,
  SkillGroup,
} from "@/types/resume";

interface ResumeEditorProps {
  value: ResumeData;
  onChange: (next: ResumeData) => void;
  compact?: boolean;
}

function linesToArray(text: string): string[] {
  return text.split("\n");
}

function arrayToLines(items: string[]): string {
  return items.join("\n");
}

export function ResumeEditor({
  value,
  onChange,
  compact = false,
}: ResumeEditorProps) {
  const updateBasics = (patch: Partial<ResumeData["basics"]>) => {
    onChange({
      ...value,
      basics: { ...value.basics, ...patch },
    });
  };

  const updateExperience = (idx: number, patch: Partial<ExperienceItem>) => {
    const next = value.experience.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    onChange({ ...value, experience: next });
  };

  const addExperience = () => {
    onChange({
      ...value,
      experience: [
        {
          id: crypto.randomUUID(),
          company: "",
          role: "",
          location: "",
          startDate: "",
          endDate: "Present",
          bullets: [""],
        },
        ...value.experience,
      ],
    });
  };

  const removeExperience = (idx: number) => {
    onChange({
      ...value,
      experience: value.experience.filter((_, i) => i !== idx),
    });
  };

  const updateProject = (idx: number, patch: Partial<ProjectItem>) => {
    const next = value.projects.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    onChange({ ...value, projects: next });
  };

  const addProject = () => {
    onChange({
      ...value,
      projects: [
        ...value.projects,
        {
          id: crypto.randomUUID(),
          name: "",
          description: "",
          technologies: [],
          url: "",
          bullets: [],
        },
      ],
    });
  };

  const removeProject = (idx: number) => {
    onChange({
      ...value,
      projects: value.projects.filter((_, i) => i !== idx),
    });
  };

  const updateEducation = (idx: number, patch: Partial<EducationItem>) => {
    const next = value.education.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    onChange({ ...value, education: next });
  };

  const addEducation = () => {
    onChange({
      ...value,
      education: [
        ...value.education,
        {
          id: crypto.randomUUID(),
          institution: "",
          degree: "",
          field: "",
          startDate: "",
          endDate: "",
          details: "",
        },
      ],
    });
  };

  const removeEducation = (idx: number) => {
    onChange({
      ...value,
      education: value.education.filter((_, i) => i !== idx),
    });
  };

  const updateSkillGroup = (idx: number, patch: Partial<SkillGroup>) => {
    const next = value.skills.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    onChange({ ...value, skills: next });
  };

  const addSkillGroup = () => {
    onChange({
      ...value,
      skills: [...value.skills, { category: "Skills", items: [] }],
    });
  };

  const removeSkillGroup = (idx: number) => {
    onChange({
      ...value,
      skills: value.skills.filter((_, i) => i !== idx),
    });
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelCls = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <div className="space-y-6">
      {/* Basics */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Contact & Summary</h3>
        <div
          className={`grid gap-3 ${
            compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          <div>
            <label className={labelCls}>Full Name</label>
            <input
              type="text"
              value={value.basics.name}
              onChange={(e) => updateBasics({ name: e.target.value })}
              placeholder="Jane Doe"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Headline / Target Title</label>
            <input
              type="text"
              value={value.basics.title}
              onChange={(e) => updateBasics({ title: e.target.value })}
              placeholder="Senior Software Engineer"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              value={value.basics.email}
              onChange={(e) => updateBasics({ email: e.target.value })}
              placeholder="jane@example.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input
              type="text"
              value={value.basics.phone}
              onChange={(e) => updateBasics({ phone: e.target.value })}
              placeholder="(555) 123-4567"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input
              type="text"
              value={value.basics.location}
              onChange={(e) => updateBasics({ location: e.target.value })}
              placeholder="Austin, TX"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Links (comma-separated)</label>
            <input
              type="text"
              value={value.basics.links.join(", ")}
              onChange={(e) =>
                updateBasics({
                  links: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="github.com/janedoe, linkedin.com/in/janedoe"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Professional Summary</label>
          <textarea
            rows={3}
            value={value.basics.summary}
            onChange={(e) => updateBasics({ summary: e.target.value })}
            placeholder="Concise summary of your experience and strengths..."
            className={inputCls}
          />
        </div>
      </section>

      {/* Experience */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Experience ({value.experience.length})
          </h3>
          <button
            type="button"
            onClick={addExperience}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Role
          </button>
        </div>

        {value.experience.length === 0 ? (
          <p className="text-xs text-slate-500">
            No experience entries yet. Import a resume above or click Add Role.
          </p>
        ) : (
          <div className="space-y-4">
            {value.experience.map((exp, idx) => (
              <div
                key={exp.id || idx}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    <div>
                      <label className={labelCls}>Role / Title</label>
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) =>
                          updateExperience(idx, { role: e.target.value })
                        }
                        placeholder="Software Engineer"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Company</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) =>
                          updateExperience(idx, { company: e.target.value })
                        }
                        placeholder="Acme Corp"
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Start Date</label>
                        <input
                          type="text"
                          value={exp.startDate}
                          onChange={(e) =>
                            updateExperience(idx, { startDate: e.target.value })
                          }
                          placeholder="Jan 2023"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>End Date</label>
                        <input
                          type="text"
                          value={exp.endDate}
                          onChange={(e) =>
                            updateExperience(idx, { endDate: e.target.value })
                          }
                          placeholder="Present"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Location</label>
                      <input
                        type="text"
                        value={exp.location}
                        onChange={(e) =>
                          updateExperience(idx, { location: e.target.value })
                        }
                        placeholder="Remote"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExperience(idx)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Remove role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className={labelCls}>
                    Accomplishment Bullets (one per line)
                  </label>
                  <textarea
                    rows={Math.max(3, exp.bullets.length + 1)}
                    value={arrayToLines(exp.bullets)}
                    onChange={(e) =>
                      updateExperience(idx, {
                        bullets: linesToArray(e.target.value),
                      })
                    }
                    placeholder="Led migration of billing pipeline, reducing latency by 42%..."
                    className={inputCls}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projects */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Projects ({value.projects.length})
          </h3>
          <button
            type="button"
            onClick={addProject}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Project
          </button>
        </div>

        {value.projects.length > 0 && (
          <div className="space-y-3">
            {value.projects.map((proj, idx) => (
              <div
                key={proj.id || idx}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    <div>
                      <label className={labelCls}>Project Name</label>
                      <input
                        type="text"
                        value={proj.name}
                        onChange={(e) =>
                          updateProject(idx, { name: e.target.value })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Technologies (comma-separated)</label>
                      <input
                        type="text"
                        value={proj.technologies.join(", ")}
                        onChange={(e) =>
                          updateProject(idx, {
                            technologies: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProject(idx)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <input
                    type="text"
                    value={proj.description}
                    onChange={(e) =>
                      updateProject(idx, { description: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Bullets (one per line)</label>
                  <textarea
                    rows={2}
                    value={arrayToLines(proj.bullets)}
                    onChange={(e) =>
                      updateProject(idx, {
                        bullets: linesToArray(e.target.value),
                      })
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Education */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Education ({value.education.length})
          </h3>
          <button
            type="button"
            onClick={addEducation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Education
          </button>
        </div>

        {value.education.length > 0 && (
          <div className="space-y-3">
            {value.education.map((edu, idx) => (
              <div
                key={edu.id || idx}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    <div>
                      <label className={labelCls}>Institution</label>
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) =>
                          updateEducation(idx, { institution: e.target.value })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Degree</label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) =>
                          updateEducation(idx, { degree: e.target.value })
                        }
                        placeholder="B.S."
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Field of Study</label>
                      <input
                        type="text"
                        value={edu.field}
                        onChange={(e) =>
                          updateEducation(idx, { field: e.target.value })
                        }
                        placeholder="Computer Science"
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Start</label>
                        <input
                          type="text"
                          value={edu.startDate}
                          onChange={(e) =>
                            updateEducation(idx, { startDate: e.target.value })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>End</label>
                        <input
                          type="text"
                          value={edu.endDate}
                          onChange={(e) =>
                            updateEducation(idx, { endDate: e.target.value })
                          }
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEducation(idx)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Skills */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Skills ({value.skills.length})
          </h3>
          <button
            type="button"
            onClick={addSkillGroup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Skill Group
          </button>
        </div>

        {value.skills.length > 0 && (
          <div className="space-y-2.5">
            {value.skills.map((group, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5"
              >
                <input
                  type="text"
                  value={group.category}
                  onChange={(e) =>
                    updateSkillGroup(idx, { category: e.target.value })
                  }
                  placeholder="Category (e.g. Languages)"
                  className="sm:w-44 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium"
                />
                <input
                  type="text"
                  value={group.items.join(", ")}
                  onChange={(e) =>
                    updateSkillGroup(idx, {
                      items: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="TypeScript, Go, PostgreSQL..."
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeSkillGroup(idx)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 self-end sm:self-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
