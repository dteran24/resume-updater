import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/auth";
import { handleApiError } from "@/lib/api-error";
import { addRoleToBaseResume, getPoolEntry } from "@/lib/db";

export const runtime = "nodejs";

const PromoteRoleSchema = z.object({
  company: z.string().min(1, "Company name is required").max(120),
  role: z.string().max(120).optional().default(""),
  startDate: z.string().max(40).optional().default(""),
  endDate: z.string().max(40).optional().default("Present"),
  location: z.string().max(120).optional().default(""),
  poolEntryId: z.string().max(100).optional(),
  includeEntryBullet: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = PromoteRoleSchema.parse(await request.json());
    let bullets: string[] = [];

    if (body.includeEntryBullet && body.poolEntryId) {
      const entry = getPoolEntry(body.poolEntryId, user.id);
      if (entry) {
        bullets = [entry.rawText];
      }
    }

    const saved = addRoleToBaseResume(
      {
        company: body.company,
        role: body.role || "Role",
        startDate: body.startDate,
        endDate: body.endDate,
        location: body.location,
        bullets,
        poolEntryId: body.poolEntryId,
      },
      user.id
    );

    return NextResponse.json(saved);
  } catch (error) {
    return handleApiError(error, "Could not add role to base resume.");
  }
}
