/// <reference types="node" />
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { BuildEntryFunction } from "@funstack/static/server";
import { checkInternalLinks } from "./checkLinks.js";
import { collectSitePaths } from "./entries.js";
import { writeMarkdownEdition } from "./markdown/edition.js";
import { SITE_URL } from "./site.js";

function generateSitemap(): string {
  const pagePaths = collectSitePaths().filter((p) => p !== "/*");
  const urls = pagePaths
    .map((p) => `  <url><loc>${new URL(p, SITE_URL).href}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export default (async ({ build, outDir }) => {
  // Render errors (RSC, deferred components, prerendering) fail the build in @funstack/static
  // itself: `failOnRenderError` is on by default since 1.3.3 (#72).
  await Promise.all([build(), writeFile(path.join(outDir, "sitemap.xml"), generateSitemap())]);
  // Next to dist/public: the copy that @funstack/ui bundles as dist/docs.
  await writeMarkdownEdition(outDir, path.join(outDir, "..", "markdown"));
  const brokenLinks = await checkInternalLinks(outDir);
  if (brokenLinks.length > 0) {
    throw new Error(`Broken internal links:\n${brokenLinks.join("\n")}`);
  }
}) satisfies BuildEntryFunction;
