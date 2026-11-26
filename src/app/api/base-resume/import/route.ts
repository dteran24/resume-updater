import { NextResponse } from "next/server";
import { saveBaseResume } from "@/lib/db";
import { extractTextFromFile } from "@/lib/file-parser";
import { parseResumeWithAI } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let rawText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Please select a resume file to upload." },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      rawText = await extractTextFromFile(buffer, file.name, file.type);
    } else {
      const body = (await request.json()) as { rawText?: string };
      rawText = (body.rawText || "").trim();
      if (!rawText) {
        return NextResponse.json(
          { error: "Please paste your resume text before importing." },
          { status: 400 }
        );
      }
    }

    const parsedData = await parseResumeWithAI(rawText);
    const saved = saveBaseResume(parsedData, rawText);
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import resume";
    const status = message.includes("API key") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
