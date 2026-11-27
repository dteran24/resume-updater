import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/auth";
import { handleApiError } from "@/lib/api-error";
import { deletePoolEntry, updatePoolEntry } from "@/lib/db";

export const runtime = "nodejs";

const UpdatePoolSchema = z.object({
  rawText: z.string().min(1).max(1500).optional(),
  companyHint: z.string().max(120).optional(),
  roleHint: z.string().max(120).optional(),
  occurredAt: z.string().max(60).optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
  matchedRole: z.string().max(200).optional(),
  isNewRole: z.boolean().optional(),
  suggestedCompany: z.string().max(120).optional(),
  suggestedRole: z.string().max(120).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const patch = UpdatePoolSchema.parse(await request.json());
    const updated = updatePoolEntry(id, patch, user.id);
    if (!updated) {
      return NextResponse.json({ error: "Pool entry not found" }, { status: 404 });
    }
    return NextResponse.json({ entry: updated });
  } catch (error) {
    return handleApiError(error, "Failed to update pool entry.");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const deleted = deletePoolEntry(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Pool entry not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete pool entry.");
  }
}
