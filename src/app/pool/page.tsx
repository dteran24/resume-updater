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
import { NotebookDoodle, WindowChromeBar } from "@/components/Doodles";
import { formatRoleLabel, type ExperienceItem, type PoolEntry } from "@/types/resume";

const UNLISTED_VALUE = "__unlisted__";

export default function WorkPoolPage() {
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [roles, setRoles] = useState<ExperienceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [rawText, setRawText] = useState("");
  const [selectedRoleOption, setSelectedRoleOption] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState("");

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
      <div className="border-b border-[#E4E4E7] pb-4">
        <span className="font-mono-label text-[11px] font-semibold uppercase tracking-wider text-[#0D9488]">
          Step 02 · Career Win Log
        </span>
        <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight mt-0.5">
          Work Data Pool
        </h1>
        <p className="text-sm text-[#4B5563] mt-1 max-w-2xl">
          Log what you shipped, fixed, or led as it happens. Rough notes are fine — Gemini tags skills, extracts metrics, and flags new companies automatically.
        </p>
      </div>

      {banner && (
        <div className="text-sm font-medium text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-4 py-3 flex items-center justify-between gap-2">
          <span>{banner}</span>
          <button
            type="button"
            onClick={() => setBanner("")}
            className="text-[#92400E] hover:opacity-70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="text-sm font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Quick Capture Card */}
      <form onSubmit={handleAddEntry} className="ph-card overflow-hidden">
        <WindowChromeBar
          filename="brag-pool.log — quick capture"
          rightSlot={
            <span className="font-mono-label text-[10px] text-[#6B7280]">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          }
        />

        <div className="p-4 sm:p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-[#111827] mb-1.5">
              What did you ship or solve?
            </label>
            <textarea
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="e.g. At Acme Corp, built an async webhook retry queue in Go that cut failed payment alerts by 65%..."
              className="ph-input px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4B5563] mb-1">
                Company / Role (optional)
              </label>
              <select
                value={selectedRoleOption}
                onChange={(e) => setSelectedRoleOption(e.target.value)}
                className="ph-input px-3 py-2 text-sm"
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
              <label className="block text-xs font-bold text-[#4B5563] mb-1">
                When? (optional)
              </label>
              <input
                type="text"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                placeholder="e.g. Nov 2026 or Q4 2026"
                className="ph-input px-3 py-2 text-sm"
              />
            </div>
          </div>

          {selectedRoleOption === UNLISTED_VALUE && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] p-3">
              <div>
                <label className="block text-xs font-bold text-[#92400E] mb-1">
                  New Company Name
                </label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Acme Robotics"
                  className="ph-input px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#92400E] mb-1">
                  Your Role / Title there
                </label>
                <input
                  type="text"
                  value={newRoleTitle}
                  onChange={(e) => setNewRoleTitle(e.target.value)}
                  placeholder="e.g. Staff Backend Engineer"
                  className="ph-input px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="font-mono-label text-[11px] text-[#6B7280] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
              auto-tags skills, metrics & unlisted companies
            </span>
            <button
              type="submit"
              disabled={submitting || !rawText.trim()}
              className="ph-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
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
        </div>
      </form>

      {/* Search & Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter notes by keyword, company, role, or skill tag..."
            className="ph-input pl-10 pr-4 py-2.5 text-sm"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTagFilter("")}
              className={`font-mono-label px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                tagFilter === ""
                  ? "bg-[#18181B] text-white border-[#18181B]"
                  : "bg-white border-[#E4E4E7] text-[#4B5563] hover:border-[#18181B]"
              }`}
            >
              all ({entries.length})
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                className={`font-mono-label px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  tagFilter === tag
                    ? "bg-[#0D9488] text-white border-[#0F766E]"
                    : "bg-white border-[#E4E4E7] text-[#4B5563] hover:border-[#0D9488]"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pool Entries */}
      {loading ? (
        <div className="ph-card-soft p-10 text-center font-mono-label text-sm text-[#6B7280]">
          loading work data pool...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="ph-card-soft p-10 text-center space-y-3">
          <NotebookDoodle className="w-14 h-14 mx-auto" />
          <p className="text-sm font-medium text-[#4B5563]">
            {entries.length === 0
              ? "Nothing in your win log yet. Drop your first accomplishment above!"
              : "No entries match your search or tag filter."}
          </p>
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
                className="ph-card-soft p-4 space-y-3 hover:border-[#D4D4D8] transition-colors"
              >
                {isEditing ? (
                  <div className="space-y-2.5">
                    <textarea
                      rows={3}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="ph-input px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        type="text"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        placeholder="Date (optional)"
                        className="ph-input w-48 px-3 py-1.5 text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="ph-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(entry.id)}
                          className="ph-btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
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
                      <p className="text-[14.5px] text-[#111827] whitespace-pre-line leading-relaxed">
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
                          className="p-1.5 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[#F4F4F5]"
                          title="Edit note"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 rounded-md text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2]"
                          title="Delete note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {roleBadge && roleBadge !== "Untitled Role" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#F4F4F5] border border-[#E4E4E7] text-[#111827] font-semibold">
                          <Building2 className="w-3 h-3 text-[#6B7280]" />
                          {roleBadge}
                        </span>
                      )}

                      {entry.isNewRole && (
                        <button
                          type="button"
                          onClick={() => openPromote(entry)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#FFFBEB] text-[#92400E] border border-[#FCD34D] font-bold hover:bg-[#FEF3C7] transition-colors"
                        >
                          <AlertTriangle className="w-3 h-3 text-[#D97706]" />
                          New Role Detected — Add to Base Resume
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}

                      {entry.occurredAt && (
                        <span className="font-mono-label inline-flex items-center gap-1 text-[#6B7280]">
                          <Calendar className="w-3 h-3" />
                          {entry.occurredAt}
                        </span>
                      )}

                      {entry.metrics.map((m, idx) => (
                        <span
                          key={idx}
                          className="font-mono-label px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] font-semibold"
                        >
                          {m}
                        </span>
                      ))}

                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="font-mono-label inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F0FDFA] text-[#0F766E] border border-[#CCFBF1]"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>

                    {isPromoting && (
                      <form
                        onSubmit={(e) => handlePromoteSubmit(e, entry.id)}
                        className="mt-2 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] p-3.5 space-y-2.5"
                      >
                        <div className="text-xs font-extrabold text-[#92400E]">
                          Add this role to your Base Resume
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            required
                            value={promoteCompany}
                            onChange={(e) => setPromoteCompany(e.target.value)}
                            placeholder="Company *"
                            className="ph-input px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={promoteRole}
                            onChange={(e) => setPromoteRole(e.target.value)}
                            placeholder="Role / Title"
                            className="ph-input px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={promoteStart}
                            onChange={(e) => setPromoteStart(e.target.value)}
                            placeholder="Start Date"
                            className="ph-input px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={promoteEnd}
                            onChange={(e) => setPromoteEnd(e.target.value)}
                            placeholder="End Date"
                            className="ph-input px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPromotingId(null)}
                            className="ph-btn-secondary px-2.5 py-1 text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={promotingBusy}
                            className="ph-btn-primary px-3 py-1 text-xs disabled:opacity-50"
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
