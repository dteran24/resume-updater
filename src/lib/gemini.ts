import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { FIXED_GEMINI_MODEL, getSetting } from "@/lib/db";
import {
  PageTarget,
  PoolEntry,
  ResumeData,
  ResumeDataSchema,
  TailoringAnalysis,
  TailoringAnalysisSchema,
  formatRoleLabel,
} from "@/types/resume";

function getGeminiApiKey(): string {
  const apiKey =
    getSetting("gemini_api_key") || process.env.GEMINI_API_KEY?.trim() || "";
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Add it in Settings or set GEMINI_API_KEY in .env.local."
    );
  }
  return apiKey;
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
  const apiKey = getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model: FIXED_GEMINI_MODEL,
      contents:
        attempt === 0
          ? userPrompt
          : `${userPrompt}\n\nIMPORTANT: Your previous response could not be parsed as valid JSON. Return ONLY raw valid JSON matching the exact schema with no prose or markdown.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    const text = response.text;
    if (!text) {
      lastError = new Error("Gemini returned an empty response.");
      continue;
    }

    try {
      const parsedJson = JSON.parse(stripJsonFences(text));
      return schema.parse(parsedJson);
    } catch (err) {
      lastError =
        err instanceof Error
          ? new Error(`Gemini returned malformed structured output: ${err.message}`)
          : new Error("Gemini returned invalid JSON. Please try again.");
    }
  }

  throw lastError ?? new Error("Gemini request failed.");
}

function sanitizePoolIds(ids: string[], validIds: Set<string>): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const id of ids) {
    if (validIds.has(id) && !seen.has(id)) {
      seen.add(id);
      clean.push(id);
    }
  }
  return clean;
}

function pageBudgetInstructions(pageTarget: PageTarget): string {
  if (pageTarget === "2-page") {
    return `PAGE BUDGET (2-PAGE TARGET):
- Allow up to 5–7 bullets for the most recent 1–2 roles and 3–4 bullets for older roles.
- Include relevant projects and leadership/mentoring impact where backed by the pool.
- Keep each bullet concise (1–2 lines max) and scannable.`;
  }
  return `PAGE BUDGET (1-PAGE TARGET):
- Strictly budget for a crisp single-page resume: 3–5 bullets for the most recent 1–2 roles, 2–3 bullets for older roles.
- Keep summary to 2 concise sentences max (or omit filler).
- Trim redundant or low-impact bullets so every line earns its space.`;
}

const BULLET_CRAFT_RULES = `WRITING & FORMATTING STANDARD (IMPACT-FIRST):
- Every bullet follows Action Verb + Scope/Context + Measurable Outcome (XYZ/STAR style).
- Never use first-person pronouns ("I", "me", "my", "we").
- Ban vague filler ("Responsible for...", "Helped with...", "Worked on...", "Passionate self-starter", "Spearheaded synergies").
- Keep bullets punchy (1–2 lines max). Preserve exact numbers/metrics from the user's input — NEVER invent or inflate numbers.
- Order Experience reverse-chronologically (most recent first) and normalize date formatting consistently (e.g. "Jan 2024 – Present").
- Group Skills into clean, scannable categories (e.g. Languages, Frameworks, Infrastructure).`;

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

const SUGGESTED_EDITS_AND_COACHING_GUIDE = `SUGGESTED EDITS & COACHING OUTPUT:
- In "analysis.suggestedEdits", list the meaningful individual edits you made (4–12 high-signal items) so the user can review and Accept/Reject each one:
  - section: "summary" | "experience" | "projects" | "skills"
  - targetLabel: exact role label like "Role @ Company" (for experience), project name (for projects), "Summary", or skill category (for skills)
  - action: "add" | "rewrite" | "remove"
  - before: exact original bullet/summary/skills text from the input resume ("" if action is "add")
  - after: exact new text placed in "data" ("" if action is "remove")
  - reason: 1 concise sentence explaining why this edit strengthens the resume or aligns with the JD
  - sourcePoolIds: array of exact workDataPool entry IDs used for this edit (empty array if purely polishing existing resume text)
- In "analysis.coachingSuggestions", include 2–5 actionable coaching prompts:
  - kind: "missing-metric" (bullets that would be much stronger if the user adds a real number like latency, users, or $ saved), "jd-gap-question" (important JD skills not found in the pool — phrase as a friendly question like "The JD emphasizes Terraform — if you've used it, log a quick win in Work Pool"), "weak-bullet" (redundant or vague items), or "formatting" (e.g. verify dates on an unlisted new role).`;

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
  const systemInstruction = `You analyze a user's raw work accomplishment note ("win log" entry) and return structured metadata.
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
    suggestedEdits: [],
    coachingSuggestions: [],
  }),
});

export async function generateMasterResumeWithAI(
  baseResume: ResumeData,
  poolEntries: PoolEntry[],
  pageTarget: PageTarget = "1-page"
): Promise<{
  data: ResumeData;
  usedPoolIds: string[];
  analysis: TailoringAnalysis;
}> {
  const systemInstruction = `You are an expert technical/professional resume writer. Synthesize the user's Base Resume and Work Data Pool into an updated, polished, ATS-friendly Master Resume.

STRICT RULES:
1. STRICT FACT-GROUNDING: Only use facts, employers, titles, dates, technologies, and metrics present in the Base Resume or Work Data Pool. NEVER invent numbers, employers, degrees, or skills.
2. ${BULLET_CRAFT_RULES}
3. ${pageBudgetInstructions(pageTarget)}
4. DEDUPLICATION & SYNTHESIS: Merge overlapping accomplishments between the Base Resume and Work Data Pool into single stronger bullets rather than duplicating them.
5. UNLISTED COMPANY / ROLE EDGE CASE: If any Work Data Pool entries reference a company or role (via companyHint, roleHint, suggestedCompany, suggestedRole, or text) that is NOT in the Base Resume's experience list, DO NOT drop those entries and DO NOT misattribute them to an older employer! Create a new Experience entry for that company/role (ordered most-recent first, using dates from occurredAt or "Present" if unknown) and add a formatting coachingSuggestion asking the user to verify the exact title and dates.
6. ${SUGGESTED_EDITS_AND_COACHING_GUIDE}
7. Return the exact IDs of every pool entry incorporated in "usedPoolIds".

Return ONLY JSON matching:
{
  "data": <ResumeData>,
  "usedPoolIds": ["exact-pool-entry-id"],
  "analysis": {
    "matchedKeywords": [],
    "missingKeywords": [],
    "tailoringNotes": ["concise summary notes"],
    "suggestedEdits": [
      {
        "id": "edit-1",
        "section": "summary" | "experience" | "projects" | "skills",
        "targetLabel": "Role @ Company",
        "action": "add" | "rewrite" | "remove",
        "before": "string",
        "after": "string",
        "reason": "string",
        "sourcePoolIds": ["exact-pool-entry-id"],
        "accepted": true
      }
    ],
    "coachingSuggestions": [
      {
        "kind": "missing-metric" | "jd-gap-question" | "weak-bullet" | "formatting",
        "targetLabel": "string",
        "message": "string"
      }
    ]
  }
}
${RESUME_JSON_SHAPE_GUIDE.replace("Return ONLY a JSON object with this exact shape:", "Schema for <ResumeData>:")}`;

  const payload = {
    pageTarget,
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

  const result = await callGeminiJson(
    systemInstruction,
    JSON.stringify(payload, null, 2),
    GeneratedResumeResponseSchema
  );

  const validIds = new Set(poolEntries.map((e) => e.id));
  const sanitizedEdits = result.analysis.suggestedEdits.map((edit) => ({
    ...edit,
    sourcePoolIds: sanitizePoolIds(edit.sourcePoolIds, validIds),
    accepted: true,
  }));

  const usedFromEdits = sanitizedEdits.flatMap((e) => e.sourcePoolIds);
  const usedPoolIds = sanitizePoolIds(
    [...result.usedPoolIds, ...usedFromEdits],
    validIds
  );

  return {
    data: result.data,
    usedPoolIds,
    analysis: {
      ...result.analysis,
      suggestedEdits: sanitizedEdits,
      pageTarget,
    },
  };
}

const TailoredResumeResponseSchema = GeneratedResumeResponseSchema.extend({
  suggestedTitle: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim() || "Tailored Resume"),
});

export async function tailorResumeToJobWithAI(
  sourceResume: ResumeData,
  poolEntries: PoolEntry[],
  jobDescription: string,
  pageTarget: PageTarget = "1-page"
): Promise<{
  suggestedTitle: string;
  data: ResumeData;
  usedPoolIds: string[];
  analysis: TailoringAnalysis;
}> {
  const systemInstruction = `You are an expert ATS-aware resume strategist. Tailor the user's resume for a specific Job Description using ONLY their Source Resume and Work Data Pool.

STRICT RULES:
1. STRICT FACT-GROUNDING: Never fabricate experience, skills, titles, metrics, or tools that do not appear in the Source Resume or Work Data Pool. If a job requirement is missing from the user's background, list it in analysis.missingKeywords AND add a "jd-gap-question" in analysis.coachingSuggestions — do NOT pretend the user has it.
2. ${BULLET_CRAFT_RULES}
3. ${pageBudgetInstructions(pageTarget)}
4. RELEVANCE & ORDERING: Prioritize and rephrase bullets (using truthful terminology aligned with the JD) from the Source Resume and Work Data Pool that best demonstrate fit for this role. Trim less relevant filler bullets to stay within the page budget.
5. UNLISTED COMPANY / ROLE EDGE CASE: If relevant Work Data Pool entries belong to a company or role NOT yet in the Source Resume's experience list, DO NOT omit them or attach them to the wrong company. Create a dedicated Experience entry for that company/role (using occurredAt dates or "Present" if unknown) and add a formatting coachingSuggestion to verify exact title/dates.
6. ${SUGGESTED_EDITS_AND_COACHING_GUIDE}
7. ANALYSIS:
   - matchedKeywords: important JD skills/keywords genuinely backed by the user's resume/pool.
   - missingKeywords: important JD requirements/skills NOT evidenced in the user's resume/pool.
   - tailoringNotes: brief explanation of the overall strategy used for this role.
8. suggestedTitle: concise label like "Company Name — Role Title" derived from the JD.

Return ONLY JSON matching:
{
  "suggestedTitle": "string",
  "data": <ResumeData>,
  "usedPoolIds": ["exact-pool-entry-id"],
  "analysis": {
    "matchedKeywords": ["string"],
    "missingKeywords": ["string"],
    "tailoringNotes": ["string"],
    "suggestedEdits": [
      {
        "id": "edit-1",
        "section": "summary" | "experience" | "projects" | "skills",
        "targetLabel": "Role @ Company",
        "action": "add" | "rewrite" | "remove",
        "before": "string",
        "after": "string",
        "reason": "string",
        "sourcePoolIds": ["exact-pool-entry-id"],
        "accepted": true
      }
    ],
    "coachingSuggestions": [
      {
        "kind": "missing-metric" | "jd-gap-question" | "weak-bullet" | "formatting",
        "targetLabel": "string",
        "message": "string"
      }
    ]
  }
}
${RESUME_JSON_SHAPE_GUIDE.replace("Return ONLY a JSON object with this exact shape:", "Schema for <ResumeData>:")}`;

  const payload = {
    pageTarget,
    jobDescription,
    sourceResume,
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

  const result = await callGeminiJson(
    systemInstruction,
    JSON.stringify(payload, null, 2),
    TailoredResumeResponseSchema
  );

  const validIds = new Set(poolEntries.map((e) => e.id));
  const sanitizedEdits = result.analysis.suggestedEdits.map((edit) => ({
    ...edit,
    sourcePoolIds: sanitizePoolIds(edit.sourcePoolIds, validIds),
    accepted: true,
  }));

  const usedFromEdits = sanitizedEdits.flatMap((e) => e.sourcePoolIds);
  const usedPoolIds = sanitizePoolIds(
    [...result.usedPoolIds, ...usedFromEdits],
    validIds
  );

  return {
    suggestedTitle: result.suggestedTitle,
    data: result.data,
    usedPoolIds,
    analysis: {
      ...result.analysis,
      suggestedEdits: sanitizedEdits,
      pageTarget,
    },
  };
}
