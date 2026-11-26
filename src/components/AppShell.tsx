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
} from "lucide-react";
import type { SettingsStatus } from "@/types/resume";

const NAV_ITEMS = [
  { href: "/", label: "Base Resume", icon: FileText },
  { href: "/pool", label: "Work Data Pool", icon: Layers },
  { href: "/studio", label: "Studio", icon: Sparkles },
  { href: "/versions", label: "Saved Versions", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<SettingsStatus | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("gemini-2.5-flash");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = (await res.json()) as SettingsStatus;
      setSettings(data);
      setModelInput(data.model || "gemini-2.5-flash");
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
          model: modelInput.trim() || "gemini-2.5-flash",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save settings");
      }
      setSettings(json as SettingsStatus);
      setApiKeyInput("");
      setSaveMessage("Settings saved locally.");
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
        body: JSON.stringify({ clearApiKey: true, model: modelInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to clear API key");
      setSettings(json as SettingsStatus);
      setSaveMessage("Stored API key cleared.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error clearing key");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
      <aside className="no-print w-full md:w-64 md:min-h-screen bg-slate-900 text-slate-100 flex flex-col border-b md:border-b-0 md:border-r border-slate-800 shrink-0">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white shadow-sm">
              R
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-white">
                Resume Updater
              </h1>
              <p className="text-[11px] text-slate-400">Local AI Career Studio</p>
            </div>
          </div>
        </div>

        <nav className="flex md:flex-col gap-1 p-3 overflow-x-auto flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              setSaveMessage("");
              setErrorMessage("");
              setModalOpen(true);
            }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-left transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Settings className="w-4 h-4 text-slate-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-100">AI Settings</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {settings?.hasApiKey
                    ? `${settings.model} (${settings.keySource})`
                    : "Needs Gemini API Key"}
                </div>
              </div>
            </div>
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                settings?.hasApiKey ? "bg-emerald-400" : "bg-amber-400"
              }`}
              title={settings?.hasApiKey ? "Gemini API key configured" : "API key missing"}
            />
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 print-container">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print-container">
          {children}
        </div>
      </main>

      {modalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Gemini AI Settings
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  {settings?.hasApiKey ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        API Key active ({settings.maskedKey} via {settings.keySource})
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>No Gemini API key configured yet</span>
                    </>
                  )}
                </div>
                <p>
                  Keys entered here are saved locally in SQLite (
                  <code>data/resume-updater.db</code>). You can also set{" "}
                  <code>GEMINI_API_KEY</code> in <code>.env.local</code>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {settings?.hasApiKey ? "Replace Gemini API Key" : "Gemini API Key"}
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIza..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Gemini Model
                </label>
                <select
                  value={
                    ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"].includes(
                      modelInput
                    )
                      ? modelInput
                      : "custom"
                  }
                  onChange={(e) => {
                    if (e.target.value !== "custom") setModelInput(e.target.value);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="custom">Custom model name...</option>
                </select>
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  placeholder="gemini-2.5-flash"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {saveMessage && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  {saveMessage}
                </p>
              )}
              {errorMessage && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {errorMessage}
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                {settings?.keySource === "settings" ? (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    disabled={saving}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
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
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
