import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePoolEntry, updatePoolEntry } from "@/lib/db";

export const runtime = "nodejs";

const UpdatePoolSchema = z.object({
  rawText: z.string().min(1).optional(),
  companyHint: z.string().optional(),
  roleHint: z.string().optional(),
  occurredAt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  matchedRole: z.string().optional(),
  isNewRole: z.boolean().optional(),
  suggestedCompany: z.string().optional(),
  suggestedRole: z.string().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const patch = UpdatePoolSchema.parse(await request.json());
    const updated = updatePoolEntry(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Pool entry not found" }, { status: 404 });
    }
    return NextResponse.json({ entry: updated });
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
  const deleted = deletePoolEntry(id);
  if (!deleted) {
    return NextResponse.json({ error: "Pool entry not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
