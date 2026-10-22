import { describe, expect, it } from "vitest";
import {
  MENU_POINT_FALLBACKS,
  MENU_POINT_RULES,
  MENU_POINT_X,
  MENU_POINT_Y,
  POSITION_TRY_FALLBACKS,
  positionArea,
} from "./anchor-position.js";
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

describe("point placement (context menu)", () => {
  it("ships three @position-try options named --fsui-menu-*, no selectors", () => {
    for (const name of ["--fsui-menu-up", "--fsui-menu-left", "--fsui-menu-up-left"]) {
      expect(MENU_POINT_RULES).toContain(`@position-try ${name} {`);
    }
    expect(MENU_POINT_RULES).toContain(`bottom: calc(100% - var(${MENU_POINT_Y}))`);
    expect(MENU_POINT_RULES).toContain(`right: calc(100% - var(${MENU_POINT_X}))`);
    // Only at-rules: every rule block starts with `@position-try`.
    const rules = MENU_POINT_RULES.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+\{[^{}]*\}/g);
    expect(rules).toHaveLength(3);
    for (const rule of rules!) expect(rule.trim().startsWith("@position-try --fsui-")).toBe(true);
  });

  it("has two spellings of the same option set", () => {
    const [a, b] = MENU_POINT_FALLBACKS;
    expect(a).not.toBe(b);
    const set = (s: string) =>
      s
        .split(",")
        .map((x) => x.trim())
        .sort();
    expect(set(a)).toEqual(set(b));
    expect(a.endsWith("--fsui-menu-up-left")).toBe(true);
    expect(b.endsWith("--fsui-menu-up-left")).toBe(true);
  });
});
