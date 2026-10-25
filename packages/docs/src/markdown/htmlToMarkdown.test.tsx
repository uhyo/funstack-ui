import type { ReactNode } from "react";
import { prerender } from "react-dom/static";
import { describe, expect, test } from "vitest";
import { Callout } from "../components/Callout.js";
import { CodeBlock } from "../components/CodeBlock.js";
import { BehaviourIndex, BehaviourSection, Terms } from "../components/Concept.js";
import { Example } from "../components/Example.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { exampleSource } from "../examples/sources.js";
import { pageToMarkdown } from "./htmlToMarkdown.js";
import { linkResolver } from "./paths.js";

// The converter is tested on the markup of the site's real components, so a change to one of
// them that the conversion does not follow fails here rather than in the generated files.

async function renderPage(content: ReactNode, description = "A test page."): Promise<string> {
  const { prelude } = await prerender(
    <html>
      <head>
        <meta name="description" content={description} />
      </head>
      <body>
        <header>
          <nav>Site header</nav>
        </header>
        <main>
          <aside className="docs-sidebar">Sidebar link</aside>
          <div className="docs-content">{content}</div>
        </main>
        <footer>Site footer</footer>
      </body>
    </html>,
  );
  return new Response(prelude).text();
}

describe("pageToMarkdown", () => {
  test("converts a page title, prose, a callout and the description", async () => {
    const html = await renderPage(
      <>
        <h2>Demo</h2>
        <p className="page-intro">
          The <code>Demo</code> component, with <strong>bold</strong> text.
        </p>
        <h3>Section</h3>
        <h4>Subsection</h4>
        <Callout kind="warning" title="Careful">
          <p>A warning body.</p>
        </Callout>
        <Callout>
          <p>An untitled note.</p>
        </Callout>
      </>,
      "Demo description.",
    );
    const { title, description, markdown } = pageToMarkdown(html);
    expect(title).toBe("Demo");
    expect(description).toBe("Demo description.");
    expect(markdown).toBe(
      [
        "# Demo",
        "",
        "The `Demo` component, with **bold** text.",
        "",
        "## Section",
        "",
        "### Subsection",
        "",
        "> **Careful**",
        ">",
        "> A warning body.",
        "",
        "> **Note**",
        ">",
        "> An untitled note.",
        "",
      ].join("\n"),
    );
  });

  test("strips the site chrome", async () => {
    const markdown = pageToMarkdown(
      await renderPage(
        <>
          <h2>Demo</h2>
          <BehaviourIndex />
          <p>Body.</p>
        </>,
      ),
    ).markdown;
    expect(markdown).toBe("# Demo\n\nBody.\n");
  });

  test("keeps an example's source as code blocks and drops its live demo", async () => {
    const markdown = pageToMarkdown(
      await renderPage(
        <>
          <h2>Demo</h2>
          <Example file="ToggleFavorite.tsx" css="toggle.css">
            <button type="button">Live demo DOM</button>
          </Example>
          <CodeBlock language="bash">{"npm install @funstack/ui@alpha"}</CodeBlock>
        </>,
      ),
    ).markdown;
    expect(markdown).not.toContain("Live demo DOM");
    expect(markdown).not.toContain("Show code");
    expect(markdown).toContain(
      `\`\`\`tsx title="ToggleFavorite.tsx"\n${exampleSource("ToggleFavorite.tsx").trim()}\n\`\`\``,
    );
    expect(markdown).toContain(
      `\`\`\`css title="toggle.css"\n${exampleSource("toggle.css").trim()}\n\`\`\``,
    );
    expect(markdown).toContain("```bash\nnpm install @funstack/ui@alpha\n```");
  });

  test("replaces a repeated stylesheet with a reference to the first", async () => {
    const markdown = pageToMarkdown(
      await renderPage(
        <>
          <h2>Demo</h2>
          <Example file="DialogConfirm.tsx" css="dialog.css">
            <button type="button">Live demo DOM</button>
          </Example>
          <Example file="DialogProfile.tsx" css="dialog.css">
            <button type="button">Live demo DOM</button>
          </Example>
        </>,
      ),
    ).markdown;
    expect(markdown.match(/```css title="dialog.css"/g)).toHaveLength(1);
    expect(markdown).toContain('```tsx title="DialogProfile.tsx"');
    expect(markdown.trimEnd().endsWith("`dialog.css`: the same file as above.")).toBe(true);
  });

  test("with stylesheetsAt, replaces example stylesheets with a link to the page", async () => {
    const markdown = pageToMarkdown(
      await renderPage(
        <>
          <h2>Demo</h2>
          <Example file="DialogConfirm.tsx" css="dialog.css">
            <button type="button">Live demo DOM</button>
          </Example>
          <CodeBlock language="css">{".dialog:open { opacity: 1; }"}</CodeBlock>
        </>,
      ),
      { stylesheetsAt: "https://ui.funstack.work/components/dialog.md" },
    ).markdown;
    expect(markdown).toContain('```tsx title="DialogConfirm.tsx"');
    expect(markdown).not.toContain('```css title="dialog.css"');
    expect(markdown).toContain(
      "`dialog.css`: the example's stylesheet, in [the page's Markdown](https://ui.funstack.work/components/dialog.md).",
    );
    // An untitled CSS snippet in the prose stays.
    expect(markdown).toContain("```css\n.dialog:open { opacity: 1; }\n```");
  });

  test("converts props tables, part facts, reference tables and terms", async () => {
    const markdown = pageToMarkdown(
      await renderPage(
        <>
          <h2>Demo</h2>
          <PropsTable
            rows={[
              {
                name: "value",
                type: "string | null",
                default: "null",
                description: "The **committed** value; see [Action props](/concepts/action-props).",
              },
              { name: "disabled", type: "boolean", description: "Disables the `Demo`." },
            ]}
          />
          <PartFacts state="`DemoState` is `{ pending }`." owned="`role`." note="A note." />
          <Table head={["Key", "Action"]} rows={[["`Enter`", "Activates."]]} />
          <Terms items={[{ id: "trigger", term: "Trigger", definition: "Opens a `popup`." }]} />
        </>,
      ),
    ).markdown;
    expect(markdown).toBe(
      [
        "# Demo",
        "",
        "| Prop | Type | Default | Description |",
        "| - | - | - | - |",
        "| `value` | `string \\| null` | `null` | The **committed** value; see [Action props](/concepts/action-props). |",
        "| `disabled` | `boolean` | – | Disables the `Demo`. |",
        "",
        "- **State**: `DemoState` is `{ pending }`.",
        "- **Owned**: `role`.",
        "",
        "A note.",
        "",
        "| Key | Action |",
        "| - | - |",
        "| `Enter` | Activates. |",
        "",
        "- **Trigger**: Opens a `popup`.",
        "",
      ].join("\n"),
    );
  });

  test("maps links and adds anchors for linked ids that Markdown would not generate", async () => {
    const html = await renderPage(
      <>
        <h2>Demo</h2>
        <Terms items={[{ id: "trigger", term: "Trigger", definition: "Opens it." }]} />
        <h3 id="suspense">Suspense</h3>
        <h3 id="short">A long heading</h3>
        <Callout id="careful" title="Careful">
          <p>Body.</p>
        </Callout>
        <BehaviourSection id="before-hydration" summary="Works before hydration." />
        <p>
          <a href="#short">same page</a>, <a href="/concepts/suspense#terms">other page</a>,{" "}
          <a href="/">home</a>, <a href="/FUNSTACK_UI_Hero_small.png">asset</a>,{" "}
          <a href="https://example.com/">external</a>.
        </p>
      </>,
    );
    const pages = new Set([
      "/",
      "/components/demo",
      "/concepts/suspense",
      "/concepts/server-components",
    ]);
    const anchors = new Set(["trigger", "suspense", "short", "careful"]);
    const relative = pageToMarkdown(html, {
      resolveLink: linkResolver("/components/demo", pages, true),
      anchors,
    }).markdown;
    expect(relative).toBe(
      [
        "# Demo",
        "",
        '- **<a id="trigger"></a>Trigger**: Opens it.',
        "",
        "## Suspense",
        "",
        '## <a id="short"></a>A long heading',
        "",
        '> <a id="careful"></a>**Careful**',
        ">",
        "> Body.",
        "",
        "## Before hydration",
        "",
        "Concept: [Server Components](../concepts/server-components.md#before-hydration)",
        "",
        "Works before hydration.",
        "",
        "[same page](#short), [other page](../concepts/suspense.md#terms), [home](../index.md), [asset](https://ui.funstack.work/FUNSTACK_UI_Hero_small.png), [external](https://example.com/).",
        "",
      ].join("\n"),
    );
    const absolute = pageToMarkdown(html, {
      resolveLink: linkResolver("/components/demo", pages, false),
    }).markdown;
    expect(absolute).toContain(
      "[same page](https://ui.funstack.work/components/demo.md#short), [other page](https://ui.funstack.work/concepts/suspense.md#terms), [home](https://ui.funstack.work/index.md)",
    );
  });

  test("puts content React streamed after the shell back in place", () => {
    const html = [
      "<!DOCTYPE html><html><head></head><body>",
      '<main><!--$?--><template id="B:0"></template><!--/$--></main>',
      '<div hidden id="S:0"><h2>Streamed</h2><p>Deferred content.</p></div>',
      '<script>$RC("B:0","S:0")</script>',
      "</body></html>",
    ].join("");
    expect(pageToMarkdown(html).markdown).toBe("# Streamed\n\nDeferred content.\n");
  });

  test("throws on a page whose streamed content is missing, or that has no main or heading", () => {
    expect(() =>
      pageToMarkdown('<main><!--$?--><template id="B:0"></template><!--/$--></main>'),
    ).toThrow("unresolved Suspense content");
    // A segment `$RS` would fill, or one no script moved in.
    expect(() =>
      pageToMarkdown(
        '<main><h2>Page</h2><template id="P:1"></template></main><div hidden id="S:1"><p>Late.</p></div>',
      ),
    ).toThrow("unresolved Suspense content");
    expect(() => pageToMarkdown("<p>No main</p>")).toThrow("no <main>");
    expect(() => pageToMarkdown("<main><p>No heading</p></main>")).toThrow("no heading");
  });
});
