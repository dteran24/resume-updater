import { NextResponse } from "next/server";
import { z } from "zod";
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
  try {
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

    const base = getBaseResume();
    const pool = listPoolEntries();

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

    const result = await generateMasterResumeWithAI(base.data, pool, pageTarget);
    const version = createResumeVersion({
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
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    const status = message.includes("API key") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
