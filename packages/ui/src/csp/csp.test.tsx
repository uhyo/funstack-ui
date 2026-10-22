// `@funstack/ui/csp` (design/conventions.md 12, design/components/context-menu.md 13.1 "CSP"):
// the committed stylesheet hashes cannot drift from the CSS the parts render, and the provider's
// nonce reaches a hoisted `<style>` on the server. The client-side nonce rows live with the parts
// (menu-context-trigger.test.tsx, tooltip.test.tsx).
import { createHash } from "node:crypto";
import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MENU_POINT_HREF, MENU_POINT_RULES } from "../internal/anchor-position.js";
import { TOOLTIP_WARM_HREF, TOOLTIP_WARM_RULES } from "../internal/tooltip-warm.js";
import { Menu } from "../menu/index.js";
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
  type NonceOption = string | { script?: string; style?: string } | undefined;
  async function headOf(ui: ReactNode, nonce: NonceOption) {
    const stream = await renderToReadableStream(
      <html>
        <head />
        <body>{ui}</body>
      </html>,
      nonce === undefined ? {} : { nonce },
    );
    const html = await new Response(stream).text();
    return html.slice(0, html.indexOf("</head>"));
  }
  const tooltip = (
    <Tooltip.Root>
      <Tooltip.Trigger experimental_interestFor>Bold</Tooltip.Trigger>
      <Tooltip.Popup experimental_hint>Bold text</Tooltip.Popup>
    </Tooltip.Root>
  );
  const serverHtml = (nonce: NonceOption, provider = true) =>
    headOf(provider ? <CSPProvider nonce="abc">{tooltip}</CSPProvider> : tooltip, nonce);
  const warmText = (head: string) =>
    /data-href="@funstack\/ui\/tooltip-warm"[^>]*>([\s\S]*?)<\/style>/.exec(head)?.[1];

  it("the skip-delay rule is hoisted into <head> with the render option's style nonce", async () => {
    const head = await serverHtml({ script: "abc", style: "abc" });
    expect(head).toMatch(/<style[^>]*nonce="abc"[^>]*data-href="@funstack\/ui\/tooltip-warm"/);
    // The text is the constant the hash was computed from.
    expect(warmText(head)).toBe(TOOLTIP_WARM_RULES);
  });

  it("a mismatched render nonce drops the rule (React 19.3), which is why the docs ask for the same value", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const head = await serverHtml({ style: "other" });
    expect(head).not.toContain("@property --fsui-tooltip-warm");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("nonce.style without a <CSPProvider> drops the rule too (the element carries no nonce)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const head = await serverHtml({ script: "abc", style: "abc" }, false);
    expect(head).not.toContain("@property --fsui-tooltip-warm");
    error.mockRestore();
  });

  it.each([
    ["no nonce option", undefined],
    ['the string form nonce: "abc"', "abc"],
  ])("%s with a <CSPProvider>: the rule is kept but its nonce is stripped", async (_, nonce) => {
    const head = await serverHtml(nonce);
    expect(warmText(head)).toBe(TOOLTIP_WARM_RULES);
    expect(head).not.toMatch(/<style[^>]*nonce=/);
  });

  // Fizz writes every same-precedence hoisted <style> of one flush as a single element whose
  // text is the concatenation, which no per-href hash in STYLE_SHA256 matches. So at most one
  // shipped stylesheet may render during server rendering in the "fsui" bucket (the menu point
  // rules are client-only); a second one needs a precedence of its own (review L2).
  it("Fizz merges same-precedence hoisted styles (why the guard below exists)", async () => {
    const head = await headOf(
      <>
        <style href="a" precedence="probe">
          {".a{}"}
        </style>
        <style href="b" precedence="probe">
          {".b{}"}
        </style>
      </>,
      undefined,
    );
    expect(head.match(/<style[^>]*data-precedence="probe"/g)).toHaveLength(1);
  });

  it("guard: a server render of every part that ships CSS emits one fsui <style>, matching its hash", async () => {
    const head = await headOf(
      <CSPProvider nonce="abc">
        {tooltip}
        <Menu.Root>
          <Menu.ContextTrigger>row</Menu.ContextTrigger>
          <Menu.Popup aria-label="Row" keepMounted>
            <Menu.Item>Open</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </CSPProvider>,
      { script: "abc", style: "abc" },
    );
    const styles = head.match(/<style[^>]*data-precedence="fsui"[^>]*>/g) ?? [];
    expect(styles).toHaveLength(1);
    expect(styles[0]).toContain(`data-href="${TOOLTIP_WARM_HREF}"`);
    expect(sha256(warmText(head)!)).toBe(STYLE_SHA256[TOOLTIP_WARM_HREF]);
  });
});
