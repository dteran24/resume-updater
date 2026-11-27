import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createResumeVersion,
  getBaseResume,
  getLatestMasterResume,
  listPoolEntries,
} from "@/lib/db";
import { tailorResumeToJobWithAI } from "@/lib/gemini";
import { PageTargetSchema } from "@/types/resume";

export const runtime = "nodejs";

const TailorSchema = z.object({
  title: z.string().optional(),
  jobUrl: z.string().optional().default(""),
  jobDescription: z
    .string()
    .min(20, "Please provide a job description (at least 20 characters)."),
  pageTarget: PageTargetSchema.optional().default("1-page"),
});

export async function POST(request: Request) {
  try {
    const body = TailorSchema.parse(await request.json());
    const latestMaster = getLatestMasterResume();
    const base = getBaseResume();
    const sourceResume = latestMaster ? latestMaster.data : base.data;
    const sourceResumeKind: "master" | "base" = latestMaster ? "master" : "base";
    const pool = listPoolEntries();

    const hasSourceContent =
      Boolean(sourceResume.basics.name) ||
      sourceResume.experience.length > 0 ||
      sourceResume.projects.length > 0;

    if (!hasSourceContent && pool.length === 0) {
      return NextResponse.json(
        {
          error:
            "Please add a base resume or work data pool entries before tailoring to a job.",
        },
        { status: 400 }
      );
    }

    const result = await tailorResumeToJobWithAI(
      sourceResume,
      pool,
      body.jobDescription,
      body.pageTarget
    );

    const version = createResumeVersion({
      kind: "tailored",
      title: body.title?.trim() || result.suggestedTitle,
      jobUrl: body.jobUrl,
      jobDescription: body.jobDescription,
      data: result.data,
      usedPoolIds: result.usedPoolIds,
      analysis: {
        ...result.analysis,
        pageTarget: body.pageTarget,
        sourceResumeKind,
      },
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tailoring failed";
    const status = message.includes("API key") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
