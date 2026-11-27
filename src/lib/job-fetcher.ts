import * as cheerio from "cheerio";

export type JobFetchResult =
  | {
      ok: true;
      text: string;
      pageTitle: string;
      source?: "json-ld" | "html" | "text";
    }
  | {
      ok: false;
      reason: string;
    };

const BLOCK_SIGNALS = [
  "sign in to view",
  "join now to apply",
  "enable javascript and cookies",
  "checking your browser",
  "verify you are human",
  "access denied",
  "unusual traffic",
  "please enable js",
];

function htmlFragmentToCleanText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  $("br").replaceWith("\n");
  $("p, li, h1, h2, h3, h4, h5, h6, div, section, article, tr").each((_, el) => {
    $(el).prepend("\n");
    $(el).append("\n");
  });

  return $.text()
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function findJobPostingNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPostingNode(item);
      if (found) return found;
    }
    return null;
  }

  const record = node as Record<string, unknown>;
  const typeVal = record["@type"];
  if (
    typeVal === "JobPosting" ||
    (Array.isArray(typeVal) && typeVal.includes("JobPosting"))
  ) {
    return record;
  }

  if (Array.isArray(record["@graph"])) {
    return findJobPostingNode(record["@graph"]);
  }

  return null;
}

export function extractJobPostingFromHtml(html: string): JobFetchResult {
  const $ = cheerio.load(html);
  const pageTitle = $("title").first().text().trim();

  // 1. Check JSON-LD JobPosting BEFORE stripping <script> tags
  const ldScripts = $('script[type="application/ld+json"]').toArray();
  for (const script of ldScripts) {
    const raw = $(script).html();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const job = findJobPostingNode(parsed);
      if (job && typeof job.description === "string" && job.description.trim().length > 80) {
        const title = typeof job.title === "string" ? job.title.trim() : "";
        const org =
          job.hiringOrganization &&
          typeof job.hiringOrganization === "object" &&
          typeof (job.hiringOrganization as Record<string, unknown>).name === "string"
            ? ((job.hiringOrganization as Record<string, unknown>).name as string).trim()
            : "";

        const parts: string[] = [];
        if (title || org) {
          parts.push([org, title].filter(Boolean).join(" — "));
        }
        parts.push(htmlFragmentToCleanText(job.description));

        if (typeof job.qualifications === "string" && job.qualifications.trim()) {
          parts.push("Qualifications:\n" + htmlFragmentToCleanText(job.qualifications));
        }

        const combined = parts.join("\n\n").trim();
        if (combined.length >= 120) {
          return {
            ok: true,
            text: combined.slice(0, 20000),
            pageTitle: [org, title].filter(Boolean).join(" — ") || pageTitle,
            source: "json-ld",
          };
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks and continue
    }
  }

  // 2. Fall back to cleaned HTML body with proper block-element line breaks
  $("script, style, noscript, svg, iframe, nav, footer, header, aside").remove();

  const container =
    $("main").length > 0
      ? $("main").first()
      : $("article").length > 0
        ? $("article").first()
        : $('[role="main"]').length > 0
          ? $('[role="main"]').first()
          : $("body");

  const normalized = htmlFragmentToCleanText(container.html() || "");
  const lower = normalized.toLowerCase();
  const hitBlock = BLOCK_SIGNALS.find((signal) => lower.includes(signal));

  if (hitBlock || normalized.length < 200) {
    return {
      ok: false,
      reason:
        "This site appears to require login, JavaScript rendering, or bot verification (common on LinkedIn, Indeed, and Workday). Please copy and paste the job description below.",
    };
  }

  return {
    ok: true,
    text: normalized.slice(0, 20000),
    pageTitle,
    source: "html",
  };
}

export async function fetchJobDescription(rawUrl: string): Promise<JobFetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      ok: false,
      reason:
        "Invalid URL. Please enter a full http:// or https:// link, or paste the job description directly.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: "Only http:// and https:// URLs are supported.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (response.status === 401 || response.status === 403 || response.status === 429) {
      return {
        ok: false,
        reason: `This site blocked automated fetching (HTTP ${response.status}). Please copy and paste the job description below.`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: `Could not load the page (HTTP ${response.status}). Please copy and paste the job description below.`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();

    if (contentType.includes("text/plain")) {
      const cleaned = body.trim();
      if (cleaned.length < 100) {
        return {
          ok: false,
          reason:
            "The page returned very little text. Please paste the job description directly.",
        };
      }
      return { ok: true, text: cleaned.slice(0, 20000), pageTitle: "", source: "text" };
    }

    return extractJobPostingFromHtml(body);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Timed out while fetching the job link."
        : "Could not reach this job URL.";
    return {
      ok: false,
      reason: `${message} Please copy and paste the job description below.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
