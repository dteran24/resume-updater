import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addRoleToBaseResume,
  createPoolEntry,
  createResumeVersion,
  deletePoolEntry,
  deleteResumeVersion,
  getBaseResume,
  getLatestMasterResume,
  getPoolEntry,
  getResumeVersion,
  getSettingsStatus,
  listPoolEntries,
  listResumeVersions,
  resetDbForTests,
  saveBaseResume,
  setSetting,
  updatePoolEntry,
  updateResumeVersion,
} from "@/lib/db";
import { EMPTY_RESUME_DATA } from "@/types/resume";

describe("SQLite db layer", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-updater-test-"));
    process.env.RESUME_UPDATER_DB_PATH = path.join(tempDir, "test.db");
    delete process.env.GEMINI_API_KEY;
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    delete process.env.RESUME_UPDATER_DB_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("manages settings and masks stored API keys", () => {
    expect(getSettingsStatus().hasApiKey).toBe(false);
    setSetting("gemini_api_key", "AIzaSyTestKey123456");

    const status = getSettingsStatus();
    expect(status.hasApiKey).toBe(true);
    expect(status.keySource).toBe("settings");
    expect(status.maskedKey).toBe("AIza••••3456");
    expect(status.model).toBe("gemini-4-neon");
    expect(status.thinkingLevel).toBe("high");

    setSetting("gemini_api_key", null);
    expect(getSettingsStatus().hasApiKey).toBe(false);
  });

  it("saves base resume and promotes unlisted pool roles", () => {
    const base = saveBaseResume(
      {
        ...EMPTY_RESUME_DATA,
        basics: {
          ...EMPTY_RESUME_DATA.basics,
          name: "Alex Rivera",
          title: "Backend Engineer",
        },
        experience: [
          {
            id: "exp-1",
            company: "OldCo",
            role: "Software Engineer",
            location: "Remote",
            startDate: "2021",
            endDate: "2024",
            bullets: ["Built REST APIs"],
          },
        ],
      },
      "raw text"
    );

    expect(base.data.basics.name).toBe("Alex Rivera");
    expect(getBaseResume().data.experience).toHaveLength(1);

    const poolEntry = createPoolEntry({
      rawText: "Built retry queue at NewCo cutting errors by 50%",
      companyHint: "NewCo",
      roleHint: "Senior Engineer",
      isNewRole: true,
      suggestedCompany: "NewCo",
      suggestedRole: "Senior Engineer",
      tags: ["Go", "Queues"],
      metrics: ["50% fewer errors"],
    });

    const updatedBase = addRoleToBaseResume({
      company: "NewCo",
      role: "Senior Engineer",
      startDate: "2025",
      endDate: "Present",
      poolEntryId: poolEntry.id,
    });

    expect(updatedBase.data.experience).toHaveLength(2);
    expect(updatedBase.data.experience[0].company).toBe("NewCo");

    const refreshedEntry = getPoolEntry(poolEntry.id);
    expect(refreshedEntry?.isNewRole).toBe(false);
    expect(refreshedEntry?.matchedRole).toBe("Senior Engineer @ NewCo");
  });

  it("performs CRUD on pool entries and resume versions", () => {
    const entry = createPoolEntry({
      rawText: "Migrated CI pipeline to GitHub Actions",
      tags: ["CI/CD", "GitHub Actions"],
    });
    expect(listPoolEntries()).toHaveLength(1);

    const patched = updatePoolEntry(entry.id, { occurredAt: "Q3 2026" });
    expect(patched?.occurredAt).toBe("Q3 2026");

    const master = createResumeVersion({
      kind: "master",
      title: "Master Resume",
      data: {
        ...EMPTY_RESUME_DATA,
        basics: { ...EMPTY_RESUME_DATA.basics, name: "Alex Rivera" },
      },
      usedPoolIds: [entry.id],
      analysis: {
        matchedKeywords: [],
        missingKeywords: [],
        tailoringNotes: ["Updated master"],
        suggestedEdits: [],
        coachingSuggestions: [],
        pageTarget: "1-page",
      },
    });
    expect(getLatestMasterResume()?.id).toBe(master.id);

    const version = createResumeVersion({
      kind: "tailored",
      title: "Acme — Platform Engineer",
      jobUrl: "https://example.com/jobs/1",
      jobDescription: "Looking for TypeScript & SQLite experience",
      data: {
        ...EMPTY_RESUME_DATA,
        basics: { ...EMPTY_RESUME_DATA.basics, name: "Alex Rivera" },
      },
      usedPoolIds: [entry.id],
      analysis: {
        matchedKeywords: ["TypeScript"],
        missingKeywords: ["Kubernetes"],
        tailoringNotes: ["Highlighted CI migration"],
        suggestedEdits: [],
        coachingSuggestions: [
          {
            kind: "jd-gap-question",
            targetLabel: "Kubernetes",
            message: "Have you worked with Kubernetes? Log it in Work Pool.",
          },
        ],
        pageTarget: "1-page",
        sourceResumeKind: "master",
      },
    });

    expect(listResumeVersions()).toHaveLength(2);
    expect(getResumeVersion(version.id)?.analysis?.matchedKeywords).toEqual([
      "TypeScript",
    ]);
    expect(
      getResumeVersion(version.id)?.analysis?.coachingSuggestions
    ).toHaveLength(1);

    const updatedVersion = updateResumeVersion(version.id, {
      title: "Acme — Staff Platform Engineer",
    });
    expect(updatedVersion?.title).toBe("Acme — Staff Platform Engineer");

    expect(deleteResumeVersion(version.id)).toBe(true);
    expect(deleteResumeVersion(master.id)).toBe(true);
    expect(listResumeVersions()).toHaveLength(0);

    expect(deletePoolEntry(entry.id)).toBe(true);
    expect(listPoolEntries()).toHaveLength(0);
  });
});
