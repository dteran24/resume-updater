import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchJobDescription } from "@/lib/job-fetcher";

export const runtime = "nodejs";

const FetchJobSchema = z.object({
  url: z.string().min(1, "Please enter a job posting URL"),
});

export async function POST(request: Request) {
  try {
    const { url } = FetchJobSchema.parse(await request.json());
    const result = await fetchJobDescription(url);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid URL request";
    return NextResponse.json({ ok: false, reason: message }, { status: 400 });
  }
}
