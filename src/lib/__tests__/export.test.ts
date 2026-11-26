import { describe, expect, it } from "vitest";
import { resumeToMarkdown } from "@/lib/markdown-export";
import { ResumeDataSchema, formatRoleLabel } from "@/types/resume";

describe("ResumeDataSchema and Markdown export", () => {
  it("normalizes nullable AI fields safely", () => {
    const parsed = ResumeDataSchema.parse({
      basics: {
        name: "Taylor Chen",
        title: null,
        email: "taylor@example.com",
        phone: null,
        location: "Seattle, WA",
        links: null,
        summary: "Full-stack engineer.",
      },
      experience: [
        {
          id: null,
          company: "Northwind",
          role: "Senior Engineer",
          location: null,
          startDate: "2023",
          endDate: "Present",
          bullets: ["Reduced p99 latency by 35%", ""],
        },
      ],
      projects: null,
      education: [],
      skills: [{ category: "Languages", items: ["TypeScript", "SQL"] }],
    });

    expect(parsed.basics.links).toEqual([]);
    expect(parsed.experience[0].id).toBeTruthy();
    expect(parsed.experience[0].bullets).toEqual(["Reduced p99 latency by 35%"]);
    expect(formatRoleLabel(parsed.experience[0])).toBe(
      "Senior Engineer @ Northwind"
    );
  });

  it("exports clean ATS-friendly Markdown", () => {
    const md = resumeToMarkdown({
      basics: {
        name: "Taylor Chen",
        title: "Senior Software Engineer",
        email: "taylor@example.com",
        phone: "",
        location: "Seattle, WA",
        links: ["github.com/tchen"],
        summary: "Builder of reliable web systems.",
      },
      experience: [
        {
          id: "1",
          company: "Northwind",
          role: "Senior Engineer",
          location: "Seattle, WA",
          startDate: "2023",
          endDate: "Present",
          bullets: ["Shipped v2 API"],
        },
      ],
      projects: [],
      education: [
        {
          id: "e1",
          institution: "UW",
          degree: "B.S.",
          field: "Computer Science",
          startDate: "2017",
          endDate: "2021",
          details: "",
        },
      ],
      skills: [{ category: "Core", items: ["TypeScript", "Next.js"] }],
    });

    expect(md).toContain("# Taylor Chen");
    expect(md).toContain("## Experience");
    expect(md).toContain("### Senior Engineer — Northwind");
    expect(md).toContain("- Shipped v2 API");
    expect(md).toContain("- **Core:** TypeScript, Next.js");
  });
});
