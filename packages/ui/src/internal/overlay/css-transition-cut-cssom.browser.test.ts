// The CSS transition cut (#147) against a real CSSOM and style engine (#157 safety net,
// memo/reviewer/refactor-test-safety.md CTC3 and CTC6). jsdom's CSSOM treats `transition` as a
// plain property (setting it leaves the longhands alone) and has no style engine, so neither the
// longhand restore nor the forced style recalculation is observable there. The helper is called
// directly with `:active-view-transition` stubbed to match, as in css-transition-cut.test.ts:
// what is pinned is the helper's contract, not a view transition.
import { afterEach, describe, expect, it, vi } from "vitest";
import { addStyle } from "../../__tests__/browser-helpers.js";
import { withCssTransitionCut } from "./css-transition-cut.js";

function activeViewTransition(): void {
  const original = Element.prototype.matches;
  vi.spyOn(document.documentElement, "matches").mockImplementation(function (
    this: Element,
    selector: string,
  ) {
    if (selector === ":active-view-transition") return true;
    return original.call(this, selector);
  });
}

const elements: HTMLElement[] = [];
function popup(): HTMLElement {
  const element = document.createElement("div");
  element.textContent = "popup";
  document.body.append(element);
  elements.push(element);
  return element;
}

describe("withCssTransitionCut in a real engine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const element of elements.splice(0)) element.remove();
  });

  it("restores a longhand the consumer set without the shorthand, with its priority", () => {
    activeViewTransition();
    const element = popup();
    element.style.setProperty("transition-duration", "300ms", "important");
    element.style.setProperty("transition-delay", "20ms");
    withCssTransitionCut(element, true, () => {
      // The cut's shorthand overwrote the longhands.
      expect(element.style.getPropertyValue("transition-duration")).toBe("0s");
      expect(element.style.getPropertyValue("transition-property")).toBe("none");
    });
    expect(element.style.getPropertyValue("transition-duration")).toBe("300ms");
    expect(element.style.getPropertyPriority("transition-duration")).toBe("important");
    expect(element.style.getPropertyValue("transition-delay")).toBe("20ms");
    expect(element.style.getPropertyPriority("transition-delay")).toBe("");
    // Nothing the consumer did not set is left behind.
    expect(element.style.getPropertyValue("transition-property")).toBe("");
    expect(element.style.getPropertyValue("transition-timing-function")).toBe("");
  });

  it("a style change made inside the call starts no CSS transition once the cut is restored", () => {
    activeViewTransition();
    const removeStyle = addStyle(
      ".cut-probe { opacity: 1; transition: opacity 10s linear; } .cut-probe.hidden { opacity: 0; }",
    );
    try {
      const element = popup();
      element.className = "cut-probe";
      // A computed style before the change, so the engine has a value to transition from.
      expect(getComputedStyle(element).opacity).toBe("1");
      withCssTransitionCut(element, true, () => {
        element.classList.add("hidden");
      });
      // Without the forced recalculation inside the cut, this read sees the change together with
      // the restored transition and starts a 10 s opacity transition.
      expect(getComputedStyle(element).opacity).toBe("0");
      expect(element.getAnimations()).toEqual([]);
      // Control: the same change outside the cut does start one.
      element.classList.remove("hidden");
      void getComputedStyle(element).opacity;
      expect(element.getAnimations().length).toBeGreaterThan(0);
    } finally {
      removeStyle();
    }
  });

  // CTC7: the element leaves the "cutting" set, so the hide after the show is cut as well.
  it("a second cut of the same element (the close after the open) starts no transition either", () => {
    activeViewTransition();
    const removeStyle = addStyle(
      ".cut-probe { opacity: 1; transition: opacity 10s linear; } .cut-probe.hidden { opacity: 0; }",
    );
    try {
      const element = popup();
      element.className = "cut-probe hidden";
      expect(getComputedStyle(element).opacity).toBe("0");
      withCssTransitionCut(element, true, () => element.classList.remove("hidden"));
      expect(getComputedStyle(element).opacity).toBe("1");
      withCssTransitionCut(element, true, () => element.classList.add("hidden"));
      expect(getComputedStyle(element).opacity).toBe("0");
      expect(element.getAnimations()).toEqual([]);
    } finally {
      removeStyle();
    }
  });
});
