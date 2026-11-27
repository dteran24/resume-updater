import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsStatus, setSetting } from "@/lib/db";

export const runtime = "nodejs";

const UpdateSettingsSchema = z.object({
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json(getSettingsStatus());
}

export async function PUT(request: Request) {
  try {
    const body = UpdateSettingsSchema.parse(await request.json());

    if (body.clearApiKey) {
      setSetting("gemini_api_key", null);
    } else if (body.apiKey !== undefined && body.apiKey.trim() !== "") {
      setSetting("gemini_api_key", body.apiKey.trim());
    }

    return NextResponse.json(getSettingsStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid settings payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
