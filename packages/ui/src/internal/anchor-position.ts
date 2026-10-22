// Placement of a popover against its implicit anchor (the invoker set by `commandfor`,
// `interestfor` or `showPopover({ source })`): inline `position-area` from a side and an
// alignment, plus `position-try-fallbacks` that flip it when it does not fit. Shared by Tooltip,
// Popover and Menu (design/components/tooltip.md 7.1, popover.md 8).
//
// No "use client" directive: pure functions, importable from anywhere (conventions 7.1).

/** Physical side of the anchor the popup is placed on. */
export type AnchorSide = "top" | "bottom" | "left" | "right";
/** Alignment along that side. */
export type AnchorAlign = "start" | "center" | "end";

/** Flip to the opposite side, then the other axis, then both, when the popup does not fit. */
export const POSITION_TRY_FALLBACKS = "flip-block, flip-inline, flip-block flip-inline";

/**
 * The `position-area` for a side and an alignment (physical keywords): `bottom` + `center` is
 * `bottom`, `bottom` + `start` is `bottom span-right`, `right` + `start` is `right span-bottom`,
 * and so on.
 */
export function positionArea(side: AnchorSide, align: AnchorAlign): string {
  if (align === "center") return side;
  const vertical = side === "top" || side === "bottom";
  const span = vertical
    ? align === "start"
      ? "span-right"
      : "span-left"
    : align === "start"
      ? "span-bottom"
      : "span-top";
  return `${side} ${span}`;
}

// --- Placement at a point (design/components/context-menu.md 4.2, conventions 12) ------------

/** Custom property carrying the x coordinate of a point-placed popup (viewport px). */
export const MENU_POINT_X = "--menu-point-x";
/** Custom property carrying the y coordinate of a point-placed popup (viewport px). */
export const MENU_POINT_Y = "--menu-point-y";

/** The dedupe key of the shipped rules (`<style href precedence>`). */
export const MENU_POINT_HREF = "@funstack/ui/menu-point";
/** The React stylesheet precedence bucket of the library's functional CSS. */
export const FSUI_PRECEDENCE = "fsui";

/**
 * The library's only shipped CSS: three `@position-try` options that mirror a point-placed popup
 * (`left` / `top` at the point, inline) around the point when it does not fit: upward, leftward,
 * both. Functional at-rules with no selectors: no element is styled. `100%` resolves against the
 * viewport, the top layer's containing block, which `clientX` / `clientY` are measured in.
 */
export const MENU_POINT_RULES =
  "/* @funstack/ui: placement of a menu at a point. Functional only: the base position is inline " +
  "on the popup (left/top at the point); these options mirror it around the point when it does " +
  "not fit. */\n" +
  `@position-try --fsui-menu-up { top: auto; bottom: calc(100% - var(${MENU_POINT_Y})); }\n` +
  `@position-try --fsui-menu-left { left: auto; right: calc(100% - var(${MENU_POINT_X})); }\n` +
  `@position-try --fsui-menu-up-left { top: auto; bottom: calc(100% - var(${MENU_POINT_Y})); ` +
  `left: auto; right: calc(100% - var(${MENU_POINT_X})); }\n`;

/**
 * Two equivalent spellings of the point fallback list, alternated by the placement's generation:
 * changing `position-try-fallbacks` clears the remembered "last successful position option", so a
 * re-show at a new point does not keep the previous flip (design 4.3). The first two options are
 * order-independent (only one of them can fix a given overflow).
 */
export const MENU_POINT_FALLBACKS = [
  "--fsui-menu-up, --fsui-menu-left, --fsui-menu-up-left",
  "--fsui-menu-left, --fsui-menu-up, --fsui-menu-up-left",
] as const;
