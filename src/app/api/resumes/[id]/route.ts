import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/auth";
import { handleApiError } from "@/lib/api-error";
import {
  deleteResumeVersion,
  getResumeVersion,
  updateResumeVersion,
} from "@/lib/db";
import { ResumeDataSchema, TailoringAnalysisSchema } from "@/types/resume";

export const runtime = "nodejs";

const PatchVersionSchema = z.object({
  title: z.string().max(120).optional(),
  data: ResumeDataSchema.optional(),
  analysis: TailoringAnalysisSchema.nullable().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const version = getResumeVersion(id, user.id);
    if (!version) {
      return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
    }
    return NextResponse.json({ version });
  } catch (error) {
    return handleApiError(error, "Failed to load resume version.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = PatchVersionSchema.parse(await request.json());
    const updated = updateResumeVersion(id, body, user.id);
    if (!updated) {
      return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
    }
    return NextResponse.json({ version: updated });
  } catch (error) {
    return handleApiError(error, "Failed to update resume version.");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const deleted = deleteResumeVersion(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete resume version.");
  }
}
