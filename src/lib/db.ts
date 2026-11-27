import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import {
  EMPTY_RESUME_DATA,
  PoolEntry,
  ResumeData,
  ResumeDataSchema,
  ResumeVersion,
  SettingsStatus,
  TailoringAnalysis,
  TailoringAnalysisSchema,
  formatRoleLabel,
} from "@/types/resume";

export const FIXED_GEMINI_MODEL = "gemini-4-neon";
export const FIXED_THINKING_LEVEL = "high";
export const DEFAULT_USER_ID = "local-user";

interface GlobalWithDb {
  __resumeUpdaterDb?: {
    path: string;
    instance: DatabaseSync;
  };
}

const globalForDb = globalThis as unknown as GlobalWithDb;

export function getDbPath(): string {
  return (
    process.env.RESUME_UPDATER_DB_PATH ||
    path.join(process.cwd(), "data", "resume-updater.db")
  );
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return rows.some((r) => r.name === column);
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS base_resume (
      user_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      raw_source TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pool_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'local-user',
      raw_text TEXT NOT NULL,
      company_hint TEXT,
      role_hint TEXT,
      occurred_at TEXT,
      tags_json TEXT NOT NULL,
      matched_role TEXT,
      is_new_role INTEGER NOT NULL DEFAULT 0,
      suggested_company TEXT,
      suggested_role TEXT,
      metrics_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resume_versions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'local-user',
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      job_url TEXT,
      job_description TEXT,
      data_json TEXT NOT NULL,
      used_pool_ids_json TEXT NOT NULL,
      analysis_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      action TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      thought_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Non-destructive migration for pre-multi-user local DBs
  if (!hasColumn(db, "base_resume", "user_id")) {
    db.exec(`
      ALTER TABLE base_resume RENAME TO base_resume_legacy;
      CREATE TABLE base_resume (
        user_id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        raw_source TEXT,
        updated_at TEXT NOT NULL
      );
      INSERT INTO base_resume (user_id, data_json, raw_source, updated_at)
      SELECT 'local-user', data_json, raw_source, updated_at FROM base_resume_legacy;
      DROP TABLE base_resume_legacy;
    `);
  }

  if (!hasColumn(db, "pool_entries", "user_id")) {
    db.exec(
      `ALTER TABLE pool_entries ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local-user';`
    );
  }

  if (!hasColumn(db, "resume_versions", "user_id")) {
    db.exec(
      `ALTER TABLE resume_versions ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local-user';`
    );
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pool_user_created ON pool_entries (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_versions_user_updated ON resume_versions (user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_usage_created ON ai_usage_log (created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_user_action ON ai_usage_log (user_id, action, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_ip_action ON ai_usage_log (ip_hash, action, created_at);
  `);
}

export function getDb(): DatabaseSync {
  const dbPath = getDbPath();
  if (globalForDb.__resumeUpdaterDb && globalForDb.__resumeUpdaterDb.path === dbPath) {
    return globalForDb.__resumeUpdaterDb.instance;
  }

  if (globalForDb.__resumeUpdaterDb) {
    try {
      globalForDb.__resumeUpdaterDb.instance.close();
    } catch {
      // ignore close error on path swap
    }
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  initSchema(db);
  globalForDb.__resumeUpdaterDb = { path: dbPath, instance: db };
  return db;
}

export function resetDbForTests(): void {
  if (globalForDb.__resumeUpdaterDb) {
    try {
      globalForDb.__resumeUpdaterDb.instance.close();
    } catch {
      // ignore
    }
    globalForDb.__resumeUpdaterDb = undefined;
  }
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// --- Settings ---

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string | null): void {
  const db = getDb();
  if (value === null || value.trim() === "") {
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
    return;
  }
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value.trim());
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function getSettingsStatus(
  opts?: {
    publicMode?: boolean;
    authRequired?: boolean;
    user?: SettingsStatus["user"];
    quotas?: SettingsStatus["quotas"];
  }
): SettingsStatus {
  const publicMode =
    opts?.publicMode ??
    (process.env.PUBLIC_MODE === "true" || process.env.NODE_ENV === "production");
  const storedKey = publicMode ? null : getSetting("gemini_api_key");
  const envKey = process.env.GEMINI_API_KEY?.trim() || "";

  const activeKey = storedKey || envKey;
  const keySource: SettingsStatus["keySource"] = storedKey
    ? "settings"
    : envKey
      ? "env"
      : "none";

  return {
    hasApiKey: Boolean(activeKey),
    keySource,
    maskedKey: publicMode ? "" : activeKey ? maskApiKey(activeKey) : "",
    model: FIXED_GEMINI_MODEL,
    thinkingLevel: FIXED_THINKING_LEVEL,
    publicMode,
    authRequired: opts?.authRequired ?? publicMode,
    user: opts?.user ?? null,
    quotas: opts?.quotas ?? null,
  };
}

// --- Base Resume ---

export interface BaseResumeRecord {
  data: ResumeData;
  rawSource: string;
  updatedAt: string | null;
}

export function getBaseResume(userId = DEFAULT_USER_ID): BaseResumeRecord {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT data_json, raw_source, updated_at FROM base_resume WHERE user_id = ?"
    )
    .get(userId) as
    | { data_json: string; raw_source: string | null; updated_at: string }
    | undefined;

  if (!row) {
    return {
      data: structuredClone(EMPTY_RESUME_DATA),
      rawSource: "",
      updatedAt: null,
    };
  }

  const parsed = ResumeDataSchema.safeParse(
    safeJsonParse(row.data_json, EMPTY_RESUME_DATA)
  );
  return {
    data: parsed.success ? parsed.data : structuredClone(EMPTY_RESUME_DATA),
    rawSource: row.raw_source ?? "",
    updatedAt: row.updated_at,
  };
}

export function saveBaseResume(
  data: ResumeData,
  rawSource?: string,
  userId = DEFAULT_USER_ID
): BaseResumeRecord {
  const db = getDb();
  const existing = getBaseResume(userId);
  const normalized = ResumeDataSchema.parse(data);
  const now = new Date().toISOString();
  const sourceToStore = rawSource !== undefined ? rawSource : existing.rawSource;

  db.prepare(
    `INSERT INTO base_resume (user_id, data_json, raw_source, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       data_json = excluded.data_json,
       raw_source = excluded.raw_source,
       updated_at = excluded.updated_at`
  ).run(userId, JSON.stringify(normalized), sourceToStore, now);

  return {
    data: normalized,
    rawSource: sourceToStore,
    updatedAt: now,
  };
}

export function addRoleToBaseResume(
  input: {
    company: string;
    role: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    bullets?: string[];
    poolEntryId?: string;
  },
  userId = DEFAULT_USER_ID
): BaseResumeRecord {
  const current = getBaseResume(userId);
  const company = input.company.trim();
  const role = input.role.trim();

  const alreadyExists = current.data.experience.some(
    (exp) =>
      exp.company.trim().toLowerCase() === company.toLowerCase() &&
      exp.role.trim().toLowerCase() === role.toLowerCase()
  );

  const nextExperience = alreadyExists
    ? current.data.experience
    : [
        {
          id: crypto.randomUUID(),
          company,
          role,
          location: input.location?.trim() || "",
          startDate: input.startDate?.trim() || "",
          endDate: input.endDate?.trim() || "Present",
          bullets: (input.bullets ?? []).map((b) => b.trim()).filter(Boolean),
        },
        ...current.data.experience,
      ];

  const saved = saveBaseResume(
    {
      ...current.data,
      experience: nextExperience,
    },
    undefined,
    userId
  );

  if (input.poolEntryId) {
    const label = formatRoleLabel({ company, role });
    updatePoolEntry(
      input.poolEntryId,
      {
        isNewRole: false,
        matchedRole: label,
        companyHint: company,
        roleHint: role,
      },
      userId
    );
  }

  return saved;
}

// --- Pool Entries ---

interface PoolRow {
  id: string;
  user_id: string;
  raw_text: string;
  company_hint: string | null;
  role_hint: string | null;
  occurred_at: string | null;
  tags_json: string;
  matched_role: string | null;
  is_new_role: number;
  suggested_company: string | null;
  suggested_role: string | null;
  metrics_json: string;
  created_at: string;
}

function rowToPoolEntry(row: PoolRow): PoolEntry {
  return {
    id: row.id,
    rawText: row.raw_text,
    companyHint: row.company_hint ?? "",
    roleHint: row.role_hint ?? "",
    occurredAt: row.occurred_at ?? "",
    tags: safeJsonParse<string[]>(row.tags_json, []),
    matchedRole: row.matched_role ?? "",
    isNewRole: Boolean(row.is_new_role),
    suggestedCompany: row.suggested_company ?? "",
    suggestedRole: row.suggested_role ?? "",
    metrics: safeJsonParse<string[]>(row.metrics_json, []),
    createdAt: row.created_at,
  };
}

export function listPoolEntries(userId = DEFAULT_USER_ID): PoolEntry[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM pool_entries WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as unknown as PoolRow[];
  return rows.map(rowToPoolEntry);
}

export function getPoolEntry(
  id: string,
  userId = DEFAULT_USER_ID
): PoolEntry | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM pool_entries WHERE id = ? AND user_id = ?")
    .get(id, userId) as PoolRow | undefined;
  return row ? rowToPoolEntry(row) : null;
}

export interface CreatePoolEntryInput {
  rawText: string;
  companyHint?: string;
  roleHint?: string;
  occurredAt?: string;
  tags?: string[];
  matchedRole?: string;
  isNewRole?: boolean;
  suggestedCompany?: string;
  suggestedRole?: string;
  metrics?: string[];
}

export function createPoolEntry(
  input: CreatePoolEntryInput,
  userId = DEFAULT_USER_ID
): PoolEntry {
  const db = getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const entry: PoolEntry = {
    id,
    rawText: input.rawText.trim(),
    companyHint: input.companyHint?.trim() ?? "",
    roleHint: input.roleHint?.trim() ?? "",
    occurredAt: input.occurredAt?.trim() ?? "",
    tags: input.tags ?? [],
    matchedRole: input.matchedRole?.trim() ?? "",
    isNewRole: Boolean(input.isNewRole),
    suggestedCompany: input.suggestedCompany?.trim() ?? "",
    suggestedRole: input.suggestedRole?.trim() ?? "",
    metrics: input.metrics ?? [],
    createdAt,
  };

  db.prepare(
    `INSERT INTO pool_entries (
      id, user_id, raw_text, company_hint, role_hint, occurred_at,
      tags_json, matched_role, is_new_role, suggested_company, suggested_role,
      metrics_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.id,
    userId,
    entry.rawText,
    entry.companyHint,
    entry.roleHint,
    entry.occurredAt,
    JSON.stringify(entry.tags),
    entry.matchedRole,
    entry.isNewRole ? 1 : 0,
    entry.suggestedCompany,
    entry.suggestedRole,
    JSON.stringify(entry.metrics),
    entry.createdAt
  );

  return entry;
}

export type UpdatePoolEntryInput = Partial<CreatePoolEntryInput>;

export function updatePoolEntry(
  id: string,
  patch: UpdatePoolEntryInput,
  userId = DEFAULT_USER_ID
): PoolEntry | null {
  const existing = getPoolEntry(id, userId);
  if (!existing) return null;

  const updated: PoolEntry = {
    ...existing,
    rawText: patch.rawText !== undefined ? patch.rawText.trim() : existing.rawText,
    companyHint:
      patch.companyHint !== undefined ? patch.companyHint.trim() : existing.companyHint,
    roleHint: patch.roleHint !== undefined ? patch.roleHint.trim() : existing.roleHint,
    occurredAt:
      patch.occurredAt !== undefined ? patch.occurredAt.trim() : existing.occurredAt,
    tags: patch.tags !== undefined ? patch.tags : existing.tags,
    matchedRole:
      patch.matchedRole !== undefined ? patch.matchedRole.trim() : existing.matchedRole,
    isNewRole: patch.isNewRole !== undefined ? patch.isNewRole : existing.isNewRole,
    suggestedCompany:
      patch.suggestedCompany !== undefined
        ? patch.suggestedCompany.trim()
        : existing.suggestedCompany,
    suggestedRole:
      patch.suggestedRole !== undefined
        ? patch.suggestedRole.trim()
        : existing.suggestedRole,
    metrics: patch.metrics !== undefined ? patch.metrics : existing.metrics,
  };

  const db = getDb();
  db.prepare(
    `UPDATE pool_entries SET
      raw_text = ?,
      company_hint = ?,
      role_hint = ?,
      occurred_at = ?,
      tags_json = ?,
      matched_role = ?,
      is_new_role = ?,
      suggested_company = ?,
      suggested_role = ?,
      metrics_json = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    updated.rawText,
    updated.companyHint,
    updated.roleHint,
    updated.occurredAt,
    JSON.stringify(updated.tags),
    updated.matchedRole,
    updated.isNewRole ? 1 : 0,
    updated.suggestedCompany,
    updated.suggestedRole,
    JSON.stringify(updated.metrics),
    id,
    userId
  );

  return updated;
}

export function deletePoolEntry(id: string, userId = DEFAULT_USER_ID): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM pool_entries WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return Number(result.changes) > 0;
}

// --- Resume Versions ---

interface VersionRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  job_url: string | null;
  job_description: string | null;
  data_json: string;
  used_pool_ids_json: string;
  analysis_json: string | null;
  created_at: string;
  updated_at: string;
}

function rowToVersion(row: VersionRow): ResumeVersion {
  const parsedData = ResumeDataSchema.safeParse(
    safeJsonParse(row.data_json, EMPTY_RESUME_DATA)
  );
  const parsedAnalysis = row.analysis_json
    ? TailoringAnalysisSchema.safeParse(safeJsonParse(row.analysis_json, null))
    : null;

  return {
    id: row.id,
    kind: row.kind === "tailored" ? "tailored" : "master",
    title: row.title,
    jobUrl: row.job_url ?? "",
    jobDescription: row.job_description ?? "",
    data: parsedData.success ? parsedData.data : structuredClone(EMPTY_RESUME_DATA),
    usedPoolIds: safeJsonParse<string[]>(row.used_pool_ids_json, []),
    analysis: parsedAnalysis && parsedAnalysis.success ? parsedAnalysis.data : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listResumeVersions(userId = DEFAULT_USER_ID): ResumeVersion[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM resume_versions WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as unknown as VersionRow[];
  return rows.map(rowToVersion);
}

export function getLatestMasterResume(
  userId = DEFAULT_USER_ID
): ResumeVersion | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM resume_versions WHERE user_id = ? AND kind = 'master' ORDER BY updated_at DESC LIMIT 1"
    )
    .get(userId) as VersionRow | undefined;
  return row ? rowToVersion(row) : null;
}

export function getResumeVersion(
  id: string,
  userId = DEFAULT_USER_ID
): ResumeVersion | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?")
    .get(id, userId) as VersionRow | undefined;
  return row ? rowToVersion(row) : null;
}

export interface CreateResumeVersionInput {
  kind: "master" | "tailored";
  title: string;
  jobUrl?: string;
  jobDescription?: string;
  data: ResumeData;
  usedPoolIds?: string[];
  analysis?: TailoringAnalysis | null;
}

export function createResumeVersion(
  input: CreateResumeVersionInput,
  userId = DEFAULT_USER_ID
): ResumeVersion {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const normalizedData = ResumeDataSchema.parse(input.data);
  const version: ResumeVersion = {
    id,
    kind: input.kind,
    title:
      input.title.trim() ||
      (input.kind === "master" ? "Master Resume" : "Tailored Resume"),
    jobUrl: input.jobUrl?.trim() ?? "",
    jobDescription: input.jobDescription?.trim() ?? "",
    data: normalizedData,
    usedPoolIds: input.usedPoolIds ?? [],
    analysis: input.analysis ?? null,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO resume_versions (
      id, user_id, kind, title, job_url, job_description, data_json,
      used_pool_ids_json, analysis_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    version.id,
    userId,
    version.kind,
    version.title,
    version.jobUrl,
    version.jobDescription,
    JSON.stringify(version.data),
    JSON.stringify(version.usedPoolIds),
    version.analysis ? JSON.stringify(version.analysis) : null,
    version.createdAt,
    version.updatedAt
  );

  return version;
}

export function updateResumeVersion(
  id: string,
  patch: { title?: string; data?: ResumeData; analysis?: TailoringAnalysis | null },
  userId = DEFAULT_USER_ID
): ResumeVersion | null {
  const existing = getResumeVersion(id, userId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updatedTitle = patch.title !== undefined ? patch.title.trim() : existing.title;
  const updatedData =
    patch.data !== undefined ? ResumeDataSchema.parse(patch.data) : existing.data;
  const updatedAnalysis =
    patch.analysis !== undefined
      ? patch.analysis
        ? TailoringAnalysisSchema.parse(patch.analysis)
        : null
      : existing.analysis;

  const db = getDb();
  db.prepare(
    "UPDATE resume_versions SET title = ?, data_json = ?, analysis_json = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  ).run(
    updatedTitle,
    JSON.stringify(updatedData),
    updatedAnalysis ? JSON.stringify(updatedAnalysis) : null,
    now,
    id,
    userId
  );

  return {
    ...existing,
    title: updatedTitle,
    data: updatedData,
    analysis: updatedAnalysis,
    updatedAt: now,
  };
}

export function deleteResumeVersion(
  id: string,
  userId = DEFAULT_USER_ID
): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM resume_versions WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return Number(result.changes) > 0;
}

// --- AI Usage & Cost Ledger ---

export interface AiUsageRecordInput {
  userId: string;
  ipHash: string;
  action: string;
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export function recordAiUsage(input: AiUsageRecordInput): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO ai_usage_log (
      id, user_id, ip_hash, action,
      prompt_tokens, output_tokens, thought_tokens, total_tokens,
      estimated_cost_usd, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    input.userId,
    input.ipHash,
    input.action,
    input.promptTokens,
    input.outputTokens,
    input.thoughtTokens,
    input.totalTokens,
    input.estimatedCostUsd,
    new Date().toISOString()
  );
}

function startOfUtcDayIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

function startOfUtcMonthIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
}

export function getUserDailyActionCount(userId: string, action: string): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM ai_usage_log WHERE user_id = ? AND action = ? AND created_at >= ?"
    )
    .get(userId, action, startOfUtcDayIso()) as { cnt: number };
  return Number(row?.cnt ?? 0);
}

export function getIpDailyActionCount(ipHash: string, action: string): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM ai_usage_log WHERE ip_hash = ? AND action = ? AND created_at >= ?"
    )
    .get(ipHash, action, startOfUtcDayIso()) as { cnt: number };
  return Number(row?.cnt ?? 0);
}

export function getGlobalDailySpendUsd(): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total FROM ai_usage_log WHERE created_at >= ?"
    )
    .get(startOfUtcDayIso()) as { total: number };
  return Number(row?.total ?? 0);
}

export function getGlobalMonthlySpendUsd(): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total FROM ai_usage_log WHERE created_at >= ?"
    )
    .get(startOfUtcMonthIso()) as { total: number };
  return Number(row?.total ?? 0);
}
