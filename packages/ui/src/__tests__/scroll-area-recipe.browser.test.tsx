// The "Scroll areas" docs recipe (#171: no ScrollArea part, a recipe instead; the page is
// packages/docs/src/pages/ScrollAreaPage.tsx). Not a library component: this file runs the
// recipe's stylesheet, read from the docs example itself, in the three engines, so the page
// only claims what they do. Rows: the standard scrollbar properties apply; `scrollbar-gutter:
// stable` keeps the content width when the content starts to overflow; the edge fades follow
// the scroll position from a scroll timeline and are absent when nothing overflows; a scroller
// with `tabindex="0"`, a role and a name is a Tab stop that the arrow keys and Page Down scroll;
// its focus ring is drawn on the frame (the fade mask would fade the scroller's own outline).
// The gutter row asserts a non-zero gutter where the recipe's bar takes space (headless
// Chromium) and none where bars are hidden (Playwright's Firefox).
//
// Two engine branches (memo/developer/cross-engine.md):
// - Playwright's Firefox forces `scrollbar-width: none` on every element (an inline
//   `!important` loses too), so there the computed value only shows that the property parses.
// - Scroll-driven animations shipped in Firefox 159; an engine without them (Playwright's
//   Firefox 157 at the time of writing) must show no fade at all, which the recipe's
//   `@supports` guarantees.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { addStyle } from "./browser-helpers.js";
import { user } from "./browser-user.js";

const scrollTimelines = CSS.supports("animation-timeline: scroll()");
/** The test environment hides every scrollbar (Playwright's Firefox). */
const scrollbarsForcedNone = (() => {
  const probe = document.createElement("div");
  probe.style.scrollbarWidth = "thin";
  document.body.append(probe);
  const forced = getComputedStyle(probe).scrollbarWidth === "none";
  probe.remove();
  return forced;
})();
/**
 * Whether the recipe's scrollbar takes layout space here (a classic bar): an `overflow: scroll`
 * box with the recipe's class, measured after the stylesheet is in. Headless Chromium hides a
 * default scrollbar (0px) but draws one styled by the recipe; Playwright's Firefox hides every
 * scrollbar.
 */
function classicScrollbars(): boolean {
  const probe = document.createElement("div");
  probe.className = "demo-scroll-area";
  probe.style.cssText = "overflow: scroll; inline-size: 100px; block-size: 100px;";
  document.body.append(probe);
  const classic = probe.offsetWidth - probe.clientWidth > 0;
  probe.remove();
  return classic;
}

async function recipe(): Promise<void> {
  const css = await commands.readFile("../docs/src/examples/scroll-area.css");
  // The docs' colour tokens, so `scrollbar-color` has values to compute.
  addStyle(`:root { --color-border: rgb(200, 200, 200); --color-text-secondary: rgb(90, 90, 90);
    --color-primary: blue; font-size: 16px; } ${css}`);
}

function Area({ rows, fade = true }: { rows: number; fade?: boolean }) {
  return (
    <>
      <button type="button">before</button>
      <section className="demo-scroll-area-frame" data-testid="frame">
        <div
          className={fade ? "demo-scroll-area demo-scroll-fade" : "demo-scroll-area"}
          tabIndex={0}
          role="region"
          aria-label="Release notes"
          data-testid="area"
          style={{ inlineSize: "200px" }}
        >
          {Array.from({ length: rows }, (_, i) => (
            <p key={i} style={{ margin: 0, blockSize: "24px" }}>
              Row {i}
            </p>
          ))}
        </div>
      </section>
    </>
  );
}

const area = () => screen.getByTestId("area");
/** The two fade lengths, rounded to whole pixels (WebKit interpolates 10px as 9.999999px). */
const fades = () => {
  const style = getComputedStyle(area());
  return ["--scroll-fade-start", "--scroll-fade-end"].map((name) => {
    const value = style.getPropertyValue(name).trim();
    if (!value.endsWith("px")) return value;
    return `${Math.round(Number.parseFloat(value))}px`;
  });
};

describe("Scroll areas recipe (browser)", () => {
  it("the standard scrollbar properties apply", async () => {
    await recipe();
    render(<Area rows={40} />);
    const style = getComputedStyle(area());
    expect(CSS.supports("scrollbar-width: thin")).toBe(true);
    expect(style.scrollbarWidth).toBe(scrollbarsForcedNone ? "none" : "thin");
    expect(style.scrollbarGutter).toBe("stable");
    expect(style.scrollbarColor).toBe("rgb(200, 200, 200) rgba(0, 0, 0, 0)");
  });

  const gap = () => area().offsetWidth - area().clientWidth;

  it("scrollbar-gutter: stable reserves the bar's space where bars take space", async () => {
    await recipe();
    const classic = classicScrollbars();
    const { rerender } = render(<Area rows={2} />);
    expect(area().scrollHeight).toBe(area().clientHeight);
    const reserved = gap();
    if (classic) {
      // Classic bars: the gutter is there before the content overflows.
      expect(reserved).toBeGreaterThan(0);
    } else {
      // Overlay or hidden bars (Playwright's Firefox): nothing to reserve.
      expect(reserved).toBe(0);
    }
    rerender(<Area rows={40} />);
    expect(area().scrollHeight).toBeGreaterThan(area().clientHeight);
    // No shift when the content starts to overflow.
    expect(gap()).toBe(reserved);
  });

  it.runIf(!scrollTimelines)("without scroll timelines: no fade at any position", async () => {
    await recipe();
    render(<Area rows={40} />);
    for (const top of [0, 200, 10_000]) {
      area().scrollTop = top;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      expect(fades()).toEqual(["0px", "0px"]);
      expect(getComputedStyle(area()).maskImage).toBe("none");
    }
  });

  it.runIf(scrollTimelines)("the fades follow the scroll position", async () => {
    await recipe();
    render(<Area rows={40} />);
    // At the top: no fade at the start, a full one at the end.
    await expect.poll(fades).toEqual(["0px", "32px"]);
    area().scrollTop = 10;
    // Within the first 2rem of scrolling the start fade grows.
    await expect.poll(fades).toEqual(["10px", "32px"]);
    area().scrollTop = 200;
    await expect.poll(fades).toEqual(["32px", "32px"]);
    area().scrollTop = area().scrollHeight;
    await expect.poll(fades).toEqual(["32px", "0px"]);
  });

  it("no fade when nothing overflows (the timeline is inactive)", async () => {
    await recipe();
    render(<Area rows={2} />);
    // Give the timeline a frame or two to (not) apply.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(fades()).toEqual(["0px", "0px"]);
  });

  it('tabindex="0" with a role and a name: a named Tab stop the keyboard scrolls', async () => {
    await recipe();
    render(<Area rows={40} fade={false} />);
    expect(screen.getByRole("region", { name: "Release notes" })).toBe(area());
    screen.getByRole("button", { name: "before" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(area());
    await user.keyboard("{ArrowDown}");
    await expect.poll(() => area().scrollTop).toBeGreaterThan(0);
    const afterArrow = area().scrollTop;
    await user.keyboard("{PageDown}");
    await expect.poll(() => area().scrollTop).toBeGreaterThan(afterArrow);
  });

  it("the focus ring is drawn on the frame, outside the fade mask", async () => {
    await recipe();
    render(<Area rows={40} />);
    const frame = screen.getByTestId("frame");
    expect(getComputedStyle(frame).outlineStyle).toBe("none");
    screen.getByRole("button", { name: "before" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(area());
    expect(getComputedStyle(area()).outlineStyle).toBe("none");
    expect(getComputedStyle(frame).outlineStyle).toBe("solid");
    expect(getComputedStyle(frame).outlineColor).toBe("rgb(0, 0, 255)");
  });
});
