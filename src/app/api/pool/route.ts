import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/auth";
import {
  GuardError,
  acquireAiGuard,
  hashClientIp,
  logCompletedAiAction,
} from "@/lib/ai-guard";
import { handleApiError } from "@/lib/api-error";
import {
  createPoolEntry,
  getBaseResume,
  getSettingsStatus,
  listPoolEntries,
} from "@/lib/db";
import { autoTagPoolEntryWithAI } from "@/lib/gemini";
import { formatRoleLabel } from "@/types/resume";

export const runtime = "nodejs";

const CreatePoolSchema = z.object({
  rawText: z
    .string()
    .min(1, "Please enter what you worked on.")
    .max(1500, "Work pool note must be 1,500 characters or fewer."),
  companyHint: z.string().max(120).optional().default(""),
  roleHint: z.string().max(120).optional().default(""),
  occurredAt: z.string().max(60).optional().default(""),
  matchedRole: z.string().max(200).optional().default(""),
  isUnlistedRole: z.boolean().optional().default(false),
});

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ entries: listPoolEntries(user.id) });
  } catch (error) {
    return handleApiError(error, "Failed to load work data pool.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ipHash = hashClientIp(request);
    const body = CreatePoolSchema.parse(await request.json());
    const base = getBaseResume(user.id);
    const existingRoles = base.data.experience.map(formatRoleLabel);

    let tags: string[] = [];
    let metrics: string[] = [];
    let matchedRole = body.matchedRole.trim();
    let isNewRole = body.isUnlistedRole;
    let suggestedCompany = body.isUnlistedRole ? body.companyHint.trim() : "";
    let suggestedRole = body.isUnlistedRole ? body.roleHint.trim() : "";
    let aiWarning = "";

    const matchesExistingCompany = (company: string) =>
      Boolean(company) &&
      base.data.experience.some(
        (exp) => exp.company.trim().toLowerCase() === company.trim().toLowerCase()
      );

    if (body.companyHint.trim() && !matchesExistingCompany(body.companyHint)) {
      isNewRole = true;
      suggestedCompany = body.companyHint.trim();
      suggestedRole = body.roleHint.trim();
    }

    const settings = getSettingsStatus();
    if (settings.hasApiKey) {
      let release: (() => void) | null = null;
      try {
        release = acquireAiGuard(user.id, ipHash, "pool-tag");
        const { result: aiResult, usage } = await autoTagPoolEntryWithAI(
          body.rawText,
          existingRoles,
          {
            companyHint: body.companyHint,
            roleHint: body.roleHint,
            occurredAt: body.occurredAt,
          }
        );
        logCompletedAiAction(user.id, ipHash, "pool-tag", usage);

        tags = aiResult.tags;
        metrics = aiResult.metrics;

        if (!matchedRole && aiResult.matchedRole) {
          matchedRole = aiResult.matchedRole;
        }
        if (aiResult.isNewRole && !isNewRole) {
          isNewRole = true;
          suggestedCompany = suggestedCompany || aiResult.suggestedCompany;
          suggestedRole = suggestedRole || aiResult.suggestedRole;
        }
      } catch (err) {
        aiWarning =
          err instanceof GuardError
            ? `Saved without AI auto-tagging: ${err.message}`
            : "Saved without AI auto-tagging.";
      } finally {
        release?.();
      }
    }

    if (isNewRole && !matchedRole && (suggestedCompany || suggestedRole)) {
      matchedRole = formatRoleLabel({
        company: suggestedCompany,
        role: suggestedRole,
      });
    }

    const entry = createPoolEntry(
      {
        rawText: body.rawText,
        companyHint: body.companyHint,
        roleHint: body.roleHint,
        occurredAt: body.occurredAt,
        tags,
        matchedRole,
        isNewRole,
        suggestedCompany,
        suggestedRole,
        metrics,
      },
      user.id
    );

    return NextResponse.json({ entry, aiWarning }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to save work pool entry.");
  }
}
