import { describe, expect, it } from "vitest";
import { applySuggestedEditToggle } from "@/lib/suggested-edits";
import { EMPTY_RESUME_DATA, type ResumeData, type SuggestedEdit } from "@/types/resume";

const SAMPLE_RESUME: ResumeData = {
  ...EMPTY_RESUME_DATA,
  basics: {
    ...EMPTY_RESUME_DATA.basics,
    name: "Jordan Lee",
    summary: "Tailored backend engineer focused on distributed systems.",
  },
  experience: [
    {
      id: "exp-1",
      company: "Acme Corp",
      role: "Senior Engineer",
      location: "Remote",
      startDate: "Jan 2023",
      endDate: "Present",
      bullets: [
        "Reduced API p99 latency by 40% by migrating hot endpoints to Redis caching.",
        "Built webhook retry worker handling 2M daily events.",
      ],
    },
  ],
  skills: [{ category: "Backend", items: ["TypeScript", "Go", "PostgreSQL"] }],
};

describe("applySuggestedEditToggle", () => {
  it("reverts and reapplies a rewritten experience bullet", () => {
    const edit: SuggestedEdit = {
      id: "e1",
      section: "experience",
      targetLabel: "Senior Engineer @ Acme Corp",
      action: "rewrite",
      before: "Made the API faster using Redis.",
      after: "Reduced API p99 latency by 40% by migrating hot endpoints to Redis caching.",
      reason: "Uses impact-first phrasing with real metric.",
      sourcePoolIds: [],
      accepted: true,
    };

    const rejected = applySuggestedEditToggle(SAMPLE_RESUME, edit, false);
    expect(rejected.experience[0].bullets[0]).toBe("Made the API faster using Redis.");

    const reaccepted = applySuggestedEditToggle(rejected, edit, true);
    expect(reaccepted.experience[0].bullets[0]).toBe(
      "Reduced API p99 latency by 40% by migrating hot endpoints to Redis caching."
    );
  });

  it("removes and re-adds an added experience bullet", () => {
    const edit: SuggestedEdit = {
      id: "e2",
      section: "experience",
      targetLabel: "Senior Engineer @ Acme Corp",
      action: "add",
      before: "",
      after: "Built webhook retry worker handling 2M daily events.",
      reason: "Directly matches JD event-driven architecture requirement.",
      sourcePoolIds: ["pool-1"],
      accepted: true,
    };

    const rejected = applySuggestedEditToggle(SAMPLE_RESUME, edit, false);
    expect(rejected.experience[0].bullets).toHaveLength(1);

    const reaccepted = applySuggestedEditToggle(rejected, edit, true);
    expect(reaccepted.experience[0].bullets).toContain(
      "Built webhook retry worker handling 2M daily events."
    );
  });

  it("toggles summary edits cleanly", () => {
    const edit: SuggestedEdit = {
      id: "e3",
      section: "summary",
      targetLabel: "Summary",
      action: "rewrite",
      before: "Generalist software engineer.",
      after: "Tailored backend engineer focused on distributed systems.",
      reason: "Aligns summary to backend role.",
      sourcePoolIds: [],
      accepted: true,
    };

    const rejected = applySuggestedEditToggle(SAMPLE_RESUME, edit, false);
    expect(rejected.basics.summary).toBe("Generalist software engineer.");

    const reaccepted = applySuggestedEditToggle(rejected, edit, true);
    expect(reaccepted.basics.summary).toBe(
      "Tailored backend engineer focused on distributed systems."
    );
  });
});
