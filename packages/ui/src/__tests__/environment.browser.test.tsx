// Smoke test for vitest browser mode. It proves the platform features jsdom lacks (Popover API,
// CSS anchor positioning) are available to `*.browser.test.tsx` files. Component tests that need
// a real browser follow this file's naming convention.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  anchorPositionHonoursParentDirection,
  browserName,
  supportsBaseSelect,
  supportsFocusgroup,
  supportsInterestFor,
  supportsPopoverHint,
  supportsSelectedContent,
  topLayerAnchorReChoosesOnScroll,
} from "./engine.js";

describe("browser test environment", () => {
  it("renders a React element into the real document", () => {
    render(<p data-testid="greeting">Hello, browser</p>);

    expect(screen.getByTestId("greeting")).toBeInTheDocument();
    expect(document.body.contains(screen.getByTestId("greeting"))).toBe(true);
  });

  it("supports the Popover API and the :popover-open pseudo-class", () => {
    render(
      <div popover="manual" data-testid="popup">
        Popup content
      </div>,
    );
    const popup = screen.getByTestId("popup");

    expect(typeof popup.showPopover).toBe("function");
    expect(typeof popup.hidePopover).toBe("function");
    expect(popup.matches(":popover-open")).toBe(false);
    expect(popup).not.toBeVisible();

    popup.showPopover();

    expect(popup.matches(":popover-open")).toBe(true);
    expect(popup).toBeVisible();

    popup.hidePopover();

    expect(popup.matches(":popover-open")).toBe(false);
  });

  it("fires ToggleEvent when a popover opens", async () => {
    render(
      <div popover="manual" data-testid="popup">
        Popup content
      </div>,
    );
    const popup = screen.getByTestId("popup");
    const states: Array<[string, string]> = [];
    const toggled = new Promise<void>((resolve) => {
      popup.addEventListener("toggle", (event) => {
        const { oldState, newState } = event as ToggleEvent;
        states.push([oldState, newState]);
        resolve();
      });
    });

    popup.showPopover();

    // `toggle` is dispatched from a queued task, unlike `beforetoggle` which is synchronous. The
    // row waits for the event: the spec does not order that task against a later timer (#109).
    expect(states).toEqual([]);
    await toggled;
    expect(states).toEqual([["closed", "open"]]);
  });

  it("supports CSS anchor positioning", () => {
    expect(CSS.supports("anchor-name: --x")).toBe(true);
    expect(CSS.supports("position-area: top")).toBe(true);
  });

  it("matches the per-engine support recorded in docs/research/popover-anchor-tooltip.md", () => {
    // `interestfor` is Chromium-only; `popover="hint"` is in Chromium and Firefox. Playwright's
    // WebKit is a trunk build that may already have `hint` (Safari 27.0 does not), so WebKit's
    // value is not pinned here: tests branch on `supportsPopoverHint` instead.
    expect(supportsInterestFor).toBe(browserName === "chromium");
    if (browserName !== "webkit") expect(supportsPopoverHint).toBe(true);
    // `<details name>` (exclusive accordions) is everywhere.
    expect("name" in HTMLDetailsElement.prototype).toBe(true);
    console.info(`[${browserName}] popover=hint: ${supportsPopoverHint}`);
  });

  it("Chromium has native focusgroup; Firefox and WebKit do not", () => {
    // Pins the feature check that Tabs.List and Toolbar branch on (issue #43:
    // `"focusgroup" in HTMLElement.prototype` is always false).
    expect(supportsFocusgroup).toBe(browserName === "chromium");
  });

  it("customizable select: the feature checks match the engine", () => {
    // Chromium ships customizable select; Firefox keeps it behind prefs. Safari 27 ships it too,
    // but Playwright's WebKit is a trunk build whose features need not match a Safari release,
    // so WebKit's values are logged, not pinned: the Select rows branch on the feature checks.
    if (browserName !== "webkit") {
      expect(supportsBaseSelect).toBe(browserName === "chromium");
      expect(supportsSelectedContent).toBe(browserName === "chromium");
    }
    console.info(
      `[${browserName}] base-select: ${supportsBaseSelect}, selectedcontent: ${supportsSelectedContent}`,
    );
  });

  it("records which engines misplace anchored popups in a direction island (Mozilla 2019601)", () => {
    // Conventions 13.3, #89. Pinned per engine so a fix (or a regression elsewhere) shows up here
    // first; the component rows branch on the probe itself.
    expect(anchorPositionHonoursParentDirection).toBe(browserName !== "firefox");
    // The keyword groups the library emits parse in every engine (conventions 13.1).
    for (const value of [
      "bottom span-self-x-end",
      "self-x-end span-bottom",
      "self-block-end span-self-inline-end",
    ]) {
      expect(CSS.supports("position-area", value)).toBe(true);
    }
    // ...and a mixed pair does not (the old combobox note's trap).
    expect(CSS.supports("position-area", "block-end span-self-inline-end")).toBe(false);
  });

  // #92
  it("records which engines keep an overflowing option of a top-layer popover after a scroll", async () => {
    // Conventions 13.2, #92: Chromium does not re-run position-try fallback for a top-layer
    // popover after a scroll. Pinned for the two engines measured; WebKit is logged only. When
    // this fails in Chromium, #92 is fixed: flip the Tooltip scroll row's branch.
    const reChooses = await topLayerAnchorReChoosesOnScroll();
    if (browserName !== "webkit") expect(reChooses).toBe(browserName !== "chromium");
    console.info(`[${browserName}] top-layer anchor re-chooses on scroll: ${reChooses}`);
  });
});
