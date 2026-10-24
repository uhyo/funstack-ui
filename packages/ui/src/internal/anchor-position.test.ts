import { describe, expect, it, vi } from "vitest";
import {
  MENU_POINT_FALLBACKS,
  MENU_POINT_GAP,
  MENU_POINT_RULES,
  MENU_POINT_X,
  MENU_POINT_Y,
} from "../menu/menu-point.js";
import { POSITION_TRY_FALLBACKS, parsePositionArea, positionArea } from "./anchor-position.js";
import type { AnchorAlign, AnchorSide, Direction, ResolvedPlacement } from "./anchor-position.js";

describe("positionArea", () => {
  // Conventions 13.1: physical keywords and the `self-*` group only, never a plain logical one.
  const matrix: [AnchorSide, AnchorAlign, string][] = [
    ["top", "center", "top"],
    ["top", "start", "top span-self-x-end"],
    ["top", "end", "top span-self-x-start"],
    ["bottom", "center", "bottom"],
    ["bottom", "start", "bottom span-self-x-end"],
    ["bottom", "end", "bottom span-self-x-start"],
    ["left", "center", "left"],
    ["left", "start", "left span-bottom"],
    ["left", "end", "left span-top"],
    ["right", "center", "right"],
    ["right", "start", "right span-bottom"],
    ["right", "end", "right span-top"],
    ["inline-start", "center", "self-x-start"],
    ["inline-start", "start", "self-x-start span-bottom"],
    ["inline-start", "end", "self-x-start span-top"],
    ["inline-end", "center", "self-x-end"],
    ["inline-end", "start", "self-x-end span-bottom"],
    ["inline-end", "end", "self-x-end span-top"],
  ];

  it.each(matrix)("%s + %s is %s", (side, align, area) => {
    expect(positionArea(side, align)).toBe(area);
  });

  it("never emits a plain logical keyword", () => {
    for (const [side, align] of matrix) {
      for (const word of positionArea(side, align).split(" ")) {
        expect(word).toMatch(/^(span-)?(top|bottom|left|right|self-x-start|self-x-end)$/);
      }
    }
  });

  it("flips the block axis, then the inline axis, then both", () => {
    expect(POSITION_TRY_FALLBACKS).toBe("flip-block, flip-inline, flip-block flip-inline");
  });
});

describe("parsePositionArea", () => {
  const p = (side: ResolvedPlacement["side"], align: AnchorAlign): ResolvedPlacement => ({
    side,
    align,
  });
  // Serialisations the engines produce (research computed-serialization.mjs) and the cells the
  // library emits, in LTR and RTL.
  const rows: [string, Direction, ResolvedPlacement | null][] = [
    ["top", "ltr", p("top", "center")],
    ["bottom", "rtl", p("bottom", "center")],
    ["span-all bottom", "ltr", p("bottom", "center")], // Firefox's form of a flipped `bottom`
    ["span-all top", "rtl", p("top", "center")],
    ["center top", "ltr", p("top", "center")],
    ["span-left top", "ltr", p("top", "end")],
    ["span-right top", "ltr", p("top", "start")],
    ["span-left bottom", "rtl", p("bottom", "start")],
    ["span-self-x-end bottom", "ltr", p("bottom", "start")],
    ["span-self-x-end bottom", "rtl", p("bottom", "start")],
    ["span-self-x-start top", "ltr", p("top", "end")],
    ["span-self-x-start top", "rtl", p("top", "end")],
    ["bottom span-self-x-end", "ltr", p("bottom", "start")],
    ["left span-bottom", "ltr", p("left", "start")],
    ["right span-top", "rtl", p("right", "end")],
    ["span-bottom right", "ltr", p("right", "start")],
    ["self-x-end span-bottom", "ltr", p("right", "start")],
    ["self-x-end span-bottom", "rtl", p("left", "start")],
    ["self-x-start span-top", "ltr", p("left", "end")],
    ["self-x-start span-top", "rtl", p("right", "end")],
    ["self-x-end", "rtl", p("left", "center")],
    ["self-x-end span-all", "ltr", p("right", "center")],
    ["self-end span-self-end", "ltr", p("bottom", "start")],
    ["self-end span-self-end", "rtl", p("bottom", "start")],
    ["self-start span-self-start", "ltr", p("top", "end")],
    ["self-block-end span-self-inline-end", "rtl", p("bottom", "start")],
    ["y-end span-self-x-start", "ltr", p("bottom", "end")],
    ["block-end", "ltr", p("bottom", "center")],
    // Not a placement of the table: null, the part keeps the requested values.
    ["none", "ltr", null],
    ["", "ltr", null],
    ["   ", "ltr", null],
    ["center", "ltr", null],
    ["span-all", "ltr", null],
    ["top left", "ltr", null],
    ["start", "ltr", null],
    ["span-top bottom", "ltr", null],
    ["bottom span-self-x-end extra", "ltr", null],
    ["bogus", "ltr", null],
    ["top span-bogus", "ltr", null],
  ];

  it.each(rows)("%j (%s) is %j", (value, direction, expected) => {
    expect(parsePositionArea(value, direction, "ltr")).toEqual(expected);
  });

  it("maps plain inline tokens through the root's direction, read lazily", () => {
    const root = vi.fn((): Direction => "rtl");
    expect(parsePositionArea("bottom span-self-x-end", "ltr", root)).toEqual(p("bottom", "start"));
    expect(root).not.toHaveBeenCalled();
    // A consumer override with plain logical keywords: `span-x-end` is the root's inline-end.
    expect(parsePositionArea("span-x-end bottom", "ltr", root)).toEqual(p("bottom", "end"));
    expect(parsePositionArea("inline-end span-bottom", "ltr", root)).toEqual(p("left", "start"));
    expect(parsePositionArea("end span-end", "ltr", root)).toEqual(p("bottom", "end"));
    // Read once per parse at most.
    root.mockClear();
    parsePositionArea("x-end span-x-start", "ltr", root);
    expect(root).toHaveBeenCalledTimes(1);
  });

  it("returns null for a vertical writing mode and a missing value", () => {
    expect(parsePositionArea("bottom", "ltr", "ltr", "vertical-rl")).toBeNull();
    expect(parsePositionArea("bottom", "ltr", "ltr", "sideways-lr")).toBeNull();
    expect(parsePositionArea(undefined, "ltr", "ltr")).toBeNull();
    expect(parsePositionArea(null, "ltr", "ltr")).toBeNull();
  });

  it("reads back every cell it emits, in both directions", () => {
    const physical = { ltr: { start: "left", end: "right" }, rtl: { start: "right", end: "left" } };
    for (const direction of ["ltr", "rtl"] as const) {
      for (const side of [
        "top",
        "bottom",
        "left",
        "right",
        "inline-start",
        "inline-end",
      ] as const) {
        for (const align of ["start", "center", "end"] as const) {
          const expectedSide =
            side === "inline-start"
              ? physical[direction].start
              : side === "inline-end"
                ? physical[direction].end
                : side;
          expect(parsePositionArea(positionArea(side, align), direction, "ltr")).toEqual({
            side: expectedSide,
            align,
          });
        }
      }
    }
  });
});

describe("point placement (context menu)", () => {
  const OPTIONS = ["up", "down", "left", "right", "up-left", "up-right", "down-left", "down-right"];

  it("ships eight @position-try options named --fsui-menu-*, no selectors", () => {
    for (const name of OPTIONS) {
      expect(MENU_POINT_RULES).toContain(`@position-try --fsui-menu-${name} {`);
    }
    // The vertical options carry the touch gap (0px for a mouse open, 4.7).
    expect(MENU_POINT_RULES).toContain(
      `@position-try --fsui-menu-up { top: auto; bottom: calc(100% - var(${MENU_POINT_Y}) + var(${MENU_POINT_GAP})); }`,
    );
    expect(MENU_POINT_RULES).toContain(
      `@position-try --fsui-menu-down { bottom: auto; top: calc(var(${MENU_POINT_Y}) + var(${MENU_POINT_GAP})); }`,
    );
    expect(MENU_POINT_RULES).toContain(
      `@position-try --fsui-menu-left { left: auto; right: calc(100% - var(${MENU_POINT_X})); }`,
    );
    expect(MENU_POINT_RULES).toContain(
      `@position-try --fsui-menu-right { right: auto; left: var(${MENU_POINT_X}); }`,
    );
    // Only at-rules: every rule block starts with `@position-try`.
    const rules = MENU_POINT_RULES.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+\{[^{}]*\}/g);
    expect(rules).toHaveLength(8);
    for (const rule of rules!) expect(rule.trim().startsWith("@position-try --fsui-")).toBe(true);
  });

  it.each([
    ["ltr", "mouse", "--fsui-menu-up-left"],
    ["rtl", "mouse", "--fsui-menu-up-right"],
    ["ltr", "touch", "--fsui-menu-down-left"],
    ["rtl", "touch", "--fsui-menu-down-right"],
  ] as const)("has two spellings of the same %s %s option set", (direction, kind, corner) => {
    const [a, b] = MENU_POINT_FALLBACKS[direction][kind];
    expect(a).not.toBe(b);
    const set = (s: string) =>
      s
        .split(",")
        .map((x) => x.trim())
        .sort();
    expect(set(a)).toEqual(set(b));
    expect(a.endsWith(corner)).toBe(true);
    expect(b.endsWith(corner)).toBe(true);
    // Every named option is shipped.
    for (const name of set(a)) expect(MENU_POINT_RULES).toContain(`@position-try ${name} {`);
  });

  it("an LTR menu never names the RTL options, and the reverse", () => {
    for (const kind of ["mouse", "touch"] as const) {
      for (const spelling of MENU_POINT_FALLBACKS.ltr[kind]) expect(spelling).not.toMatch(/right/);
      for (const spelling of MENU_POINT_FALLBACKS.rtl[kind]) expect(spelling).not.toMatch(/left/);
    }
  });

  it("a touch menu flips down, a mouse menu up", () => {
    for (const direction of ["ltr", "rtl"] as const) {
      for (const spelling of MENU_POINT_FALLBACKS[direction].mouse) {
        expect(spelling).not.toMatch(/down/);
      }
      for (const spelling of MENU_POINT_FALLBACKS[direction].touch)
        expect(spelling).not.toMatch(/up/);
    }
  });
});
