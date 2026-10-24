// Placement of a menu at a point (design/components/context-menu.md 4.2, conventions 12,
// 13.4): the custom properties of the inline base position, that position, and the shipped
// `@position-try` rules that mirror it. No "use client" directive: pure (conventions 7.1).
import type { CSSProperties } from "react";
import type { MenuPlacement } from "./menu-context.js";

/** Custom property carrying the x coordinate of a point-placed popup (viewport px). */
export const MENU_POINT_X = "--menu-point-x";
/** Custom property carrying the y coordinate of a point-placed popup (viewport px). */
export const MENU_POINT_Y = "--menu-point-y";
/**
 * Custom property carrying the vertical gap between the point and the menu: `0px` for a mouse or
 * keyboard open, `16px` for a touch or pen open, which is placed above the finger
 * (context-menu.md 4.7).
 */
export const MENU_POINT_GAP = "--menu-point-gap";
/** The gap of a touch or pen open (context-menu.md 4.7). */
export const MENU_POINT_TOUCH_GAP = "16px";

/** The dedupe key of the shipped rules (`<style href precedence>`). */
export const MENU_POINT_HREF = "@funstack/ui/menu-point";
const UP = `top: auto; bottom: calc(100% - var(${MENU_POINT_Y}) + var(${MENU_POINT_GAP}));`;
const DOWN = `bottom: auto; top: calc(var(${MENU_POINT_Y}) + var(${MENU_POINT_GAP}));`;
const LEFT = `left: auto; right: calc(100% - var(${MENU_POINT_X}));`;
const RIGHT = `right: auto; left: var(${MENU_POINT_X});`;

/**
 * The `@position-try` options that mirror a point-placed popup around the point when it does not
 * fit (context-menu.md 4.2, conventions 12). The base position is inline on the popup: the
 * point's y below (mouse, keyboard) or above (touch, pen, with `--menu-point-gap`) the menu and,
 * by the popup's direction, its left (LTR) or right (RTL) edge at the point's x. A menu names the
 * three options that apply to its direction and pointer kind (`MENU_POINT_FALLBACKS`); the others
 * are inert. Functional at-rules with no selectors: no element is styled. `100%` resolves against
 * the viewport, the top layer's containing block, which `clientX` / `clientY` are measured in.
 * Its SHA-256 is `STYLE_SHA256` in `@funstack/ui/csp` (a jsdom row recomputes it).
 */
export const MENU_POINT_RULES =
  "/* @funstack/ui: placement of a menu at a point. Functional only: the base position is inline " +
  "on the popup (below or above the point and, by direction, its left or right edge at the " +
  "point); these options mirror it around the point when it does not fit. */\n" +
  `@position-try --fsui-menu-up { ${UP} }\n` +
  `@position-try --fsui-menu-down { ${DOWN} }\n` +
  `@position-try --fsui-menu-left { ${LEFT} }\n` +
  `@position-try --fsui-menu-right { ${RIGHT} }\n` +
  `@position-try --fsui-menu-up-left { ${UP} ${LEFT} }\n` +
  `@position-try --fsui-menu-up-right { ${UP} ${RIGHT} }\n` +
  `@position-try --fsui-menu-down-left { ${DOWN} ${LEFT} }\n` +
  `@position-try --fsui-menu-down-right { ${DOWN} ${RIGHT} }\n`;

/**
 * Two equivalent spellings of the point fallback list per direction and pointer kind
 * (`MENU_POINT_FALLBACKS[direction][offset ? "touch" : "mouse"][generation % 2]`), alternated by
 * the placement's generation: changing `position-try-fallbacks` clears the remembered "last
 * successful position option", so a re-show at a new point does not keep the previous flip
 * (design 4.3). The first two options are order-independent (only one of them can fix a given
 * overflow). A move that changes direction or pointer kind changes the list either way.
 * Mouse and keyboard: below the point, flipping up and across; touch and pen: above it, flipping
 * across and down (4.7).
 */
export const MENU_POINT_FALLBACKS = {
  ltr: {
    mouse: [
      "--fsui-menu-up, --fsui-menu-left, --fsui-menu-up-left",
      "--fsui-menu-left, --fsui-menu-up, --fsui-menu-up-left",
    ],
    touch: [
      "--fsui-menu-left, --fsui-menu-down, --fsui-menu-down-left",
      "--fsui-menu-down, --fsui-menu-left, --fsui-menu-down-left",
    ],
  },
  rtl: {
    mouse: [
      "--fsui-menu-up, --fsui-menu-right, --fsui-menu-up-right",
      "--fsui-menu-right, --fsui-menu-up, --fsui-menu-up-right",
    ],
    touch: [
      "--fsui-menu-right, --fsui-menu-down, --fsui-menu-down-right",
      "--fsui-menu-down, --fsui-menu-right, --fsui-menu-down-right",
    ],
  },
} as const;

type PointPlacement = Extract<MenuPlacement, { kind: "point" }>;

/**
 * The inline placement of a point open (context-menu.md 3.3): the point and the gap as custom
 * properties (`--menu-point-gap`: `0px`, `16px` for a touch or pen open, 4.7), and unless the
 * stylesheet owns placement, the menu below the point (`top`) or, for a touch or pen open, above
 * it (`bottom`), and by the popup's direction read at the open (4.6), `left` (LTR) or
 * `right` (RTL: the menu's right edge at the point), with the other two insets `auto`
 * (longhands, so React never sees a shorthand next to its longhands), `position-area: none` (a
 * consumer's anchored `position-area` would otherwise place the popup inside a grid area) and
 * the library's fallbacks for that direction and pointer kind, spelled by generation parity
 * (4.3).
 */
export function pointStyle(point: PointPlacement, stylesheetOwned: boolean): CSSProperties {
  const vars = {
    [MENU_POINT_X]: `${point.x}px`,
    [MENU_POINT_Y]: `${point.y}px`,
    [MENU_POINT_GAP]: point.offset ? MENU_POINT_TOUCH_GAP : "0px",
  };
  if (stylesheetOwned) return vars as CSSProperties;
  const rtl = point.direction === "rtl";
  const kind = point.offset ? "touch" : "mouse";
  return {
    ...vars,
    top: point.offset ? "auto" : `calc(var(${MENU_POINT_Y}) + var(${MENU_POINT_GAP}))`,
    right: rtl ? `calc(100% - var(${MENU_POINT_X}))` : "auto",
    bottom: point.offset ? `calc(100% - var(${MENU_POINT_Y}) + var(${MENU_POINT_GAP}))` : "auto",
    left: rtl ? "auto" : `var(${MENU_POINT_X})`,
    positionArea: "none",
    positionTryFallbacks: MENU_POINT_FALLBACKS[point.direction][kind][point.generation % 2],
  } as CSSProperties;
}
