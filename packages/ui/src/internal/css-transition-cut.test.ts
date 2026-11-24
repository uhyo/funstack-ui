import { afterEach, describe, expect, it, vi } from "vitest";
import { withCssTransitionCut } from "./css-transition-cut.js";

/** Makes `html:active-view-transition` match (jsdom has no view transitions). */
function activeViewTransition(active: boolean): void {
  const original = Element.prototype.matches;
  vi.spyOn(document.documentElement, "matches").mockImplementation(function (
    this: Element,
    selector: string,
  ) {
    if (selector === ":active-view-transition") return active;
    return original.call(this, selector);
  });
}

function popup(style?: string): HTMLElement {
  const element = document.createElement("div");
  if (style !== undefined) element.setAttribute("style", style);
  document.body.append(element);
  return element;
}

describe("withCssTransitionCut", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cuts during the call and restores an absent style attribute as absent", () => {
    activeViewTransition(true);
    const element = popup();
    const seen: string[] = [];
    const result = withCssTransitionCut(element, true, () => {
      seen.push(element.style.getPropertyValue("transition"));
      seen.push(element.style.getPropertyPriority("transition"));
      return 42;
    });
    expect(result).toBe(42);
    expect(seen).toEqual(["none", "important"]);
    expect(element.hasAttribute("style")).toBe(false);
  });

  it("restores a consumer's inline transition and its priority, through CSSOM only", () => {
    activeViewTransition(true);
    const element = popup("width: 10px; transition: opacity 1s ease 0s !important;");
    const before = element.style.getPropertyValue("transition");
    // A CSP without 'unsafe-inline' blocks attribute writes: the helper must never make one.
    const setAttribute = vi.spyOn(element, "setAttribute");
    withCssTransitionCut(element, true, () => {
      expect(element.style.getPropertyValue("transition")).toBe("none");
    });
    expect(setAttribute).not.toHaveBeenCalled();
    expect(element.style.getPropertyValue("transition")).toBe(before);
    expect(element.style.getPropertyPriority("transition")).toBe("important");
    expect(element.style.getPropertyValue("width")).toBe("10px");
  });

  it("restores longhands a consumer set on their own", () => {
    activeViewTransition(true);
    const element = popup("transition-property: opacity; transition-duration: 2s;");
    withCssTransitionCut(element, true, () => {});
    expect(element.style.getPropertyValue("transition-property")).toBe("opacity");
    expect(element.style.getPropertyValue("transition-duration")).toBe("2s");
    expect(element.style.getPropertyValue("transition-delay")).toBe("");
    expect(element.style.getPropertyValue("transition-timing-function")).toBe("");
  });

  it("keeps other inline style written during the call", () => {
    activeViewTransition(true);
    const element = popup("transition: opacity 1s;");
    withCssTransitionCut(element, true, () => {
      element.style.setProperty("width", "5px");
    });
    expect(element.style.getPropertyValue("transition")).toBe("opacity 1s");
    expect(element.style.getPropertyPriority("transition")).toBe("");
    expect(element.style.getPropertyValue("width")).toBe("5px");
  });

  it("leaves a transition written during the call alone (the cut is no longer its own)", () => {
    activeViewTransition(true);
    const element = popup("transition: opacity 1s;");
    withCssTransitionCut(element, true, () => {
      element.style.setProperty("transition", "color 3s");
    });
    expect(element.style.getPropertyValue("transition")).toBe("color 3s");
  });

  it("restores even when the call throws", () => {
    activeViewTransition(true);
    const element = popup("color: red;");
    expect(() =>
      withCssTransitionCut(element, true, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(element.getAttribute("style")).toBe("color: red;");
  });

  it("does nothing without the transition prop or without an active view transition", () => {
    const element = popup();
    activeViewTransition(true);
    withCssTransitionCut(element, false, () => {
      expect(element.hasAttribute("style")).toBe(false);
    });
    vi.restoreAllMocks();
    activeViewTransition(false);
    withCssTransitionCut(element, true, () => {
      expect(element.hasAttribute("style")).toBe(false);
    });
  });

  it("does nothing where the pseudo-class is unknown (matches throws)", () => {
    vi.spyOn(document.documentElement, "matches").mockImplementation(() => {
      throw new SyntaxError("unknown pseudo-class");
    });
    const element = popup();
    withCssTransitionCut(element, true, () => {
      expect(element.hasAttribute("style")).toBe(false);
    });
  });

  it("a nested call runs inside the outer cut and the outer one restores", () => {
    activeViewTransition(true);
    const element = popup("transition: opacity 1s;");
    withCssTransitionCut(element, true, () => {
      withCssTransitionCut(element, true, () => {
        expect(element.style.getPropertyValue("transition")).toBe("none");
      });
      // The inner call did not restore early.
      expect(element.style.getPropertyValue("transition")).toBe("none");
    });
    expect(element.getAttribute("style")).toBe("transition: opacity 1s;");
  });
});
