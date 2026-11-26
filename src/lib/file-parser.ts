import mammoth from "mammoth";
import { extractText } from "unpdf";

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  mimeType = ""
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const lowerMime = mimeType.toLowerCase();

  if (ext === "pdf" || lowerMime.includes("pdf")) {
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    const text = (Array.isArray(result.text) ? result.text.join("\n") : result.text || "").trim();
    if (!text) {
      throw new Error(
        "No selectable text was found in this PDF (it may be a scanned image). Please paste your resume text instead."
      );
    }
    return text;
  }

  if (
    ext === "docx" ||
    lowerMime.includes("wordprocessingml") ||
    lowerMime.includes("officedocument")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || "").trim();
    if (!text) {
      throw new Error("Could not extract any text from this DOCX file.");
    }
    return text;
  }

  if (ext === "txt" || ext === "md" || lowerMime.startsWith("text/")) {
    const text = buffer.toString("utf-8").trim();
    if (!text) {
      throw new Error("The uploaded text file is empty.");
    }
    return text;
  }

  throw new Error(
    `Unsupported file format (.${ext || "unknown"}). Please upload a PDF, DOCX, TXT, or MD file, or paste your resume text.`
  );
}
