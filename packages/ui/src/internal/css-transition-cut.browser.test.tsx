// The CSS transition cut (#147) under a strict CSP. Its own file: a CSP `<meta>` cannot be
// removed once inserted, so it would reach every later test of the same file (review H1 of
// memo/reviewer/review-147-155.md).
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { leaveActEnvironment, spyViewTransitions } from "../__tests__/browser-helpers.js";
import { browserName } from "../__tests__/engine.js";
import { Popover } from "../popover/index.js";

/** Whether the page's CSP blocks a `style` attribute write (after the meta below). */
let attributeWritesBlocked = false;

beforeAll(() => {
  // Blocks `style` attribute parsing only, not `<style>` elements; React's `style` prop and every
  // CSSOM write keep working, as on a real page with `style-src` lacking 'unsafe-inline'.
  const meta = document.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = "style-src-attr 'none'";
  document.head.append(meta);
  const probe = document.createElement("div");
  probe.setAttribute("style", "width: 3px");
  attributeWritesBlocked = probe.style.width === "";
});

describe("withCssTransitionCut under a CSP without 'unsafe-inline' for style attributes", () => {
  it("the cut is undone and React's inline style kept, after a library open and close", async () => {
    // The row is vacuous where the meta is not enforced; Chromium and Firefox enforce it.
    if (browserName !== "webkit") expect(attributeWritesBlocked).toBe(true);
    leaveActEnvironment();
    const vt = spyViewTransitions();
    render(
      <Popover.Root defaultOpen={false}>
        <Popover.Trigger data-testid="trigger">Filters</Popover.Trigger>
        <Popover.Popup
          data-testid="popup"
          aria-label="Filters"
          transition="pop"
          style={{ width: 200, height: 100 }}
        >
          <Popover.Close data-testid="close">Done</Popover.Close>
        </Popover.Popup>
      </Popover.Root>,
    );
    const popup = screen.getByTestId("popup");
    const check = () => {
      // React's own declarations survive (Firefox wiped them with an attribute restore) and the
      // cut is gone (Chromium kept `transition: none !important` forever).
      expect(popup.style.width).toBe("200px");
      expect(popup.style.height).toBe("100px");
      expect(popup.style.getPropertyValue("transition")).toBe("");
      expect(getComputedStyle(popup).transitionProperty).not.toBe("none");
    };
    screen.getByTestId("trigger").click();
    await expect.poll(() => vt.calls()).toBe(1);
    await vt.transitions[0]!.finished;
    expect(popup.matches(":popover-open")).toBe(true);
    check();
    screen.getByTestId("close").click();
    await expect.poll(() => vt.calls()).toBe(2);
    await vt.transitions[1]!.finished;
    expect(popup.matches(":popover-open")).toBe(false);
    check();
  });
});
