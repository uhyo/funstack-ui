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

  it("restores a consumer's inline transition byte for byte", () => {
    activeViewTransition(true);
    const raw = "width:10px;transition:opacity 1s   ease  !important";
    const element = popup(raw);
    withCssTransitionCut(element, true, () => {
      expect(element.style.getPropertyValue("transition")).toBe("none");
    });
    expect(element.getAttribute("style")).toBe(raw);
  });

  it("restores the transition alone when something else wrote inline style during the call", () => {
    activeViewTransition(true);
    const element = popup("transition: opacity 1s;");
    withCssTransitionCut(element, true, () => {
      element.style.setProperty("width", "5px");
    });
    expect(element.style.getPropertyValue("transition")).toBe("opacity 1s");
    expect(element.style.getPropertyPriority("transition")).toBe("");
    expect(element.style.getPropertyValue("width")).toBe("5px");
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
