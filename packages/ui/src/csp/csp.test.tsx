// `@funstack/ui/csp` (design/conventions.md 12, design/components/context-menu.md 13.1 "CSP"):
// the committed stylesheet hashes cannot drift from the CSS the parts render, and the provider's
// nonce reaches a hoisted `<style>` on the server. The client-side nonce rows live with the parts
// (menu-context-trigger.test.tsx, tooltip.test.tsx).
import { createHash } from "node:crypto";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MENU_POINT_HREF, MENU_POINT_RULES } from "../internal/anchor-position.js";
import { TOOLTIP_WARM_HREF, TOOLTIP_WARM_RULES } from "../internal/tooltip-warm.js";
import { Tooltip } from "../tooltip/index.js";
import * as root from "../index.js";
import { CSPProvider, STYLE_SHA256 } from "./index.js";

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("base64");

describe("STYLE_SHA256", () => {
  it("is the base64 SHA-256 of every shipped stylesheet, keyed by its href", () => {
    expect(STYLE_SHA256).toEqual({
      [MENU_POINT_HREF]: sha256(MENU_POINT_RULES),
      [TOOLTIP_WARM_HREF]: sha256(TOOLTIP_WARM_RULES),
    });
  });

  it("is exported from the root entry too", () => {
    expect(root.STYLE_SHA256).toBe(STYLE_SHA256);
    expect(root.CSPProvider).toBe(CSPProvider);
  });

  it("the shipped CSS contains nothing React escapes when it server-renders a <style>", () => {
    // Fizz rewrites `<style` / `</style` inside style text, which would change the hash.
    for (const rules of [MENU_POINT_RULES, TOOLTIP_WARM_RULES]) {
      expect(rules).not.toMatch(/<\/?style/i);
    }
  });
});

describe("CSPProvider on the server", () => {
  // Kept in its own file: a streamed server render in a file that also renders on the client logs
  // React's "multiple renderers" warning in the client rows that follow.
  async function serverHtml(nonce: { script?: string; style?: string } | undefined) {
    const stream = await renderToReadableStream(
      <html>
        <head />
        <body>
          <CSPProvider nonce="abc">
            <Tooltip.Root>
              <Tooltip.Trigger experimental_interestFor>Bold</Tooltip.Trigger>
              <Tooltip.Popup experimental_hint>Bold text</Tooltip.Popup>
            </Tooltip.Root>
          </CSPProvider>
        </body>
      </html>,
      nonce === undefined ? {} : { nonce },
    );
    const html = await new Response(stream).text();
    return html.slice(0, html.indexOf("</head>"));
  }

  it("the skip-delay rule is hoisted into <head> with the render option's style nonce", async () => {
    const head = await serverHtml({ script: "abc", style: "abc" });
    expect(head).toMatch(/<style[^>]*nonce="abc"[^>]*data-href="@funstack\/ui\/tooltip-warm"/);
    // The text is the constant the hash was computed from.
    const text = /data-href="@funstack\/ui\/tooltip-warm"[^>]*>([\s\S]*?)<\/style>/.exec(head)?.[1];
    expect(text).toBe(TOOLTIP_WARM_RULES);
  });

  it("a mismatched render nonce drops the rule (React 19.3), which is why the docs ask for the same value", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const head = await serverHtml({ style: "other" });
    expect(head).not.toContain("@property --fsui-tooltip-warm");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
