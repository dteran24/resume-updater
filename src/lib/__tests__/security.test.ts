import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GuardError,
  acquireAiGuard,
  estimateNeonCostUsd,
  logCompletedAiAction,
} from "@/lib/ai-guard";
import {
  createPoolEntry,
  createResumeVersion,
  deletePoolEntry,
  deleteResumeVersion,
  getBaseResume,
  getResumeVersion,
  listPoolEntries,
  listResumeVersions,
  resetDbForTests,
  saveBaseResume,
} from "@/lib/db";
import {
  assertSafePublicUrl,
  isPrivateOrReservedIp,
  isSafeHttpUrl,
} from "@/lib/job-fetcher";
import { EMPTY_RESUME_DATA } from "@/types/resume";

describe("Security hardening", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "readycv-sec-test-"));
    process.env.RESUME_UPDATER_DB_PATH = path.join(tempDir, "sec.db");
    delete process.env.MONTHLY_GLOBAL_BUDGET_USD;
    delete process.env.DAILY_GLOBAL_BUDGET_USD;
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    delete process.env.RESUME_UPDATER_DB_PATH;
    delete process.env.MONTHLY_GLOBAL_BUDGET_USD;
    delete process.env.DAILY_GLOBAL_BUDGET_USD;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("blocks private, loopback, link-local, and metadata IPs (SSRF)", async () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.10",
      "169.254.169.254",
      "0.0.0.0",
      "::1",
      "::ffff:127.0.0.1",
      "fe80::1",
      "fc00::1",
    ]) {
      expect(isPrivateOrReservedIp(ip)).toBe(true);
    }

    expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false);

    for (const badUrl of [
      "http://127.0.0.1:3000/api/settings",
      "http://localhost:3000",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.5/internal",
      "file:///etc/passwd",
      "javascript:alert(1)",
    ]) {
      await expect(assertSafePublicUrl(badUrl)).rejects.toThrow();
    }
  });

  it("rejects non-http(s) URLs to prevent stored XSS", () => {
    expect(isSafeHttpUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("isolates base resumes, pool entries, and saved versions per user", () => {
    saveBaseResume(
      {
        ...EMPTY_RESUME_DATA,
        basics: { ...EMPTY_RESUME_DATA.basics, name: "Alice" },
      },
      "alice raw",
      "user-alice"
    );
    saveBaseResume(
      {
        ...EMPTY_RESUME_DATA,
        basics: { ...EMPTY_RESUME_DATA.basics, name: "Bob" },
      },
      "bob raw",
      "user-bob"
    );

    expect(getBaseResume("user-alice").data.basics.name).toBe("Alice");
    expect(getBaseResume("user-bob").data.basics.name).toBe("Bob");

    const alicePool = createPoolEntry({ rawText: "Alice win" }, "user-alice");
    expect(listPoolEntries("user-alice")).toHaveLength(1);
    expect(listPoolEntries("user-bob")).toHaveLength(0);
    expect(deletePoolEntry(alicePool.id, "user-bob")).toBe(false);

    const aliceVersion = createResumeVersion(
      { kind: "master", title: "Alice Master", data: EMPTY_RESUME_DATA },
      "user-alice"
    );
    expect(listResumeVersions("user-bob")).toHaveLength(0);
    expect(getResumeVersion(aliceVersion.id, "user-bob")).toBeNull();
    expect(deleteResumeVersion(aliceVersion.id, "user-bob")).toBe(false);
  });

  it("enforces per-user quotas, concurrency lock, and USD daily/monthly circuit breakers", () => {
    // 1M input ($3) + 1M output+thinking ($15) = $18
    expect(
      estimateNeonCostUsd({
        promptTokens: 1_000_000,
        outputTokens: 500_000,
        thoughtTokens: 500_000,
      })
    ).toBe(18);

    // Concurrency lock blocks parallel requests for the same user
    const releaseFirst = acquireAiGuard("u1", "ip1", "generate");
    expect(() => acquireAiGuard("u1", "ip1", "generate")).toThrow(GuardError);
    releaseFirst();

    // Daily per-user limit (2/day for generate)
    for (let i = 0; i < 2; i++) {
      const rel = acquireAiGuard("u1", "ip1", "generate");
      logCompletedAiAction("u1", "ip1", "generate", {
        promptTokens: 1000,
        outputTokens: 500,
        thoughtTokens: 500,
        totalTokens: 2000,
      });
      rel();
    }
    try {
      acquireAiGuard("u1", "ip1", "generate");
      expect.unreachable("Should have hit 429 daily user limit");
    } catch (err) {
      expect(err).toBeInstanceOf(GuardError);
      expect((err as GuardError).status).toBe(429);
    }

    // Global daily/monthly USD circuit breaker ($0.50/day, $4.50/month)
    process.env.DAILY_GLOBAL_BUDGET_USD = "0.20";
    logCompletedAiAction("u2", "ip2", "tailor", {
      promptTokens: 10_000,
      outputTokens: 5_000,
      thoughtTokens: 5_000,
      totalTokens: 20_000,
    }); // ~$0.18 -> next generate reservation ($0.12) exceeds $0.20
    try {
      acquireAiGuard("u3", "ip3", "generate");
      expect.unreachable("Should have hit 503 global budget circuit breaker");
    } catch (err) {
      expect(err).toBeInstanceOf(GuardError);
      expect((err as GuardError).status).toBe(503);
    }
  });
});
