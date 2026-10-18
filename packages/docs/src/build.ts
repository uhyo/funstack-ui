/// <reference types="node" />
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { BuildEntryFunction } from "@funstack/static/server";
import { guardBuild } from "./buildGuard.js";
import { collectSitePaths } from "./entries.js";
import { SITE_URL } from "./pageMeta.js";

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
  // guardBuild fails the build on Server Components and prerender errors, which @funstack/static
  // only logs (#72).
  await Promise.all([
    guardBuild(build, outDir),
    writeFile(path.join(outDir, "sitemap.xml"), generateSitemap()),
  ]);
}) satisfies BuildEntryFunction;
