import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createResumeVersion,
  getBaseResume,
  listPoolEntries,
} from "@/lib/db";
import { tailorResumeToJobWithAI } from "@/lib/gemini";

export const runtime = "nodejs";

const TailorSchema = z.object({
  title: z.string().optional(),
  jobUrl: z.string().optional().default(""),
  jobDescription: z
    .string()
    .min(20, "Please provide a job description (at least 20 characters)."),
});

export async function POST(request: Request) {
  try {
    const body = TailorSchema.parse(await request.json());
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
            "Please add a base resume or work data pool entries before tailoring to a job.",
        },
        { status: 400 }
      );
    }

    const result = await tailorResumeToJobWithAI(
      base.data,
      pool,
      body.jobDescription
    );

    const version = createResumeVersion({
      kind: "tailored",
      title: body.title?.trim() || result.suggestedTitle,
      jobUrl: body.jobUrl,
      jobDescription: body.jobDescription,
      data: result.data,
      usedPoolIds: result.usedPoolIds,
      analysis: result.analysis,
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tailoring failed";
    const status = message.includes("API key") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
