import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/auth";
import {
  acquireAiGuard,
  hashClientIp,
  logCompletedAiAction,
} from "@/lib/ai-guard";
import { handleApiError } from "@/lib/api-error";
import {
  createResumeVersion,
  getBaseResume,
  listPoolEntries,
} from "@/lib/db";
import { generateMasterResumeWithAI } from "@/lib/gemini";
import { PageTargetSchema } from "@/types/resume";

export const runtime = "nodejs";

const GenerateBodySchema = z
  .object({
    pageTarget: PageTargetSchema.optional(),
  })
  .optional();

export async function POST(request: Request) {
  let release: (() => void) | null = null;
  try {
    const user = await requireUser();
    const ipHash = hashClientIp(request);

    let pageTarget: "1-page" | "2-page" = "1-page";
    try {
      const raw = await request.text();
      if (raw.trim()) {
        const parsed = GenerateBodySchema.parse(JSON.parse(raw));
        if (parsed?.pageTarget) pageTarget = parsed.pageTarget;
      }
    } catch {
      // default to 1-page if empty body
    }

    const base = getBaseResume(user.id);
    const pool = listPoolEntries(user.id);

    const hasBaseContent =
      Boolean(base.data.basics.name) ||
      base.data.experience.length > 0 ||
      base.data.projects.length > 0;

    if (!hasBaseContent && pool.length === 0) {
      return NextResponse.json(
        {
          error:
            "Please add a base resume or at least one work data pool entry before generating.",
        },
        { status: 400 }
      );
    }

    release = acquireAiGuard(user.id, ipHash, "generate");
    const result = await generateMasterResumeWithAI(base.data, pool, pageTarget);
    logCompletedAiAction(user.id, ipHash, "generate", result.usage);

    const version = createResumeVersion(
      {
        kind: "master",
        title: `Master Resume (${new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })})`,
        data: result.data,
        usedPoolIds: result.usedPoolIds,
        analysis: {
          ...result.analysis,
          pageTarget,
          sourceResumeKind: "base",
        },
      },
      user.id
    );

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Master resume generation failed.");
  } finally {
    release?.();
  }
}
