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
  getLatestMasterResume,
  listPoolEntries,
} from "@/lib/db";
import { tailorResumeToJobWithAI } from "@/lib/gemini";
import { isSafeHttpUrl } from "@/lib/job-fetcher";
import { PageTargetSchema } from "@/types/resume";

export const runtime = "nodejs";

const TailorSchema = z.object({
  title: z.string().max(120).optional(),
  jobUrl: z
    .string()
    .max(2000)
    .optional()
    .default("")
    .refine((val) => !val.trim() || isSafeHttpUrl(val), {
      message: "Job URL must start with http:// or https://.",
    }),
  jobDescription: z
    .string()
    .min(20, "Please provide a job description (at least 20 characters).")
    .max(15000, "Job description must be 15,000 characters or fewer."),
  pageTarget: PageTargetSchema.optional().default("1-page"),
});

export async function POST(request: Request) {
  let release: (() => void) | null = null;
  try {
    const user = await requireUser();
    const ipHash = hashClientIp(request);

    const body = TailorSchema.parse(await request.json());
    const latestMaster = getLatestMasterResume(user.id);
    const base = getBaseResume(user.id);
    const sourceResume = latestMaster ? latestMaster.data : base.data;
    const sourceResumeKind: "master" | "base" = latestMaster ? "master" : "base";
    const pool = listPoolEntries(user.id);

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

    release = acquireAiGuard(user.id, ipHash, "tailor");
    const result = await tailorResumeToJobWithAI(
      sourceResume,
      pool,
      body.jobDescription,
      body.pageTarget
    );
    logCompletedAiAction(user.id, ipHash, "tailor", result.usage);

    const version = createResumeVersion(
      {
        kind: "tailored",
        title: body.title?.trim() || result.suggestedTitle,
        jobUrl: body.jobUrl.trim(),
        jobDescription: body.jobDescription,
        data: result.data,
        usedPoolIds: result.usedPoolIds,
        analysis: {
          ...result.analysis,
          pageTarget: body.pageTarget,
          sourceResumeKind,
        },
      },
      user.id
    );

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Resume tailoring failed.");
  } finally {
    release?.();
  }
}
