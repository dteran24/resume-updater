import { formatRoleLabel, type ResumeData, type SuggestedEdit } from "@/types/resume";

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function findMatchingExperienceIndex(
  data: ResumeData,
  targetLabel: string,
  bulletNeedle?: string
): number {
  const targetNorm = norm(targetLabel);
  if (targetNorm) {
    const exact = data.experience.findIndex(
      (exp) =>
        norm(formatRoleLabel(exp)) === targetNorm ||
        norm(exp.company) === targetNorm ||
        targetNorm.includes(norm(exp.company))
    );
    if (exact >= 0) return exact;
  }

  if (bulletNeedle) {
    const needleNorm = norm(bulletNeedle);
    const byBullet = data.experience.findIndex((exp) =>
      exp.bullets.some((b) => norm(b) === needleNorm)
    );
    if (byBullet >= 0) return byBullet;
  }

  return data.experience.length > 0 ? 0 : -1;
}

function findMatchingProjectIndex(
  data: ResumeData,
  targetLabel: string,
  bulletNeedle?: string
): number {
  const targetNorm = norm(targetLabel);
  if (targetNorm) {
    const exact = data.projects.findIndex(
      (p) => norm(p.name) === targetNorm || targetNorm.includes(norm(p.name))
    );
    if (exact >= 0) return exact;
  }

  if (bulletNeedle) {
    const needleNorm = norm(bulletNeedle);
    const byBullet = data.projects.findIndex((p) =>
      p.bullets.some((b) => norm(b) === needleNorm)
    );
    if (byBullet >= 0) return byBullet;
  }

  return data.projects.length > 0 ? 0 : -1;
}

function toggleBulletList(
  bullets: string[],
  action: SuggestedEdit["action"],
  before: string,
  after: string,
  accept: boolean
): string[] {
  const next = [...bullets];
  const beforeClean = before.trim();
  const afterClean = after.trim();

  if (action === "add") {
    if (accept) {
      if (afterClean && !next.some((b) => norm(b) === norm(afterClean))) {
        next.push(afterClean);
      }
    } else if (afterClean) {
      return next.filter((b) => norm(b) !== norm(afterClean));
    }
    return next;
  }

  if (action === "remove") {
    if (accept) {
      return beforeClean ? next.filter((b) => norm(b) !== norm(beforeClean)) : next;
    } else if (beforeClean && !next.some((b) => norm(b) === norm(beforeClean))) {
      next.push(beforeClean);
    }
    return next;
  }

  // rewrite
  const fromText = accept ? beforeClean : afterClean;
  const toText = accept ? afterClean : beforeClean;
  if (!toText) return next;

  const idx = fromText ? next.findIndex((b) => norm(b) === norm(fromText)) : -1;
  if (idx >= 0) {
    next[idx] = toText;
    return next;
  }

  if (!next.some((b) => norm(b) === norm(toText))) {
    next.push(toText);
  }
  return next;
}

export function applySuggestedEditToggle(
  data: ResumeData,
  edit: SuggestedEdit,
  accept: boolean
): ResumeData {
  const next = structuredClone(data);

  if (edit.section === "summary") {
    if (edit.action === "remove") {
      next.basics.summary = accept ? "" : edit.before.trim();
    } else if (edit.action === "add") {
      next.basics.summary = accept ? edit.after.trim() : edit.before.trim();
    } else {
      next.basics.summary = accept ? edit.after.trim() : edit.before.trim();
    }
    return next;
  }

  if (edit.section === "experience") {
    const needle = accept ? edit.before : edit.after;
    const idx = findMatchingExperienceIndex(next, edit.targetLabel, needle);
    if (idx < 0) return next;
    next.experience[idx].bullets = toggleBulletList(
      next.experience[idx].bullets,
      edit.action,
      edit.before,
      edit.after,
      accept
    );
    return next;
  }

  if (edit.section === "projects") {
    const needle = accept ? edit.before : edit.after;
    const idx = findMatchingProjectIndex(next, edit.targetLabel, needle);
    if (idx < 0) return next;
    next.projects[idx].bullets = toggleBulletList(
      next.projects[idx].bullets,
      edit.action,
      edit.before,
      edit.after,
      accept
    );
    return next;
  }

  if (edit.section === "skills") {
    const itemsToApply = (accept ? edit.after : edit.before)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const itemsToRemove = (accept ? edit.before : edit.after)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const targetNorm = norm(edit.targetLabel);
    let idx = next.skills.findIndex(
      (g) => norm(g.category) === targetNorm || targetNorm.includes(norm(g.category))
    );
    if (idx < 0 && next.skills.length > 0) idx = 0;
    if (idx < 0 && itemsToApply.length > 0) {
      next.skills.push({
        category: edit.targetLabel || "Skills",
        items: itemsToApply,
      });
      return next;
    }
    if (idx >= 0) {
      let updated = [...next.skills[idx].items];
      if (edit.action === "add") {
        if (accept) {
          for (const item of itemsToApply) {
            if (!updated.some((u) => norm(u) === norm(item))) updated.push(item);
          }
        } else {
          const removeSet = new Set(itemsToRemove.map(norm));
          updated = updated.filter((u) => !removeSet.has(norm(u)));
        }
      } else if (edit.action === "remove") {
        if (accept) {
          const removeSet = new Set(itemsToRemove.map(norm));
          updated = updated.filter((u) => !removeSet.has(norm(u)));
        } else {
          for (const item of itemsToApply) {
            if (!updated.some((u) => norm(u) === norm(item))) updated.push(item);
          }
        }
      } else if (itemsToApply.length > 0) {
        updated = itemsToApply;
      }
      next.skills[idx].items = updated;
    }
    return next;
  }

  return next;
}
