import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser, isAuthEnforced, isPublicMode, requireUser } from "@/auth";
import { getUserQuotaSummary } from "@/lib/ai-guard";
import { handleApiError } from "@/lib/api-error";
import { getSettingsStatus, setSetting } from "@/lib/db";

export const runtime = "nodejs";

const UpdateSettingsSchema = z.object({
  apiKey: z.string().max(200).optional(),
  clearApiKey: z.boolean().optional(),
});

export async function GET() {
  const user = await getOptionalUser();
  const publicMode = isPublicMode();
  const authRequired = isAuthEnforced();
  const quotas = user ? getUserQuotaSummary(user.id) : null;

  return NextResponse.json(
    getSettingsStatus({
      publicMode,
      authRequired,
      user,
      quotas,
    })
  );
}

export async function PUT(request: Request) {
  try {
    if (isPublicMode()) {
      return NextResponse.json(
        { error: "API key settings are managed by the server in public mode." },
        { status: 403 }
      );
    }

    const user = await requireUser();
    const body = UpdateSettingsSchema.parse(await request.json());

    if (body.clearApiKey) {
      setSetting("gemini_api_key", null);
    } else if (body.apiKey !== undefined && body.apiKey.trim() !== "") {
      setSetting("gemini_api_key", body.apiKey.trim());
    }

    return NextResponse.json(
      getSettingsStatus({
        publicMode: false,
        authRequired: isAuthEnforced(),
        user,
        quotas: getUserQuotaSummary(user.id),
      })
    );
  } catch (error) {
    return handleApiError(error, "Failed to update settings.");
  }
}
