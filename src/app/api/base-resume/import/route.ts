import { NextResponse } from "next/server";
import { requireUser } from "@/auth";
import {
  acquireAiGuard,
  hashClientIp,
  logCompletedAiAction,
} from "@/lib/ai-guard";
import { handleApiError } from "@/lib/api-error";
import { saveBaseResume } from "@/lib/db";
import { extractTextFromFile } from "@/lib/file-parser";
import { parseResumeWithAI } from "@/lib/gemini";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_RESUME_CHARS = 25000;

export async function POST(request: Request) {
  let release: (() => void) | null = null;
  try {
    const user = await requireUser();
    const ipHash = hashClientIp(request);

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
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Resume file is too large (max 2 MB)." },
          { status: 413 }
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

    if (rawText.length > MAX_RESUME_CHARS) {
      rawText = rawText.slice(0, MAX_RESUME_CHARS);
    }

    release = acquireAiGuard(user.id, ipHash, "import");
    const { data: parsedData, usage } = await parseResumeWithAI(rawText);
    logCompletedAiAction(user.id, ipHash, "import", usage);

    const saved = saveBaseResume(parsedData, rawText, user.id);
    return NextResponse.json(saved);
  } catch (error) {
    return handleApiError(error, "Failed to import resume.");
  } finally {
    release?.();
  }
}
