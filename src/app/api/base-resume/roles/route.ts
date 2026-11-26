import { NextResponse } from "next/server";
import { z } from "zod";
import { addRoleToBaseResume, getPoolEntry } from "@/lib/db";

export const runtime = "nodejs";

const PromoteRoleSchema = z.object({
  company: z.string().min(1, "Company name is required"),
  role: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default("Present"),
  location: z.string().optional().default(""),
  poolEntryId: z.string().optional(),
  includeEntryBullet: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const body = PromoteRoleSchema.parse(await request.json());
    let bullets: string[] = [];

    if (body.includeEntryBullet && body.poolEntryId) {
      const entry = getPoolEntry(body.poolEntryId);
      if (entry) {
        bullets = [entry.rawText];
      }
    }

    const saved = addRoleToBaseResume({
      company: body.company,
      role: body.role || "Role",
      startDate: body.startDate,
      endDate: body.endDate,
      location: body.location,
      bullets,
      poolEntryId: body.poolEntryId,
    });

    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add role";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
