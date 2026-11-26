"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Sparkles,
  Trash2,
  Edit3,
  Check,
  X,
  Building2,
  AlertTriangle,
  Calendar,
  Tag,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import { formatRoleLabel, type ExperienceItem, type PoolEntry } from "@/types/resume";

const UNLISTED_VALUE = "__unlisted__";

export default function WorkPoolPage() {
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [roles, setRoles] = useState<ExperienceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick capture state
  const [rawText, setRawText] = useState("");
  const [selectedRoleOption, setSelectedRoleOption] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState("");

  // Promote unlisted role modal/inline state
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteCompany, setPromoteCompany] = useState("");
  const [promoteRole, setPromoteRole] = useState("");
  const [promoteStart, setPromoteStart] = useState("");
  const [promoteEnd, setPromoteEnd] = useState("Present");
  const [promotingBusy, setPromotingBusy] = useState(false);

  const [banner, setBanner] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [poolRes, baseRes] = await Promise.all([
        fetch("/api/pool"),
        fetch("/api/base-resume"),
      ]);
      if (poolRes.ok) {
        const poolJson = await poolRes.json();
        setEntries(poolJson.entries ?? []);
      }
      if (baseRes.ok) {
        const baseJson = await baseRes.json();
        setRoles(baseJson.data?.experience ?? []);
      }
    } catch {
      setError("Failed to load work data pool.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const roleLabels = useMemo(() => roles.map(formatRoleLabel), [roles]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      for (const tag of entry.tags) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (tagFilter && !entry.tags.includes(tagFilter)) return false;
      if (!q) return true;
      const haystack = [
        entry.rawText,
        entry.matchedRole,
        entry.companyHint,
        entry.roleHint,
        entry.suggestedCompany,
        entry.suggestedRole,
        ...entry.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, searchQuery, tagFilter]);

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim()) return;

    setSubmitting(true);
    setBanner("");
    setError("");

    try {
      const isUnlisted = selectedRoleOption === UNLISTED_VALUE;
      let companyHint = "";
      let roleHint = "";
      let matchedRole = "";

      if (isUnlisted) {
        companyHint = newCompany.trim();
        roleHint = newRoleTitle.trim();
      } else if (selectedRoleOption) {
        const found = roles.find((r) => formatRoleLabel(r) === selectedRoleOption);
        if (found) {
          companyHint = found.company;
          roleHint = found.role;
          matchedRole = selectedRoleOption;
        }
      }

      const res = await fetch("/api/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawText.trim(),
          companyHint,
          roleHint,
          occurredAt: occurredAt.trim(),
          matchedRole,
          isUnlistedRole: isUnlisted,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add entry");

      setEntries((prev) => [json.entry, ...prev]);
      setRawText("");
      setOccurredAt("");
      if (isUnlisted) {
        setNewCompany("");
        setNewRoleTitle("");
        setSelectedRoleOption("");
      }
      if (json.aiWarning) {
        setBanner(json.aiWarning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/pool/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError("Could not delete entry.");
    }
  }

  async function handleSaveEdit(id: string) {
    try {
      const res = await fetch(`/api/pool/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: editText,
          occurredAt: editDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setEntries((prev) => prev.map((e) => (e.id === id ? json.entry : e)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  function openPromote(entry: PoolEntry) {
    setPromotingId(entry.id);
    setPromoteCompany(entry.suggestedCompany || entry.companyHint || "");
    setPromoteRole(entry.suggestedRole || entry.roleHint || "");
    setPromoteStart(entry.occurredAt || "");
    setPromoteEnd("Present");
  }

  async function handlePromoteSubmit(e: React.FormEvent, entryId: string) {
    e.preventDefault();
    if (!promoteCompany.trim()) return;
    setPromotingBusy(true);
    setError("");
    try {
      const res = await fetch("/api/base-resume/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: promoteCompany.trim(),
          role: promoteRole.trim() || "Role",
          startDate: promoteStart.trim(),
          endDate: promoteEnd.trim() || "Present",
          poolEntryId: entryId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add role");
      setRoles(json.data?.experience ?? []);
      setPromotingId(null);
      setBanner(
        `Added "${promoteRole.trim() || "Role"} @ ${promoteCompany.trim()}" to your Base Resume.`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to promote role");
    } finally {
      setPromotingBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Work Data Pool
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Log accomplishments, shipped projects, and metrics as they happen. Gemini auto-tags skills and detects new companies not yet on your resume.
        </p>
      </div>

      {banner && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
          <span>{banner}</span>
          <button
            type="button"
            onClick={() => setBanner("")}
            className="text-amber-600 hover:text-amber-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Quick Capture Form */}
      <form
        onSubmit={handleAddEntry}
        className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5"
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Log a Work Accomplishment
          </label>
          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="e.g. At Acme Corp, built an async webhook retry queue in Go that cut failed payment alerts by 65%..."
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Company / Role (optional)
            </label>
            <select
              value={selectedRoleOption}
              onChange={(e) => setSelectedRoleOption(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Auto-detect from note</option>
              {roleLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
              <option value={UNLISTED_VALUE}>
                + New / Unlisted Company or Role
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Date / Quarter (optional)
            </label>
            <input
              type="text"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              placeholder="e.g. Nov 2026 or Q4 2026"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {selectedRoleOption === UNLISTED_VALUE && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-amber-50/70 border border-amber-200 p-3">
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">
                New Company Name
              </label>
              <input
                type="text"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="e.g. Acme Robotics"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">
                Your Role / Title there
              </label>
              <input
                type="text"
                value={newRoleTitle}
                onChange={(e) => setNewRoleTitle(e.target.value)}
                placeholder="e.g. Staff Backend Engineer"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            AI extracts skills, metrics, and flags unlisted companies automatically
          </span>
          <button
            type="submit"
            disabled={submitting || !rawText.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add to Pool
              </>
            )}
          </button>
        </div>
      </form>

      {/* Search & Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pool notes, companies, roles, or tags..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTagFilter("")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                tagFilter === ""
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              All ({entries.length})
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  tagFilter === tag
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pool Entries */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Loading pool entries...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          {entries.length === 0
            ? "Your work data pool is empty. Drop your first accomplishment note above!"
            : "No pool entries match your current search or filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isEditing = editingId === entry.id;
            const isPromoting = promotingId === entry.id;
            const roleBadge =
              entry.matchedRole ||
              formatRoleLabel({
                company: entry.companyHint || entry.suggestedCompany,
                role: entry.roleHint || entry.suggestedRole,
              });

            return (
              <div
                key={entry.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2.5"
              >
                {isEditing ? (
                  <div className="space-y-2.5">
                    <textarea
                      rows={3}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        type="text"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        placeholder="Date (optional)"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(entry.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {entry.rawText}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditText(entry.rawText);
                            setEditDate(entry.occurredAt);
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="Edit note"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {roleBadge && roleBadge !== "Untitled Role" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          <Building2 className="w-3 h-3" />
                          {roleBadge}
                        </span>
                      )}

                      {entry.isNewRole && (
                        <button
                          type="button"
                          onClick={() => openPromote(entry)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-medium hover:bg-amber-200 transition-colors"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          New Role Detected — Add to Base Resume
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}

                      {entry.occurredAt && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {entry.occurredAt}
                        </span>
                      )}

                      {entry.metrics.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"
                        >
                          {m}
                        </span>
                      ))}

                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>

                    {isPromoting && (
                      <form
                        onSubmit={(e) => handlePromoteSubmit(e, entry.id)}
                        className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2.5"
                      >
                        <div className="text-xs font-semibold text-amber-900">
                          Add this company/role to your Base Resume
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            required
                            value={promoteCompany}
                            onChange={(e) => setPromoteCompany(e.target.value)}
                            placeholder="Company *"
                            className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={promoteRole}
                            onChange={(e) => setPromoteRole(e.target.value)}
                            placeholder="Role / Title"
                            className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={promoteStart}
                            onChange={(e) => setPromoteStart(e.target.value)}
                            placeholder="Start Date"
                            className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={promoteEnd}
                            onChange={(e) => setPromoteEnd(e.target.value)}
                            placeholder="End Date"
                            className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPromotingId(null)}
                            className="px-2.5 py-1 rounded-md text-xs text-slate-600 hover:bg-amber-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={promotingBusy}
                            className="px-3 py-1 rounded-md text-xs font-medium bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50"
                          >
                            {promotingBusy ? "Adding..." : "Confirm & Add Role"}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
