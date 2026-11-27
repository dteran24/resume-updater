"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Layers,
  Sparkles,
  History,
  Settings,
  KeyRound,
  X,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { BrandMascot, WindowChromeBar } from "@/components/Doodles";
import type { SettingsStatus } from "@/types/resume";

const NAV_ITEMS = [
  { href: "/", label: "Base Resume", sub: "foundation", icon: FileText },
  { href: "/pool", label: "Work Pool", sub: "win log", icon: Layers },
  { href: "/studio", label: "Studio", sub: "tailor", icon: Sparkles },
  { href: "/versions", label: "Versions", sub: "archive", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<SettingsStatus | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = (await res.json()) as SettingsStatus;
      setSettings(data);
    } catch {
      // ignore initial fetch error
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage("");
    setErrorMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKeyInput.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save settings");
      }
      setSettings(json as SettingsStatus);
      setApiKeyInput("");
      setSaveMessage("Saved to local SQLite.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearKey() {
    setSaving(true);
    setSaveMessage("");
    setErrorMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearApiKey: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to clear API key");
      setSettings(json as SettingsStatus);
      setSaveMessage("Stored API key removed.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error clearing key");
    } finally {
      setSaving(false);
    }
  }

  const needsSignIn = Boolean(settings?.authRequired && !settings?.user);

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-[#111827]">
      <aside className="no-print w-full md:w-64 md:min-h-screen bg-white border-b md:border-b-0 md:border-r border-[#E4E4E7] flex flex-col shrink-0">
        {/* Brand Masthead */}
        <div className="px-4 py-4 border-b border-[#E4E4E7]">
          <Link href="/" className="flex items-center gap-3 group">
            <BrandMascot className="w-10 h-10 shrink-0 transition-transform group-hover:-rotate-3" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold tracking-tight text-[#111827] leading-none">
                  ReadyCV
                </h1>
                <span className="font-mono-label text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#CCFBF1] border border-[#99F6E4] text-[#0F766E]">
                  {settings?.publicMode ? "PUBLIC" : "LOCAL"}
                </span>
              </div>
              <p className="font-mono-label text-[11px] text-[#6B7280] mt-1 truncate">
                always ready to apply
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex md:flex-col gap-1 p-3 overflow-x-auto flex-1">
          <div className="hidden md:block px-2.5 pb-1 font-mono-label text-[10px] uppercase tracking-wider text-[#6B7280]">
            Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap border ${
                  active
                    ? "bg-[#F0FDFA] border-[#0D9488] text-[#111827] font-bold shadow-xs"
                    : "border-transparent text-[#4B5563] font-medium hover:bg-[#F4F4F5] hover:text-[#111827]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? "text-[#0D9488]" : "text-[#6B7280]"
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                <span
                  className={`hidden md:inline font-mono-label text-[10px] ${
                    active ? "text-[#0F766E]" : "text-[#9CA3AF]"
                  }`}
                >
                  {item.sub}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Status / Account / Settings */}
        <div className="p-3 border-t border-[#E4E4E7] bg-[#FAFAFA] space-y-2">
          {settings?.user && !settings.user.isLocalFallback && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#E4E4E7]">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#111827] truncate">
                  {settings.user.name}
                </div>
                {settings.user.email && (
                  <div className="font-mono-label text-[10px] text-[#6B7280] truncate">
                    {settings.user.email}
                  </div>
                )}
              </div>
              <a
                href="/api/auth/signout"
                className="p-1.5 rounded text-[#6B7280] hover:text-[#111827] hover:bg-[#F4F4F5]"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSaveMessage("");
              setErrorMessage("");
              loadSettings();
              setModalOpen(true);
            }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-white border border-[#D4D4D8] hover:border-[#18181B] text-left transition-colors shadow-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Settings className="w-4 h-4 text-[#111827] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#111827]">
                  {settings?.publicMode ? "AI Quota & Status" : "AI Settings"}
                </div>
                <div className="font-mono-label text-[10px] text-[#6B7280] truncate">
                  {settings?.hasApiKey
                    ? `${settings.model} · ${settings.thinkingLevel}`
                    : "needs gemini key"}
                </div>
              </div>
            </div>
            <span
              className={`font-mono-label text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                settings?.quotas?.globalBudgetPaused
                  ? "bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]"
                  : settings?.hasApiKey
                    ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]"
                    : "bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]"
              }`}
            >
              {settings?.quotas?.globalBudgetPaused
                ? "PAUSED"
                : settings?.hasApiKey
                  ? "ON"
                  : "OFF"}
            </span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 print-container">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 print-container">
          {needsSignIn ? (
            <div className="max-w-md mx-auto mt-16 ph-card overflow-hidden">
              <WindowChromeBar filename="auth-gate · sign in" />
              <div className="p-6 text-center space-y-4">
                <BrandMascot className="w-14 h-14 mx-auto" />
                <div>
                  <h2 className="text-xl font-extrabold text-[#111827]">
                    Sign in to ReadyCV
                  </h2>
                  <p className="text-sm text-[#4B5563] mt-1">
                    Keep your resume, work data pool, and tailored versions private to your account.
                  </p>
                </div>
                <a
                  href="/api/auth/signin"
                  className="ph-btn-primary inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in with Google
                </a>
                <p className="font-mono-label text-[11px] text-[#6B7280] flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0D9488]" />
                  Private per-account workspace & fair daily AI quotas
                </p>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {modalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 p-4 backdrop-blur-[1px]">
          <div className="ph-card w-full max-w-md overflow-hidden">
            <WindowChromeBar
              filename={
                settings?.publicMode ? "ai-quotas.status" : "settings.local.json"
              }
              rightSlot={
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-0.5 rounded text-[#6B7280] hover:text-[#111827]"
                  aria-label="Close settings"
                >
                  <X className="w-4 h-4" />
                </button>
              }
            />

            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0D9488]" />
                <h2 className="text-base font-extrabold text-[#111827]">
                  {settings?.publicMode ? "AI Status & Daily Quotas" : "Gemini AI Configuration"}
                </h2>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#F0FDFA] border border-[#CCFBF1] px-3 py-2 text-xs">
                <span className="font-bold text-[#0F766E]">Engine</span>
                <span className="font-mono-label text-[#0F766E]">
                  {settings?.model ?? "gemini-4-neon"} · thinking:{" "}
                  {settings?.thinkingLevel ?? "high"}
                </span>
              </div>

              {settings?.quotas && (
                <div className="rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] p-3 space-y-2 text-xs">
                  <div className="font-bold text-[#111827]">
                    Your Daily AI Quotas (resets midnight UTC)
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono-label text-[11px] text-[#4B5563]">
                    <div>
                      Imports: {settings.quotas.dailyLimits.import.used}/
                      {settings.quotas.dailyLimits.import.limit}
                    </div>
                    <div>
                      Auto-tags: {settings.quotas.dailyLimits.poolTag.used}/
                      {settings.quotas.dailyLimits.poolTag.limit}
                    </div>
                    <div>
                      Master builds: {settings.quotas.dailyLimits.generate.used}/
                      {settings.quotas.dailyLimits.generate.limit}
                    </div>
                    <div>
                      Job tailors: {settings.quotas.dailyLimits.tailor.used}/
                      {settings.quotas.dailyLimits.tailor.limit}
                    </div>
                  </div>
                  {settings.quotas.globalBudgetPaused && (
                    <p className="text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded px-2.5 py-1.5">
                      App AI budget is temporarily paused for this period. Manual editing and PDF/Markdown export remain available.
                    </p>
                  )}
                </div>
              )}

              {!settings?.publicMode && (
                <>
                  <div className="rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] p-3 text-xs text-[#4B5563] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#111827]">
                      {settings?.hasApiKey ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                          <span>
                            Key active ({settings.maskedKey} via {settings.keySource})
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-[#D97706]" />
                          <span>No Gemini API key set yet</span>
                        </>
                      )}
                    </div>
                    <p>
                      Stored locally in{" "}
                      <code className="font-mono-label bg-white px-1 rounded border border-[#E4E4E7]">
                        data/resume-updater.db
                      </code>
                      , or set{" "}
                      <code className="font-mono-label bg-white px-1 rounded border border-[#E4E4E7]">
                        GEMINI_API_KEY
                      </code>{" "}
                      in{" "}
                      <code className="font-mono-label bg-white px-1 rounded border border-[#E4E4E7]">
                        .env.local
                      </code>
                      .
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#111827] mb-1">
                      {settings?.hasApiKey ? "Replace Gemini API Key" : "Gemini API Key"}
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AIza..."
                      className="ph-input px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              {saveMessage && (
                <p className="text-xs font-medium text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] rounded-md px-3 py-2">
                  {saveMessage}
                </p>
              )}
              {errorMessage && (
                <p className="text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2">
                  {errorMessage}
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                {!settings?.publicMode && settings?.keySource === "settings" ? (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    disabled={saving}
                    className="text-xs text-[#DC2626] hover:underline font-semibold"
                  >
                    Remove stored key
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="ph-btn-secondary px-3 py-2 text-xs"
                  >
                    Close
                  </button>
                  {!settings?.publicMode && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="ph-btn-primary px-4 py-2 text-xs disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Settings"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
