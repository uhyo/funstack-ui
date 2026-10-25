import type { Element, ElementContent, Root as HastRoot, RootContent } from "hast";
import type {
  Blockquote,
  Code,
  Html,
  List,
  ListItem,
  Nodes,
  Paragraph,
  PhrasingContent,
  Strong,
} from "mdast";
import { fromHtml } from "hast-util-from-html";
import { select, selectAll } from "hast-util-select";
import { defaultHandlers, toMdast, type Handle } from "hast-util-to-mdast";
import { toString } from "hast-util-to-string";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

// Converts a pre-rendered page of the docs site to Markdown, for the Markdown edition (#134).
// It works on the rendered HTML rather than the page TSX because the TSX pulls example sources
// through `?raw` imports and props tables from shared modules, which a reader of the TSX cannot
// follow. The conversion knows the markup of the site's own components (src/components): keep
// them in sync.

/** Site chrome and interactive widgets, removed before conversion. */
const strippedSelector = [
  // The documentation sidebar.
  ".docs-sidebar",
  // A live example's rendered DOM. Its source follows in the same figure and is kept as code.
  ".example-preview",
  // The "Show code" label of an example's source.
  ".example-source > summary",
  // The jump links to a component page's behaviour sections.
  ".behaviour-index",
  // The home page hero's image and buttons.
  ".hero-image",
  ".hero-buttons",
  "script",
  "style",
  "template",
].join(", ");

export interface PageMarkdown {
  /** The text of the page's first heading. */
  title: string;
  /** The page's `<meta name="description">`. */
  description: string;
  markdown: string;
}

export interface PageToMarkdownOptions {
  /** Maps the `href` of every link in the content, e.g. a site path to a `.md` file. */
  resolveLink?: (href: string) => string;
  /**
   * Ids that links point to. Markdown has no ids, so each of these gets an `<a id>` anchor
   * unless it is a heading's id that equals the slug Markdown renderers derive from its text.
   */
  anchors?: ReadonlySet<string>;
  /**
   * When set, an example's stylesheet (a titled CSS block) is left out and replaced by a line
   * pointing to this URL, the page's own Markdown (for llms-full.txt).
   */
  stylesheetsAt?: string;
}

/** The element standing for an `<a id>` anchor until conversion (see {@link anchor}). */
const anchorTagName = "md-anchor";

/** The heading slug GitHub and most Markdown renderers generate. */
function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function hasClass(node: Element, className: string): boolean {
  const value = node.properties.className;
  return Array.isArray(value) && value.includes(className);
}

function isElement(node: RootContent | ElementContent): node is Element {
  return node.type === "element";
}

/** Removes `nodes` and every comment (React's text separators and Suspense markers). */
function removeAll(parent: HastRoot | Element, nodes: Set<Element>): void {
  parent.children = parent.children.filter(
    (child) => child.type !== "comment" && !(isElement(child) && nodes.has(child)),
  ) as typeof parent.children;
  for (const child of parent.children) {
    if (isElement(child)) removeAll(child, nodes);
  }
}

/**
 * Puts the content React streamed after the shell back where it belongs. A deferred page is
 * rendered as `<template id="B:0">` in place, with its content in `<div hidden id="S:0">` at the
 * end of the body and a `$RC("B:0","S:0")` script call that swaps them in the browser.
 */
function resolveStreamedBoundaries(tree: HastRoot): void {
  const scripts = selectAll("script", tree)
    .map((script) => toString(script))
    .join("\n");
  for (const [, boundaryId, segmentId] of scripts.matchAll(/\$RC\("([^"]+)","([^"]+)"\)/g)) {
    const segment = select(`[id="${segmentId}"]`, tree);
    if (segment === undefined) continue;
    replaceElement(tree, (node) => node.properties.id === boundaryId, segment.children);
    replaceElement(tree, (node) => node === segment, []);
  }
}

function replaceElement(
  parent: HastRoot | Element,
  test: (node: Element) => boolean,
  replacement: ElementContent[],
): boolean {
  const index = parent.children.findIndex((child) => isElement(child) && test(child));
  if (index !== -1) {
    parent.children.splice(index, 1, ...replacement);
    return true;
  }
  return parent.children.some(
    (child) => isElement(child) && replaceElement(child, test, replacement),
  );
}

const anchor: Handle = (state, node) => {
  const result: Html = { type: "html", value: `<a id="${String(node.properties.id)}"></a>` };
  state.patch(node, result);
  return result;
};

// `CodeBlock`: shiki's highlighted <pre>, with the language and an optional file name.
const div: Handle = (state, node) => {
  if (!hasClass(node, "code-block")) return defaultHandlers.div(state, node);
  const pre = select("pre", node);
  const title = select(".code-block-title", node);
  const language = node.properties.dataLanguage;
  const result: Code = {
    type: "code",
    lang: typeof language === "string" ? language : null,
    meta: title === undefined ? null : `title="${toString(title)}"`,
    value: pre === undefined ? "" : toString(pre).replace(/\n+$/, ""),
  };
  state.patch(node, result);
  return result;
};

// `Callout`: a blockquote led by its title in bold (or "Note" / "Warning"), and its anchor.
const aside: Handle = (state, node) => {
  if (!hasClass(node, "callout")) return defaultHandlers.aside(state, node);
  const isAnchor = (child: ElementContent) => isElement(child) && child.tagName === anchorTagName;
  const titleElement = node.children.find(
    (child) => isElement(child) && hasClass(child, "callout-title"),
  );
  const title: PhrasingContent[] =
    titleElement === undefined
      ? [{ type: "text", value: hasClass(node, "warning") ? "Warning" : "Note" }]
      : (state.all(titleElement as Element) as PhrasingContent[]);
  const anchors = state.all({ ...node, children: node.children.filter(isAnchor) });
  const body = node.children.filter((child) => child !== titleElement && !isAnchor(child));
  const heading: Paragraph = {
    type: "paragraph",
    children: [...(anchors as PhrasingContent[]), { type: "strong", children: title }],
  };
  const result: Blockquote = {
    type: "blockquote",
    children: [heading, ...state.toFlow(state.all({ ...node, children: body }))],
  };
  state.patch(node, result);
  return result;
};

// Definition lists (the `Terms` of concept pages, the State/Owned facts after a props table):
// a list of "**term**: definition" items, which reads better than Markdown's default of the term
// and the definition as separate paragraphs.
const dl: Handle = (state, node) => {
  const entries = node.children.flatMap((child) =>
    isElement(child) && child.tagName === "div" ? child.children : [child],
  );
  const items: ListItem[] = [];
  for (const entry of entries) {
    if (!isElement(entry)) continue;
    if (entry.tagName === "dt") {
      const term: Strong = { type: "strong", children: state.all(entry) as PhrasingContent[] };
      items.push({
        type: "listItem",
        spread: false,
        children: [{ type: "paragraph", children: [term] }],
      });
    } else if (entry.tagName === "dd") {
      const item = items.at(-1);
      if (item === undefined) continue;
      const blocks = state.toFlow(state.all(entry));
      const [first, ...rest] = blocks;
      const lead = item.children[0] as Paragraph;
      if (first?.type === "paragraph") {
        lead.children.push({ type: "text", value: ": " }, ...first.children);
        item.children.push(...rest);
      } else {
        item.children.push(...blocks);
      }
      item.spread = item.children.length > 1;
    }
  }
  const result: List = {
    type: "list",
    ordered: false,
    spread: items.some((item) => item.spread),
    children: items,
  };
  state.patch(node, result);
  return result;
};

/** A one-line stand-in for a titled code block: "`title`: text". */
function codeReference(meta: string, text: PhrasingContent[]): Paragraph {
  const title = /title="([^"]*)"/.exec(meta)?.[1] ?? "";
  return { type: "paragraph", children: [{ type: "inlineCode", value: title }, ...text] };
}

/**
 * Replaces a titled code block that repeats an earlier one on the page (examples that share a
 * stylesheet show it with each example) with a reference to it, and with `stylesheetsAt`, every
 * example stylesheet with a link to the page's Markdown.
 */
function shortenCodeBlocks(
  node: Nodes,
  stylesheetsAt: string | undefined,
  seen = new Set<string>(),
): void {
  if (!("children" in node)) return;
  node.children = node.children.map((child) => {
    if (child.type !== "code" || child.meta === null || child.meta === undefined) return child;
    if (stylesheetsAt !== undefined && child.lang === "css") {
      return codeReference(child.meta, [
        { type: "text", value: ": the example's stylesheet, in " },
        {
          type: "link",
          url: stylesheetsAt,
          children: [{ type: "text", value: "the page's Markdown" }],
        },
        { type: "text", value: "." },
      ]);
    }
    const key = `${child.meta}\n${child.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      return child;
    }
    return codeReference(child.meta, [{ type: "text", value: ": the same file as above." }]);
  }) as typeof node.children;
  for (const child of node.children) shortenCodeBlocks(child, stylesheetsAt, seen);
}

/**
 * Converts one page of the site. The content is the page's `<main>` minus the site chrome; its
 * headings are shifted so that the page title becomes the single `#` heading.
 */
export function pageToMarkdown(html: string, options: PageToMarkdownOptions = {}): PageMarkdown {
  const tree = fromHtml(html);
  resolveStreamedBoundaries(tree);
  const main = select("main", tree);
  if (main === undefined) throw new Error("The page has no <main> element");
  if (select('template[id^="B:"]', main) !== undefined) {
    throw new Error("The page has unresolved Suspense content");
  }
  removeAll(main, new Set(selectAll(strippedSelector, main)));

  // A heading inside a list item (the home page's principles) becomes the item's bold lead.
  for (const heading of selectAll("li :is(h1, h2, h3, h4, h5, h6)", main)) {
    heading.children = [
      { type: "element", tagName: "strong", properties: {}, children: heading.children },
    ];
    heading.tagName = "p";
  }
  const headings = selectAll("h1, h2, h3, h4, h5, h6", main);
  const titleHeading = headings[0];
  if (titleHeading === undefined) throw new Error("The page has no heading");
  const shift = Number(titleHeading.tagName[1]) - 1;
  for (const heading of headings) {
    heading.tagName = `h${Math.max(1, Number(heading.tagName[1]) - shift)}`;
  }

  const { resolveLink, anchors = new Set() } = options;
  for (const element of selectAll("[id]", main)) {
    const id = String(element.properties.id);
    if (!anchors.has(id)) continue;
    if (/^h[1-6]$/.test(element.tagName) && slug(toString(element)) === id) continue;
    element.children.unshift({
      type: "element",
      tagName: anchorTagName,
      properties: { id },
      children: [],
    });
  }
  if (resolveLink !== undefined) {
    for (const link of selectAll("a[href]", main)) {
      link.properties.href = resolveLink(String(link.properties.href));
    }
  }

  const mdast = toMdast(
    { type: "root", children: main.children },
    {
      handlers: { aside, div, dl, [anchorTagName]: anchor },
    },
  );
  shortenCodeBlocks(mdast, options.stylesheetsAt);
  const markdown = toMarkdown(mdast, {
    // Unpadded table cells: column alignment costs a reader tokens and adds nothing.
    extensions: [gfmToMarkdown({ tablePipeAlign: false })],
    bullet: "-",
    emphasis: "_",
    fences: true,
    listItemIndent: "one",
    rule: "-",
  });
  const description = select('meta[name="description"]', tree)?.properties.content;
  return {
    title: toString(titleHeading).trim(),
    description: typeof description === "string" ? description : "",
    markdown,
  };
}
