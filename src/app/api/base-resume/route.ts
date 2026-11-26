import { NextResponse } from "next/server";
import { getBaseResume, saveBaseResume } from "@/lib/db";
import { ResumeDataSchema } from "@/types/resume";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getBaseResume());
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsedData = ResumeDataSchema.parse(body.data ?? body);
    const saved = saveBaseResume(parsedData);
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid resume data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
