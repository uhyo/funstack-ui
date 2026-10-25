import { describe, expect, test } from "vitest";
import type { NavSection } from "../navigation.js";
import { generateMarkdownEdition } from "./edition.js";

function page(title: string, description: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta name="description" content="${description}"></head><body><main><h2>${title}</h2>${body}</main></body></html>`;
}

const navSections: NavSection[] = [
  { label: "Introduction", items: [{ path: "/", label: "Overview" }] },
  {
    label: "Components",
    items: [
      { path: "/components/dialog", label: "Dialog" },
      { path: "https://github.com/uhyo/funstack-ui", label: "GitHub", external: true },
    ],
  },
  { label: "Resources", items: [{ path: "/roadmap", label: "Roadmap" }] },
];

const htmlByPath = new Map([
  [
    "/",
    page(
      "FUNSTACK UI",
      "Headless &lt;ViewTransition&gt; UI.",
      '<p>See <a href="/components/dialog#modal">Dialog</a>.</p>',
    ),
  ],
  [
    "/components/dialog",
    page(
      "Dialog",
      "Built on &lt;dialog&gt; and fsui-* types_*.",
      '<h3 id="modal">Modal</h3><p>Back to <a href="/">home</a>.</p>',
    ),
  ],
  ["/roadmap", page("Roadmap", "What comes next.", "<p>Plans.</p>")],
  ["/unlisted", page("Unlisted", "Not in the sidebar.", "<p>Hidden.</p>")],
]);

describe("generateMarkdownEdition", () => {
  test("writes one .md per page, with relative links", () => {
    const { files } = generateMarkdownEdition(htmlByPath, navSections);
    expect([...files.keys()]).toEqual([
      "index.md",
      "components/dialog.md",
      "roadmap.md",
      "unlisted.md",
    ]);
    expect(files.get("components/dialog.md")).toBe(
      "# Dialog\n\n## Modal\n\nBack to [home](../index.md).\n",
    );
  });

  test("ends index.md with every page, grouped as in the sidebar and escaped", () => {
    const index = generateMarkdownEdition(htmlByPath, navSections).files.get("index.md")!;
    expect(index).toBe(
      [
        "# FUNSTACK UI",
        "",
        "See [Dialog](components/dialog.md#modal).",
        "",
        "## All pages",
        "",
        "### Introduction",
        "",
        "- [Overview](index.md): Headless \\<ViewTransition> UI.",
        "",
        "### Components",
        "",
        "- [Dialog](components/dialog.md): Built on \\<dialog> and fsui-\\* types\\_\\*.",
        "",
        "### Resources",
        "",
        "- [Roadmap](roadmap.md): What comes next.",
        "",
        "### Other pages",
        "",
        "- [Unlisted](unlisted.md): Not in the sidebar.",
        "",
      ].join("\n"),
    );
  });

  test("writes llms.txt with absolute URLs and an Optional section", () => {
    const { llmsTxt } = generateMarkdownEdition(htmlByPath, navSections);
    expect(llmsTxt).toMatch(
      /^# FUNSTACK UI\n\n> Headless \\<ViewTransition> UI\.\n\nInstall with /,
    );
    expect(llmsTxt).toContain(
      "## Components\n\n- [Dialog](https://ui.funstack.work/components/dialog.md): Built on \\<dialog>",
    );
    expect(llmsTxt).toContain(
      "## Optional\n\n- [Roadmap](https://ui.funstack.work/roadmap.md): What comes next.",
    );
    expect(llmsTxt).toContain(
      "## Other pages\n\n- [Unlisted](https://ui.funstack.work/unlisted.md)",
    );
  });

  test("concatenates the pages into llms-full.txt in sidebar order, with their URLs", () => {
    const { llmsFullTxt } = generateMarkdownEdition(htmlByPath, navSections);
    expect(llmsFullTxt.match(/^# .*/gm)).toEqual([
      "# FUNSTACK UI",
      "# Dialog",
      "# Roadmap",
      "# Unlisted",
    ]);
    expect(llmsFullTxt).toContain(
      "# Dialog\n\nURL: https://ui.funstack.work/components/dialog.md\n\n## Modal\n\nBack to [home](https://ui.funstack.work/index.md).",
    );
    expect(llmsFullTxt).toContain(
      "See [Dialog](https://ui.funstack.work/components/dialog.md#modal).",
    );
  });

  test("throws on a page without content or description", () => {
    const empty = new Map([...htmlByPath, ["/roadmap", page("Roadmap", "Plans.", "")]]);
    expect(() => generateMarkdownEdition(empty, navSections)).toThrow(
      "Markdown edition: /roadmap produced no content",
    );
    const undescribed = new Map([
      ...htmlByPath,
      ["/roadmap", page("Roadmap", "", "<p>Plans.</p>")],
    ]);
    expect(() => generateMarkdownEdition(undescribed, navSections)).toThrow(
      "Markdown edition: /roadmap has no description",
    );
  });
});
