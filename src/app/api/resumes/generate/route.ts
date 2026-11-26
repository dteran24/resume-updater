import { NextResponse } from "next/server";
import {
  createResumeVersion,
  getBaseResume,
  listPoolEntries,
} from "@/lib/db";
import { generateMasterResumeWithAI } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST() {
  try {
    const base = getBaseResume();
    const pool = listPoolEntries();

    const hasBaseContent =
      Boolean(base.data.basics.name) ||
      base.data.experience.length > 0 ||
      base.data.projects.length > 0;

    if (!hasBaseContent && pool.length === 0) {
      return NextResponse.json(
        {
          error:
            "Please add a base resume or at least one work data pool entry before generating.",
        },
        { status: 400 }
      );
    }

    const result = await generateMasterResumeWithAI(base.data, pool);
    const version = createResumeVersion({
      kind: "master",
      title: `Master Resume (${new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })})`,
      data: result.data,
      usedPoolIds: result.usedPoolIds,
      analysis: result.analysis,
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    const status = message.includes("API key") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
