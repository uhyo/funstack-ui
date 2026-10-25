/// <reference types="node" />
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectSitePaths } from "../entries.js";
import { docsNavSections } from "../navigation.js";
import { SITE_NAME, SITE_URL } from "../site.js";
import { pageToMarkdown } from "./htmlToMarkdown.js";
import { linkResolver, markdownFileOf } from "./paths.js";

// The Markdown edition of the site (#134), generated from the pre-rendered pages:
// - `<page>.md` next to every `<page>.html`, with links between pages as relative `.md` paths.
//   The home page's `index.md` ends with an index of every page, so it is the entry point.
// - `/llms.txt` (https://llmstxt.org) and `/llms-full.txt` (every page, in navigation order),
//   with absolute URLs.
// The same `.md` files are written to a separate directory too, from which `@funstack/ui` copies
// them into its npm package as `dist/docs` (packages/ui/scripts/copy-docs.mjs).

interface Page {
  /** The site path, e.g. `/components/dialog`. */
  path: string;
  /** The Markdown file, relative to the site root, e.g. `components/dialog.md`. */
  file: string;
  /** The link text in indexes: the sidebar label. */
  label: string;
  title: string;
  description: string;
  /** The page with relative links, for the `.md` files. */
  markdown: string;
  /** The page with absolute links, for llms-full.txt. */
  absoluteMarkdown: string;
}

interface IndexSection {
  label: string;
  pages: Page[];
}

function htmlFileOf(sitePath: string): string {
  return sitePath === "/" ? "index.html" : `${sitePath.slice(1)}.html`;
}

/** The fragment ids that links on the site point to, per target page. */
function linkedIds(htmlByPath: Map<string, string>): Map<string, Set<string>> {
  const ids = new Map<string, Set<string>>();
  for (const [fromPath, html] of htmlByPath) {
    for (const [, href] of html.matchAll(/\shref="([^"]*#[^"]*)"/g)) {
      const hashIndex = href!.indexOf("#");
      const targetPath = href!.slice(0, hashIndex).split("?")[0] || fromPath;
      let id;
      try {
        id = decodeURIComponent(href!.slice(hashIndex + 1).replaceAll("&amp;", "&"));
      } catch {
        continue;
      }
      if (!ids.has(targetPath)) ids.set(targetPath, new Set());
      ids.get(targetPath)!.add(id);
    }
  }
  return ids;
}

/** The pages grouped as in the sidebar; pages missing from it are listed last. */
function indexSections(pages: Map<string, Page>): IndexSection[] {
  const listed = new Set<string>();
  const sections: IndexSection[] = [];
  for (const section of docsNavSections) {
    const sectionPages: Page[] = [];
    for (const item of section.items) {
      const page = pages.get(item.path);
      if (item.external || page === undefined) continue;
      sectionPages.push(page);
      listed.add(item.path);
    }
    if (sectionPages.length > 0) sections.push({ label: section.label, pages: sectionPages });
  }
  const rest = [...pages.values()].filter((page) => !listed.has(page.path));
  if (rest.length > 0) sections.push({ label: "Other pages", pages: rest });
  return sections;
}

function indexList(pages: Page[], link: (page: Page) => string): string {
  return pages.map((page) => `- [${page.label}](${link(page)}): ${page.description}`).join("\n");
}

function llmsTxt(home: Page, sections: IndexSection[]): string {
  const url = (file: string) => new URL(file, SITE_URL).href;
  const parts = [
    `# ${SITE_NAME}`,
    `> ${home.description}`,
    [
      "Install with `npm install @funstack/ui@alpha`; React 19.3 or later is a peer dependency.",
      'Each component is imported from its own subpath, for example `import { Dialog } from "@funstack/ui/dialog"`.',
      `Each page below is the Markdown version of the HTML page at the same URL without \`.md\`. [llms-full.txt](${url("llms-full.txt")}) contains every page in one file.`,
    ].join(" "),
  ];
  for (const section of sections) {
    // In llms.txt, an "Optional" section holds what can be skipped when context is short.
    const label = section.label === "Resources" ? "Optional" : section.label;
    parts.push(`## ${label}\n\n${indexList(section.pages, (page) => url(page.file))}`);
  }
  return `${parts.join("\n\n")}\n`;
}

function llmsFullTxt(sections: IndexSection[]): string {
  const pages = sections.flatMap((section) => section.pages);
  return pages
    .map((page) => {
      // Each page starts with its `#` title; its URL follows, so a reader can cite it.
      const [title, ...body] = page.absoluteMarkdown.split("\n");
      return [title, "", `URL: ${new URL(page.file, SITE_URL).href}`, ...body].join("\n");
    })
    .join("\n");
}

/**
 * Generates the Markdown edition from the pre-rendered HTML in `outDir`, writing it into
 * `outDir` and, without llms.txt and llms-full.txt, into `markdownDir`. Throws when a page
 * yields no content.
 */
export async function writeMarkdownEdition(outDir: string, markdownDir: string): Promise<void> {
  const pagePaths = new Set(collectSitePaths().filter((p) => p !== "/*"));
  const labels = new Map(
    docsNavSections.flatMap((section) => section.items).map((item) => [item.path, item.label]),
  );
  const htmlByPath = new Map<string, string>();
  for (const sitePath of pagePaths) {
    htmlByPath.set(sitePath, await readFile(path.join(outDir, htmlFileOf(sitePath)), "utf8"));
  }
  const anchorsByPath = linkedIds(htmlByPath);
  const pages = new Map<string, Page>();
  for (const [sitePath, html] of htmlByPath) {
    const anchors = anchorsByPath.get(sitePath);
    let converted;
    try {
      converted = pageToMarkdown(html, {
        resolveLink: linkResolver(sitePath, pagePaths, true),
        anchors,
      });
    } catch (error) {
      throw new Error(`Markdown edition: ${sitePath}: ${(error as Error).message}`);
    }
    const { title, description, markdown } = converted;
    // The first line is the title; a page needs content after it.
    if (markdown.split("\n").slice(1).join("").trim() === "") {
      throw new Error(`Markdown edition: ${sitePath} produced no content`);
    }
    if (description === "") {
      throw new Error(`Markdown edition: ${sitePath} has no description`);
    }
    const absoluteMarkdown = pageToMarkdown(html, {
      resolveLink: linkResolver(sitePath, pagePaths, false),
      anchors,
    }).markdown;
    const file = markdownFileOf(sitePath);
    const label = labels.get(sitePath) ?? title;
    pages.set(sitePath, {
      path: sitePath,
      file,
      label,
      title,
      description,
      markdown,
      absoluteMarkdown,
    });
  }

  const sections = indexSections(pages);
  const home = pages.get("/");
  if (home === undefined) throw new Error("Markdown edition: no home page");
  // The home page doubles as the entry point of the edition (the npm package's dist/docs/index.md).
  const relativeIndex = sections
    .map((section) => `### ${section.label}\n\n${indexList(section.pages, (page) => page.file)}`)
    .join("\n\n");
  home.markdown = `${home.markdown}\n## All pages\n\n${relativeIndex}\n`;

  await rm(markdownDir, { recursive: true, force: true });
  for (const page of pages.values()) {
    for (const dir of [outDir, markdownDir]) {
      const file = path.join(dir, page.file);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, page.markdown);
    }
  }
  await writeFile(path.join(outDir, "llms.txt"), llmsTxt(home, sections));
  await writeFile(path.join(outDir, "llms-full.txt"), llmsFullTxt(sections));
}
