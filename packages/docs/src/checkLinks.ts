/// <reference types="node" />
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Build-time check of the site's internal links: every `href="/…"` must resolve to a built page
// or file, and every `#fragment` (same-page or cross-page) to an `id` on the target page.
// Links are hand-written strings in pages, navigation.ts and components, so a renamed page or
// heading would otherwise break silently.

function decodeEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function pagePathOf(file: string): string {
  const withoutExt = file
    .replace(/\.html$/, "")
    .split(path.sep)
    .join("/");
  return withoutExt === "index" ? "/" : `/${withoutExt}`;
}

/** Returns one message per broken link; an empty array means every internal link resolves. */
export async function checkInternalLinks(outDir: string): Promise<string[]> {
  const files = (await readdir(outDir, { recursive: true })).map((f) => f.toString());
  const fileSet = new Set(files.map((f) => `/${f.split(path.sep).join("/")}`));
  const pages = new Map<string, { html: string; ids: Set<string> }>();
  for (const file of files.filter((f) => f.endsWith(".html"))) {
    const html = await readFile(path.join(outDir, file), "utf8");
    const ids = new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((m) => decodeEntities(m[1]!)));
    pages.set(pagePathOf(file), { html, ids });
  }

  const errors: string[] = [];
  for (const [pagePath, { html }] of pages) {
    for (const match of html.matchAll(/\shref="([^"]*)"/g)) {
      const href = decodeEntities(match[1]!);
      if (!href.startsWith("#") && !(href.startsWith("/") && !href.startsWith("//"))) continue;
      const hashIndex = href.indexOf("#");
      const targetPath = hashIndex === -1 ? href : href.slice(0, hashIndex) || pagePath;
      const fragment = hashIndex === -1 ? "" : href.slice(hashIndex + 1);
      const target = pages.get(targetPath);
      if (target === undefined) {
        if (fragment === "" && fileSet.has(targetPath)) continue;
        errors.push(`${pagePath}: link to missing page ${href}`);
      } else if (fragment !== "" && !target.ids.has(decodeURIComponent(fragment))) {
        errors.push(`${pagePath}: link to missing anchor ${href}`);
      }
    }
  }
  return errors;
}
