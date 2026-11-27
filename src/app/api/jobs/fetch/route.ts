import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/auth";
import {
  acquireAiGuard,
  hashClientIp,
  logCompletedAiAction,
} from "@/lib/ai-guard";
import { handleApiError } from "@/lib/api-error";
import { fetchJobDescription } from "@/lib/job-fetcher";

export const runtime = "nodejs";

const FetchJobSchema = z.object({
  url: z.string().min(1, "Please enter a job posting URL").max(2000),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ipHash = hashClientIp(request);
    acquireAiGuard(user.id, ipHash, "job-fetch");

    const { url } = FetchJobSchema.parse(await request.json());
    logCompletedAiAction(user.id, ipHash, "job-fetch");
    const result = await fetchJobDescription(url);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Could not fetch job description.");
  }
}
