import { describe, expect, it } from "vitest";
import { POSITION_TRY_FALLBACKS, positionArea } from "./anchor-position.js";
import type { AnchorAlign, AnchorSide } from "./anchor-position.js";

describe("positionArea", () => {
  const matrix: [AnchorSide, AnchorAlign, string][] = [
    ["top", "center", "top"],
    ["top", "start", "top span-right"],
    ["top", "end", "top span-left"],
    ["bottom", "center", "bottom"],
    ["bottom", "start", "bottom span-right"],
    ["bottom", "end", "bottom span-left"],
    ["left", "center", "left"],
    ["left", "start", "left span-bottom"],
    ["left", "end", "left span-top"],
    ["right", "center", "right"],
    ["right", "start", "right span-bottom"],
    ["right", "end", "right span-top"],
  ];

  it.each(matrix)("%s + %s is %s", (side, align, area) => {
    expect(positionArea(side, align)).toBe(area);
  });

  it("flips the block axis, then the inline axis, then both", () => {
    expect(POSITION_TRY_FALLBACKS).toBe("flip-block, flip-inline, flip-block flip-inline");
  });
});
