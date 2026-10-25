import type { List, Nodes } from "mdast";
import { toMarkdown } from "mdast-util-to-markdown";
import type { NavSection } from "../navigation.js";
import { SITE_NAME, SITE_URL } from "../site.js";
import { pageToMarkdown } from "./htmlToMarkdown.js";
import { linkResolver, markdownFileOf } from "./paths.js";

// The Markdown edition of the site (#134), generated from the pre-rendered pages:
// - `<page>.md` next to every `<page>.html`, with links between pages as relative `.md` paths.
//   The home page's `index.md` ends with an index of every page, so it is the entry point.
// - `/llms.txt` (https://llmstxt.org) and `/llms-full.txt` (every page, in navigation order),
//   with absolute URLs.
// write.ts writes it to disk, and the `.md` files to a separate directory too, from which
// `@funstack/ui` copies them into its npm package as `dist/docs` (packages/ui/scripts/copy-docs.mjs).

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

export interface MarkdownEdition {
  /** The `.md` files by path relative to the site root (`components/dialog.md`). */
  files: Map<string, string>;
  llmsTxt: string;
  llmsFullTxt: string;
}

/** The fragment ids that links on the site point to, per target page. */
function linkedIds(htmlByPath: ReadonlyMap<string, string>): Map<string, Set<string>> {
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
function indexSections(
  pages: Map<string, Page>,
  navSections: readonly NavSection[],
): IndexSection[] {
  const listed = new Set<string>();
  const sections: IndexSection[] = [];
  for (const section of navSections) {
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

function serialize(node: Nodes): string {
  return toMarkdown(node, { bullet: "-" }).trimEnd();
}

/** "- [label](link): description" per page, escaped (descriptions mention `<dialog>`). */
function indexList(pages: Page[], link: (page: Page) => string): string {
  const list: List = {
    type: "list",
    spread: false,
    children: pages.map((page) => ({
      type: "listItem",
      spread: false,
      children: [
        {
          type: "paragraph",
          children: [
            { type: "link", url: link(page), children: [{ type: "text", value: page.label }] },
            { type: "text", value: `: ${page.description}` },
          ],
        },
      ],
    })),
  };
  return serialize(list);
}

function llmsTxt(home: Page, sections: IndexSection[]): string {
  const url = (file: string) => new URL(file, SITE_URL).href;
  const parts = [
    `# ${SITE_NAME}`,
    serialize({
      type: "blockquote",
      children: [{ type: "paragraph", children: [{ type: "text", value: home.description }] }],
    }),
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
 * Generates the Markdown edition from the pre-rendered HTML of every page (by site path), with
 * pages grouped as in `navSections`. Throws when a page yields no content or no description.
 */
export function generateMarkdownEdition(
  htmlByPath: ReadonlyMap<string, string>,
  navSections: readonly NavSection[],
): MarkdownEdition {
  const pagePaths = new Set(htmlByPath.keys());
  const labels = new Map(
    navSections.flatMap((section) => section.items).map((item) => [item.path, item.label]),
  );
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
    const file = markdownFileOf(sitePath);
    // llms-full.txt leaves the demo stylesheets out; the page's own .md has them.
    const absoluteMarkdown = pageToMarkdown(html, {
      resolveLink: linkResolver(sitePath, pagePaths, false),
      anchors,
      stylesheetsAt: new URL(file, SITE_URL).href,
    }).markdown;
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

  const sections = indexSections(pages, navSections);
  const home = pages.get("/");
  if (home === undefined) throw new Error("Markdown edition: no home page");
  // The home page doubles as the entry point of the edition (the npm package's dist/docs/index.md).
  const relativeIndex = sections
    .map((section) => `### ${section.label}\n\n${indexList(section.pages, (page) => page.file)}`)
    .join("\n\n");
  home.markdown = `${home.markdown}\n## All pages\n\n${relativeIndex}\n`;

  return {
    files: new Map([...pages.values()].map((page) => [page.file, page.markdown])),
    llmsTxt: llmsTxt(home, sections),
    llmsFullTxt: llmsFullTxt(sections),
  };
}
