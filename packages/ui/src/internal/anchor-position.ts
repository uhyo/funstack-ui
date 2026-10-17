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
