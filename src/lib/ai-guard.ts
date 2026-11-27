import crypto from "crypto";
import {
  getGlobalDailySpendUsd,
  getGlobalMonthlySpendUsd,
  getIpDailyActionCount,
  getUserDailyActionCount,
  recordAiUsage,
} from "@/lib/db";
import type { QuotaSummary } from "@/types/resume";

// Official gemini-4-neon standard pricing (USD per 1M tokens)
export const NEON_INPUT_USD_PER_M = 3.0;
export const NEON_OUTPUT_USD_PER_M = 15.0; // Output + thinking tokens

export type AiAction = "import" | "pool-tag" | "generate" | "tailor" | "job-fetch";

// Default budgets padded well below the $10/month credit ($4.50/month, $0.50/day)
export function getMonthlyGlobalBudgetUsd(): number {
  const raw = Number(process.env.MONTHLY_GLOBAL_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 4.5;
}

export function getDailyGlobalBudgetUsd(): number {
  const raw = Number(process.env.DAILY_GLOBAL_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 0.5;
}

// Conservative pre-flight cost reservation (USD) to avoid overshooting caps
const PREFLIGHT_RESERVATION_USD: Record<AiAction, number> = {
  import: 0.05,
  "pool-tag": 0.02,
  generate: 0.12,
  tailor: 0.12,
  "job-fetch": 0,
};

export const DAILY_USER_LIMITS: Record<AiAction, number> = {
  import: 2,
  "pool-tag": 8,
  generate: 2,
  tailor: 3,
  "job-fetch": 15,
};

// Slightly higher IP cap so shared office/home Wi-Fi doesn't block a couple of real users
const DAILY_IP_LIMITS: Record<AiAction, number> = {
  import: 6,
  "pool-tag": 24,
  generate: 6,
  tailor: 9,
  "job-fetch": 30,
};

export interface TokenUsage {
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
}

export function estimateNeonCostUsd(usage: {
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
}): number {
  const inputCost = (Math.max(0, usage.promptTokens) / 1_000_000) * NEON_INPUT_USD_PER_M;
  const outputCost =
    ((Math.max(0, usage.outputTokens) + Math.max(0, usage.thoughtTokens)) / 1_000_000) *
    NEON_OUTPUT_USD_PER_M;
  return Number((inputCost + outputCost).toFixed(6));
}

export function hashClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const rawIp = (forwarded?.split(",")[0] || realIp || "local").trim();
  const salt = process.env.AUTH_SECRET || "readycv-ip-salt";
  return crypto.createHash("sha256").update(`${salt}:${rawIp}`).digest("hex").slice(0, 24);
}

export class GuardError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GuardError";
    this.status = status;
  }
}

// Per-user in-flight concurrency lock (prevents parallel burst attacks)
const activeUserRequests = new Set<string>();

export function acquireAiGuard(
  userId: string,
  ipHash: string,
  action: AiAction
): () => void {
  if (action !== "job-fetch") {
    const monthlyBudget = getMonthlyGlobalBudgetUsd();
    const dailyBudget = getDailyGlobalBudgetUsd();
    const reservation = PREFLIGHT_RESERVATION_USD[action];

    const monthlySpend = getGlobalMonthlySpendUsd();
    if (monthlySpend + reservation > monthlyBudget) {
      throw new GuardError(
        "Monthly AI budget has been reached for this app. You can still edit and export your resumes manually.",
        503
      );
    }

    const dailySpend = getGlobalDailySpendUsd();
    if (dailySpend + reservation > dailyBudget) {
      throw new GuardError(
        "Daily AI budget has been reached. Please try again tomorrow — manual editing and PDF/Markdown export still work.",
        503
      );
    }
  }

  const userLimit = DAILY_USER_LIMITS[action];
  const userCount = getUserDailyActionCount(userId, action);
  if (userCount >= userLimit) {
    throw new GuardError(
      `You've reached your daily limit (${userLimit}/day) for this action. Limit resets at midnight UTC.`,
      429
    );
  }

  const ipLimit = DAILY_IP_LIMITS[action];
  const ipCount = getIpDailyActionCount(ipHash, action);
  if (ipCount >= ipLimit) {
    throw new GuardError(
      "Too many requests from this network today. Please try again tomorrow.",
      429
    );
  }

  if (action !== "job-fetch") {
    if (activeUserRequests.has(userId)) {
      throw new GuardError(
        "Another AI request is already running for your account. Please wait for it to finish.",
        429
      );
    }
    activeUserRequests.add(userId);
  }

  let released = false;
  return () => {
    if (!released && action !== "job-fetch") {
      released = true;
      activeUserRequests.delete(userId);
    }
  };
}

export function logCompletedAiAction(
  userId: string,
  ipHash: string,
  action: AiAction,
  usage?: TokenUsage
): void {
  const promptTokens = usage?.promptTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const thoughtTokens = usage?.thoughtTokens ?? 0;
  const totalTokens =
    usage?.totalTokens ?? promptTokens + outputTokens + thoughtTokens;
  const estimatedCostUsd =
    action === "job-fetch"
      ? 0
      : estimateNeonCostUsd({ promptTokens, outputTokens, thoughtTokens });

  recordAiUsage({
    userId,
    ipHash,
    action,
    promptTokens,
    outputTokens,
    thoughtTokens,
    totalTokens,
    estimatedCostUsd,
  });
}

export function isGlobalBudgetPaused(): boolean {
  const monthlySpend = getGlobalMonthlySpendUsd();
  const dailySpend = getGlobalDailySpendUsd();
  return (
    monthlySpend + 0.02 > getMonthlyGlobalBudgetUsd() ||
    dailySpend + 0.02 > getDailyGlobalBudgetUsd()
  );
}

export function getUserQuotaSummary(userId: string): QuotaSummary {
  return {
    dailyLimits: {
      import: {
        used: getUserDailyActionCount(userId, "import"),
        limit: DAILY_USER_LIMITS.import,
      },
      poolTag: {
        used: getUserDailyActionCount(userId, "pool-tag"),
        limit: DAILY_USER_LIMITS["pool-tag"],
      },
      generate: {
        used: getUserDailyActionCount(userId, "generate"),
        limit: DAILY_USER_LIMITS.generate,
      },
      tailor: {
        used: getUserDailyActionCount(userId, "tailor"),
        limit: DAILY_USER_LIMITS.tailor,
      },
    },
    globalBudgetPaused: isGlobalBudgetPaused(),
  };
}
