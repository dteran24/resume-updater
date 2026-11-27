import { describe, expect, it } from "vitest";
import { extractJobPostingFromHtml } from "@/lib/job-fetcher";

describe("extractJobPostingFromHtml", () => {
  it("extracts structured JSON-LD JobPosting data before stripping scripts", () => {
    const html = `
      <html>
        <head>
          <title>Careers</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@type": "JobPosting",
              "title": "Staff Backend Engineer",
              "hiringOrganization": { "@type": "Organization", "name": "Stripe" },
              "description": "<p>Build resilient payment APIs.</p><ul><li>TypeScript and Go</li><li>Distributed queues and PostgreSQL</li><li>High-availability microservices at global scale</li></ul>"
            }
          </script>
        </head>
        <body><div id="app">Loading...</div></body>
      </html>
    `;

    const result = extractJobPostingFromHtml(html);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("json-ld");
      expect(result.pageTitle).toBe("Stripe — Staff Backend Engineer");
      expect(result.text).toContain("Stripe — Staff Backend Engineer");
      expect(result.text).toContain("TypeScript and Go\nDistributed queues and PostgreSQL");
    }
  });

  it("preserves line breaks between adjacent HTML block elements", () => {
    const html = `
      <html>
        <head><title>Senior Engineer — Acme</title></head>
        <body>
          <main>
            <h1>Senior Full-Stack Engineer</h1>
            <p>We are hiring an engineer to own core product workflows and API reliability across our web platform.</p>
            <ul>
              <li>TypeScript</li>
              <li>Next.js</li>
              <li>PostgreSQL and SQLite</li>
              <li>Strong product intuition and ownership</li>
            </ul>
          </main>
        </body>
      </html>
    `;

    const result = extractJobPostingFromHtml(html);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("html");
      expect(result.text).toContain("TypeScript\nNext.js\nPostgreSQL and SQLite");
      expect(result.text).not.toContain("TypeScriptNext.js");
    }
  });
});
