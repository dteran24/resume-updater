import { NextResponse } from "next/server";
import { listResumeVersions } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ versions: listResumeVersions() });
}
