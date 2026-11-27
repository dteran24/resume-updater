import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/auth";
import { GuardError } from "@/lib/ai-guard";

export function handleApiError(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof GuardError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const first = error.issues[0]?.message || "Invalid request payload.";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  console.error(`[API Error] ${fallbackMessage}:`, error);

  const msg = error instanceof Error ? error.message : "";
  if (
    msg.includes("API key") ||
    msg.includes("Unsupported file format") ||
    msg.includes("No selectable text") ||
    msg.includes("file is empty") ||
    msg.includes("too large")
  ) {
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
