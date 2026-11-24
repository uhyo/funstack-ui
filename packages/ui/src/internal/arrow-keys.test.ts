// The key table of the arrow-key engines (the roving engine, Tabs.List, Accordion.Root). The
// component suites cover the focus moves.
import { describe, expect, it } from "vitest";
import { resolveArrowKey } from "./arrow-keys.js";

describe("resolveArrowKey", () => {
  it("Home and End are first and last on both axes", () => {
    for (const orientation of ["horizontal", "vertical"] as const) {
      expect(resolveArrowKey("Home", orientation, false)).toBe("first");
      expect(resolveArrowKey("End", orientation, true)).toBe("last");
    }
  });

  it("vertical: ArrowDown / ArrowUp, no left or right, no mirroring", () => {
    expect(resolveArrowKey("ArrowDown", "vertical", false)).toBe("next");
    expect(resolveArrowKey("ArrowUp", "vertical", true)).toBe("prev");
    expect(resolveArrowKey("ArrowLeft", "vertical", false)).toBeNull();
    expect(resolveArrowKey("ArrowRight", "vertical", true)).toBeNull();
  });

  it("horizontal: ArrowRight / ArrowLeft, mirrored in RTL, no up or down", () => {
    expect(resolveArrowKey("ArrowRight", "horizontal", false)).toBe("next");
    expect(resolveArrowKey("ArrowLeft", "horizontal", false)).toBe("prev");
    expect(resolveArrowKey("ArrowRight", "horizontal", true)).toBe("prev");
    expect(resolveArrowKey("ArrowLeft", "horizontal", true)).toBe("next");
    expect(resolveArrowKey("ArrowDown", "horizontal", false)).toBeNull();
  });

  it("other keys are no move", () => {
    expect(resolveArrowKey("Enter", "vertical", false)).toBeNull();
    expect(resolveArrowKey("a", "horizontal", false)).toBeNull();
  });
});
