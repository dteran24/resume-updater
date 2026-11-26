import * as cheerio from "cheerio";

export type JobFetchResult =
  | {
      ok: true;
      text: string;
      pageTitle: string;
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

export async function fetchJobDescription(rawUrl: string): Promise<JobFetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      ok: false,
      reason: "Invalid URL. Please enter a full http:// or https:// link, or paste the job description directly.",
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
          reason: "The page returned very little text. Please paste the job description directly.",
        };
      }
      return { ok: true, text: cleaned.slice(0, 20000), pageTitle: "" };
    }

    const $ = cheerio.load(body);
    const pageTitle = $("title").first().text().trim();

    $("script, style, noscript, svg, iframe, nav, footer, header, aside").remove();

    const mainText =
      $("main").text() ||
      $("article").text() ||
      $('[role="main"]').text() ||
      $("body").text();

    const normalized = mainText
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");

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
    };
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
