// Smoke test for vitest browser mode. It proves the platform features jsdom lacks (Popover API,
// CSS anchor positioning) are available to `*.browser.test.tsx` files. Component tests that need
// a real browser follow this file's naming convention.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
