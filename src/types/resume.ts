import { z } from "zod";

const nullableString = (fallback = "") =>
  z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? fallback);

const stringArray = () =>
  z
    .array(z.string())
    .nullable()
    .optional()
    .transform((v) => (v ?? []).map((s) => s.trim()).filter(Boolean));

export const ResumeBasicsSchema = z.object({
  name: nullableString(),
  title: nullableString(),
  email: nullableString(),
  phone: nullableString(),
  location: nullableString(),
  links: stringArray(),
  summary: nullableString(),
});

export const ExperienceItemSchema = z.object({
  id: nullableString().transform((v) => v || crypto.randomUUID()),
  company: nullableString(),
  role: nullableString(),
  location: nullableString(),
  startDate: nullableString(),
  endDate: nullableString(),
  bullets: stringArray(),
});

export const ProjectItemSchema = z.object({
  id: nullableString().transform((v) => v || crypto.randomUUID()),
  name: nullableString(),
  description: nullableString(),
  technologies: stringArray(),
  url: nullableString(),
  bullets: stringArray(),
});

export const EducationItemSchema = z.object({
  id: nullableString().transform((v) => v || crypto.randomUUID()),
  institution: nullableString(),
  degree: nullableString(),
  field: nullableString(),
  startDate: nullableString(),
  endDate: nullableString(),
  details: nullableString(),
});

export const SkillGroupSchema = z.object({
  category: nullableString("Skills"),
  items: stringArray(),
});

export const ResumeDataSchema = z.object({
  basics: ResumeBasicsSchema.default({
    name: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    links: [],
    summary: "",
  }),
  experience: z.array(ExperienceItemSchema).nullable().optional().transform((v) => v ?? []),
  projects: z.array(ProjectItemSchema).nullable().optional().transform((v) => v ?? []),
  education: z.array(EducationItemSchema).nullable().optional().transform((v) => v ?? []),
  skills: z.array(SkillGroupSchema).nullable().optional().transform((v) => v ?? []),
});

export const TailoringAnalysisSchema = z.object({
  matchedKeywords: stringArray(),
  missingKeywords: stringArray(),
  tailoringNotes: stringArray(),
});

export type ResumeBasics = z.infer<typeof ResumeBasicsSchema>;
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;
export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type EducationItem = z.infer<typeof EducationItemSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;
export type ResumeData = z.infer<typeof ResumeDataSchema>;
export type TailoringAnalysis = z.infer<typeof TailoringAnalysisSchema>;

export interface PoolEntry {
  id: string;
  rawText: string;
  companyHint: string;
  roleHint: string;
  occurredAt: string;
  tags: string[];
  matchedRole: string;
  isNewRole: boolean;
  suggestedCompany: string;
  suggestedRole: string;
  metrics: string[];
  createdAt: string;
}

export interface ResumeVersion {
  id: string;
  kind: "master" | "tailored";
  title: string;
  jobUrl: string;
  jobDescription: string;
  data: ResumeData;
  usedPoolIds: string[];
  analysis: TailoringAnalysis | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsStatus {
  hasApiKey: boolean;
  keySource: "settings" | "env" | "none";
  maskedKey: string;
  model: string;
}

export const EMPTY_RESUME_DATA: ResumeData = {
  basics: {
    name: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    links: [],
    summary: "",
  },
  experience: [],
  projects: [],
  education: [],
  skills: [],
};

export function formatRoleLabel(exp: Pick<ExperienceItem, "role" | "company">): string {
  const role = exp.role.trim();
  const company = exp.company.trim();
  if (role && company) return `${role} @ ${company}`;
  return role || company || "Untitled Role";
}
