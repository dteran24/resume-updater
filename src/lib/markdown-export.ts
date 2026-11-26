import { ResumeData } from "@/types/resume";

export function resumeToMarkdown(data: ResumeData): string {
  const lines: string[] = [];
  const { basics, experience, projects, education, skills } = data;

  if (basics.name) {
    lines.push(`# ${basics.name}`);
  } else {
    lines.push("# Resume");
  }

  if (basics.title) {
    lines.push(`**${basics.title}**`);
  }

  const contactParts = [
    basics.email,
    basics.phone,
    basics.location,
    ...basics.links,
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  if (contactParts.length > 0) {
    lines.push("");
    lines.push(contactParts.join(" | "));
  }

  if (basics.summary.trim()) {
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(basics.summary.trim());
  }

  if (experience.length > 0) {
    lines.push("");
    lines.push("## Experience");
    for (const exp of experience) {
      lines.push("");
      const roleHeader = [exp.role, exp.company].filter(Boolean).join(" — ");
      lines.push(`### ${roleHeader || "Role"}`);
      const meta = [
        [exp.startDate, exp.endDate].filter(Boolean).join(" – "),
        exp.location,
      ]
        .filter(Boolean)
        .join(" | ");
      if (meta) {
        lines.push(`*${meta}*`);
      }
      if (exp.bullets.length > 0) {
        lines.push("");
        for (const bullet of exp.bullets) {
          lines.push(`- ${bullet}`);
        }
      }
    }
  }

  if (projects.length > 0) {
    lines.push("");
    lines.push("## Projects");
    for (const proj of projects) {
      lines.push("");
      const title = proj.url ? `[${proj.name}](${proj.url})` : proj.name;
      lines.push(`### ${title || "Project"}`);
      if (proj.technologies.length > 0) {
        lines.push(`*Tech: ${proj.technologies.join(", ")}*`);
      }
      if (proj.description.trim()) {
        lines.push("");
        lines.push(proj.description.trim());
      }
      if (proj.bullets.length > 0) {
        lines.push("");
        for (const bullet of proj.bullets) {
          lines.push(`- ${bullet}`);
        }
      }
    }
  }

  if (education.length > 0) {
    lines.push("");
    lines.push("## Education");
    for (const edu of education) {
      lines.push("");
      const degreeLine = [edu.degree, edu.field].filter(Boolean).join(" in ");
      lines.push(`### ${edu.institution || "Education"}`);
      const meta = [
        degreeLine,
        [edu.startDate, edu.endDate].filter(Boolean).join(" – "),
      ]
        .filter(Boolean)
        .join(" | ");
      if (meta) lines.push(`*${meta}*`);
      if (edu.details.trim()) {
        lines.push("");
        lines.push(edu.details.trim());
      }
    }
  }

  if (skills.length > 0) {
    lines.push("");
    lines.push("## Skills");
    lines.push("");
    for (const group of skills) {
      if (group.items.length === 0) continue;
      lines.push(`- **${group.category || "Skills"}:** ${group.items.join(", ")}`);
    }
  }

  return lines.join("\n").trim() + "\n";
}
