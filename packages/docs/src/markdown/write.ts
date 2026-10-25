/// <reference types="node" />
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectSitePaths } from "../entries.js";
import { docsNavSections } from "../navigation.js";
import { generateMarkdownEdition } from "./edition.js";

function htmlFileOf(sitePath: string): string {
  return sitePath === "/" ? "index.html" : `${sitePath.slice(1)}.html`;
}

/**
 * Generates the Markdown edition (edition.ts) from the pre-rendered HTML in `outDir`, writing it
 * into `outDir` and, without llms.txt and llms-full.txt, into `markdownDir`.
 */
export async function writeMarkdownEdition(outDir: string, markdownDir: string): Promise<void> {
  const htmlByPath = new Map<string, string>();
  for (const sitePath of collectSitePaths().filter((p) => p !== "/*")) {
    htmlByPath.set(sitePath, await readFile(path.join(outDir, htmlFileOf(sitePath)), "utf8"));
  }
  const { files, llmsTxt, llmsFullTxt } = generateMarkdownEdition(htmlByPath, docsNavSections);

  await rm(markdownDir, { recursive: true, force: true });
  for (const [file, markdown] of files) {
    for (const dir of [outDir, markdownDir]) {
      const target = path.join(dir, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, markdown);
    }
  }
  await writeFile(path.join(outDir, "llms.txt"), llmsTxt);
  await writeFile(path.join(outDir, "llms-full.txt"), llmsFullTxt);
}
