import dns from "dns/promises";
import net from "net";
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

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 3;

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

export function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.trim().toLowerCase();

  // Handle IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (cleaned.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(cleaned.slice(7));
  }

  if (net.isIPv4(cleaned)) {
    const parts = cleaned.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  if (net.isIPv6(cleaned)) {
    if (cleaned === "::" || cleaned === "::1") return true;
    if (cleaned.startsWith("fc") || cleaned.startsWith("fd")) return true; // fc00::/7 ULA
    if (
      cleaned.startsWith("fe8") ||
      cleaned.startsWith("fe9") ||
      cleaned.startsWith("fea") ||
      cleaned.startsWith("feb")
    ) {
      return true; // fe80::/10 link-local
    }
    if (cleaned.startsWith("ff")) return true; // multicast
    return false;
  }

  return true;
}

export function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(
      "Invalid URL. Please enter a full http:// or https:// link, or paste the job description directly."
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are supported.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs with embedded credentials are not allowed.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Private or local network URLs are not allowed.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("Private or internal IP addresses are not allowed.");
    }
    return parsed;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Could not resolve this domain. Please paste the job description directly.");
  }

  if (!addresses.length || addresses.some((a) => isPrivateOrReservedIp(a.address))) {
    throw new Error("URL resolved to a private or blocked network address.");
  }

  return parsed;
}

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
            text: combined.slice(0, 15000),
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
    text: normalized.slice(0, 15000),
    pageTitle,
    source: "html",
  };
}

async function readResponseWithLimit(response: Response): Promise<string> {
  if (!response.body) {
    return (await response.text()).slice(0, MAX_RESPONSE_BYTES);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("The job page is too large to fetch. Please copy and paste the job description below.");
    }
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

export async function fetchJobDescription(rawUrl: string): Promise<JobFetchResult> {
  let currentUrl: URL;
  try {
    currentUrl = await assertSafePublicUrl(rawUrl);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "URL is not allowed.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    let response: Response | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop === MAX_REDIRECTS) {
          return {
            ok: false,
            reason:
              "Too many redirects while loading this job link. Please paste the job description below.",
          };
        }
        const resolved = new URL(location, currentUrl).toString();
        currentUrl = await assertSafePublicUrl(resolved);
        continue;
      }

      break;
    }

    if (!response) {
      return {
        ok: false,
        reason: "Could not load the job link. Please paste the job description below.",
      };
    }

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
    const body = await readResponseWithLimit(response);

    if (contentType.includes("text/plain")) {
      const cleaned = body.trim();
      if (cleaned.length < 100) {
        return {
          ok: false,
          reason:
            "The page returned very little text. Please paste the job description directly.",
        };
      }
      return { ok: true, text: cleaned.slice(0, 15000), pageTitle: "", source: "text" };
    }

    return extractJobPostingFromHtml(body);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Timed out while fetching the job link."
        : err instanceof Error
          ? err.message
          : "Could not reach this job URL.";
    return {
      ok: false,
      reason: message.includes("paste")
        ? message
        : `${message} Please copy and paste the job description below.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
