import { NextResponse } from "next/server";
import { requireUser } from "@/auth";
import { handleApiError } from "@/lib/api-error";
import { listResumeVersions } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ versions: listResumeVersions(user.id) });
  } catch (error) {
    return handleApiError(error, "Failed to load saved versions.");
  }
}
