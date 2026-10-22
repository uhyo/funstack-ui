// Smoke test for vitest browser mode. It proves the platform features jsdom lacks (Popover API,
// CSS anchor positioning) are available to `*.browser.test.tsx` files. Component tests that need
// a real browser follow this file's naming convention.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  anchorPositionHonoursParentDirection,
  browserName,
  supportsInterestFor,
  supportsPopoverHint,
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
    popup.addEventListener("toggle", (event) => {
      const { oldState, newState } = event as ToggleEvent;
      states.push([oldState, newState]);
    });

    popup.showPopover();

    // `toggle` is dispatched from a queued task, unlike `beforetoggle` which is synchronous.
    await new Promise((resolve) => setTimeout(resolve, 0));
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
});
