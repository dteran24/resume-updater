import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteResumeVersion,
  getResumeVersion,
  updateResumeVersion,
} from "@/lib/db";
import { ResumeDataSchema, TailoringAnalysisSchema } from "@/types/resume";

export const runtime = "nodejs";

const PatchVersionSchema = z.object({
  title: z.string().optional(),
  data: ResumeDataSchema.optional(),
  analysis: TailoringAnalysisSchema.nullable().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const version = getResumeVersion(id);
  if (!version) {
    return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
  }
  return NextResponse.json({ version });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = PatchVersionSchema.parse(await request.json());
    const updated = updateResumeVersion(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
    }
    return NextResponse.json({ version: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid update payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deleted = deleteResumeVersion(id);
  if (!deleted) {
    return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
