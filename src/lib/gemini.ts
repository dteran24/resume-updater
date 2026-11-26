import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getSetting } from "@/lib/db";
import {
  PoolEntry,
  ResumeData,
  ResumeDataSchema,
  TailoringAnalysis,
  TailoringAnalysisSchema,
  formatRoleLabel,
} from "@/types/resume";

const DEFAULT_MODEL = "gemini-2.5-flash";

function getGeminiConfig(): { apiKey: string; model: string } {
  const apiKey =
    getSetting("gemini_api_key") || process.env.GEMINI_API_KEY?.trim() || "";
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Add it in Settings or set GEMINI_API_KEY in .env.local."
    );
  }
  const model =
    getSetting("gemini_model") ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_MODEL;
  return { apiKey, model };
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

async function callGeminiJson<T>(
  systemInstruction: string,
  userPrompt: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): Promise<T> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripJsonFences(text));
  } catch {
    throw new Error("Gemini returned invalid JSON. Please try again.");
  }

  return schema.parse(parsedJson);
}

const RESUME_JSON_SHAPE_GUIDE = `Return ONLY a JSON object with this exact shape:
{
  "basics": {
    "name": "string",
    "title": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "links": ["string"],
    "summary": "string"
  },
  "experience": [
    {
      "id": "string",
      "company": "string",
      "role": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "bullets": ["string"]
    }
  ],
  "projects": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "technologies": ["string"],
      "url": "string",
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "id": "string",
      "institution": "string",
      "degree": "string",
      "field": "string",
      "startDate": "string",
      "endDate": "string",
      "details": "string"
    }
  ],
  "skills": [
    {
      "category": "string",
      "items": ["string"]
    }
  ]
}`;

export async function parseResumeWithAI(rawText: string): Promise<ResumeData> {
  const systemInstruction = `You are a precise resume parser. Extract the user's resume text into structured JSON without inventing, embellishing, or omitting factual details. Preserve existing dates, companies, titles, metrics, links, and bullet points faithfully.
${RESUME_JSON_SHAPE_GUIDE}`;

  return callGeminiJson(
    systemInstruction,
    `Parse the following resume into structured JSON:\n\n${rawText}`,
    ResumeDataSchema
  );
}

const AutoTagResultSchema = z.object({
  tags: z
    .array(z.string())
    .nullable()
    .optional()
    .transform((v) => (v ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 8)),
  metrics: z
    .array(z.string())
    .nullable()
    .optional()
    .transform((v) => (v ?? []).map((s) => s.trim()).filter(Boolean)),
  matchedRole: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim() ?? ""),
  isNewRole: z
    .boolean()
    .nullable()
    .optional()
    .transform((v) => Boolean(v)),
  suggestedCompany: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim() ?? ""),
  suggestedRole: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim() ?? ""),
});

export type AutoTagResult = z.infer<typeof AutoTagResultSchema>;

export async function autoTagPoolEntryWithAI(
  rawText: string,
  existingRoles: string[],
  hints?: { companyHint?: string; roleHint?: string; occurredAt?: string }
): Promise<AutoTagResult> {
  const systemInstruction = `You analyze a user's raw work accomplishment note ("brag doc" entry) and return structured metadata.
Rules:
1. Extract 2-6 concise skill/domain tags (e.g. "TypeScript", "PostgreSQL", "CI/CD", "Leadership").
2. Extract any concrete quantitative metrics present in the note (e.g. "40% latency reduction", "$50k saved"). Never invent metrics.
3. Compare the note and any user hints against the user's EXISTING BASE RESUME ROLES:
   - If the entry clearly belongs to one of the existing roles, set "matchedRole" to that exact string from the list and "isNewRole": false.
   - CRITICAL EDGE CASE: If the user mentions a company or role NOT present in EXISTING BASE RESUME ROLES (or provided a companyHint/roleHint for an unlisted company), set "isNewRole": true, populate "suggestedCompany" and "suggestedRole" (if known, else empty string), and leave "matchedRole" empty or set it to "<suggestedRole> @ <suggestedCompany>".
   - If no company/role is mentioned or implied and existing roles exist, you may leave "matchedRole" empty and "isNewRole": false.

Return ONLY JSON:
{
  "tags": ["string"],
  "metrics": ["string"],
  "matchedRole": "string",
  "isNewRole": boolean,
  "suggestedCompany": "string",
  "suggestedRole": "string"
}`;

  const prompt = JSON.stringify(
    {
      existingBaseResumeRoles: existingRoles,
      userHints: hints ?? {},
      accomplishmentNote: rawText,
    },
    null,
    2
  );

  return callGeminiJson(systemInstruction, prompt, AutoTagResultSchema);
}

const GeneratedResumeResponseSchema = z.object({
  data: ResumeDataSchema,
  usedPoolIds: z
    .array(z.string())
    .nullable()
    .optional()
    .transform((v) => v ?? []),
  analysis: TailoringAnalysisSchema.default({
    matchedKeywords: [],
    missingKeywords: [],
    tailoringNotes: [],
  }),
});

export async function generateMasterResumeWithAI(
  baseResume: ResumeData,
  poolEntries: PoolEntry[]
): Promise<{
  data: ResumeData;
  usedPoolIds: string[];
  analysis: TailoringAnalysis;
}> {
  const systemInstruction = `You are an expert technical/professional resume writer. Your job is to synthesize a user's Base Resume and their Work Data Pool into an updated, polished, ATS-friendly Master Resume.

STRICT RULES:
1. STRICT FACT-GROUNDING: Only use facts, employers, titles, dates, technologies, and metrics present in the Base Resume or Work Data Pool. NEVER invent numbers, employers, degrees, or skills.
2. BULLET SYNTHESIS: Turn raw Work Data Pool notes into crisp, action-verb-led, impact-focused resume bullets. Deduplicate overlapping bullets between the base resume and pool entries.
3. UNLISTED COMPANY / ROLE EDGE CASE: If any Work Data Pool entries reference a company or role (via companyHint, roleHint, suggestedCompany, suggestedRole, or text) that is NOT in the Base Resume's experience list, DO NOT drop those entries and DO NOT misattribute them to an older employer! Instead, create a new Experience entry for that company/role (ordered most-recent first, using dates from occurredAt or "Present" if unknown) and add a clear reminder in analysis.tailoringNotes asking the user to verify the exact title and dates.
4. SKILLS & SUMMARY: Refresh the summary and skills sections to reflect verified skills from both the Base Resume and Work Data Pool.
5. Return the IDs of every pool entry incorporated in "usedPoolIds".

Return ONLY JSON matching:
{
  "data": <ResumeData>,
  "usedPoolIds": ["pool-entry-id"],
  "analysis": {
    "matchedKeywords": [],
    "missingKeywords": [],
    "tailoringNotes": ["concise notes explaining updates or new roles added"]
  }
}
${RESUME_JSON_SHAPE_GUIDE.replace("Return ONLY a JSON object with this exact shape:", "Schema for <ResumeData>:")}`;

  const payload = {
    baseResume,
    existingRoleLabels: baseResume.experience.map(formatRoleLabel),
    workDataPool: poolEntries.map((e) => ({
      id: e.id,
      rawText: e.rawText,
      companyHint: e.companyHint || e.suggestedCompany,
      roleHint: e.roleHint || e.suggestedRole,
      matchedRole: e.matchedRole,
      isNewRole: e.isNewRole,
      occurredAt: e.occurredAt,
      tags: e.tags,
      metrics: e.metrics,
    })),
  };

  return callGeminiJson(
    systemInstruction,
    JSON.stringify(payload, null, 2),
    GeneratedResumeResponseSchema
  );
}

const TailoredResumeResponseSchema = GeneratedResumeResponseSchema.extend({
  suggestedTitle: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim() || "Tailored Resume"),
});

export async function tailorResumeToJobWithAI(
  baseResume: ResumeData,
  poolEntries: PoolEntry[],
  jobDescription: string
): Promise<{
  suggestedTitle: string;
  data: ResumeData;
  usedPoolIds: string[];
  analysis: TailoringAnalysis;
}> {
  const systemInstruction = `You are an expert ATS-aware resume strategist. Tailor the user's resume for a specific Job Description using ONLY their Base Resume and Work Data Pool.

STRICT RULES:
1. STRICT FACT-GROUNDING: Never fabricate experience, skills, titles, metrics, or tools that do not appear in the Base Resume or Work Data Pool. If a job requirement is missing from the user's background, list it in analysis.missingKeywords — do NOT pretend the user has it.
2. RELEVANCE & ORDERING: Prioritize and rephrase bullets (using truthful terminology aligned with the JD) from the Base Resume and Work Data Pool that best demonstrate fit for this role. Trim less relevant filler bullets if needed for focus.
3. UNLISTED COMPANY / ROLE EDGE CASE: If relevant Work Data Pool entries belong to a company or role NOT yet in the Base Resume's experience list, DO NOT omit them or attach them to the wrong company. Create a dedicated Experience entry for that company/role (using occurredAt dates or "Present" if unknown) and note it in analysis.tailoringNotes for the user to verify.
4. ANALYSIS:
   - matchedKeywords: important JD skills/keywords genuinely backed by the user's resume/pool.
   - missingKeywords: important JD requirements/skills NOT evidenced in the user's resume/pool.
   - tailoringNotes: brief explanation of key adjustments made and any unlisted roles included.
5. suggestedTitle: concise label like "Company Name — Role Title" derived from the JD.

Return ONLY JSON matching:
{
  "suggestedTitle": "string",
  "data": <ResumeData>,
  "usedPoolIds": ["pool-entry-id"],
  "analysis": {
    "matchedKeywords": ["string"],
    "missingKeywords": ["string"],
    "tailoringNotes": ["string"]
  }
}
${RESUME_JSON_SHAPE_GUIDE.replace("Return ONLY a JSON object with this exact shape:", "Schema for <ResumeData>:")}`;

  const payload = {
    jobDescription,
    baseResume,
    workDataPool: poolEntries.map((e) => ({
      id: e.id,
      rawText: e.rawText,
      companyHint: e.companyHint || e.suggestedCompany,
      roleHint: e.roleHint || e.suggestedRole,
      matchedRole: e.matchedRole,
      isNewRole: e.isNewRole,
      occurredAt: e.occurredAt,
      tags: e.tags,
      metrics: e.metrics,
    })),
  };

  return callGeminiJson(
    systemInstruction,
    JSON.stringify(payload, null, 2),
    TailoredResumeResponseSchema
  );
}
