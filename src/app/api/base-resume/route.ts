import { NextResponse } from "next/server";
import { requireUser } from "@/auth";
import { handleApiError } from "@/lib/api-error";
import { getBaseResume, saveBaseResume } from "@/lib/db";
import { ResumeDataSchema } from "@/types/resume";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(getBaseResume(user.id));
  } catch (error) {
    return handleApiError(error, "Failed to load base resume.");
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsedData = ResumeDataSchema.parse(body.data ?? body);
    const saved = saveBaseResume(parsedData, undefined, user.id);
    return NextResponse.json(saved);
  } catch (error) {
    return handleApiError(error, "Failed to save base resume.");
  }
}
