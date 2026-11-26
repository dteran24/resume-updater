import { NextResponse } from "next/server";
import { z } from "zod";
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
  rawText: z.string().min(1, "Please enter what you worked on."),
  companyHint: z.string().optional().default(""),
  roleHint: z.string().optional().default(""),
  occurredAt: z.string().optional().default(""),
  matchedRole: z.string().optional().default(""),
  isUnlistedRole: z.boolean().optional().default(false),
});

export async function GET() {
  return NextResponse.json({ entries: listPoolEntries() });
}

export async function POST(request: Request) {
  try {
    const body = CreatePoolSchema.parse(await request.json());
    const base = getBaseResume();
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
      try {
        const aiResult = await autoTagPoolEntryWithAI(body.rawText, existingRoles, {
          companyHint: body.companyHint,
          roleHint: body.roleHint,
          occurredAt: body.occurredAt,
        });
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
          err instanceof Error
            ? `Saved without AI auto-tagging: ${err.message}`
            : "Saved without AI auto-tagging.";
      }
    }

    if (isNewRole && !matchedRole && (suggestedCompany || suggestedRole)) {
      matchedRole = formatRoleLabel({
        company: suggestedCompany,
        role: suggestedRole,
      });
    }

    const entry = createPoolEntry({
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
    });

    return NextResponse.json({ entry, aiWarning }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid pool entry";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
