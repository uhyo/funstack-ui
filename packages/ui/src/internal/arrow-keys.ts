// Arrow-key navigation shared by the roving-focus engine and Tabs.List. No directive: pure
// functions (conventions 7.1).
import type { Orientation } from "./types.js";

export type ArrowMove = "next" | "prev" | "first" | "last";

/** The move `key` makes along `orientation` (Home / End on both axes; mirrored when `rtl`). */
export function resolveArrowKey(
  key: string,
  orientation: Orientation,
  rtl: boolean,
): ArrowMove | null {
  switch (key) {
    case "Home":
      return "first";
    case "End":
      return "last";
    case "ArrowRight":
      return orientation === "horizontal" ? (rtl ? "prev" : "next") : null;
    case "ArrowLeft":
      return orientation === "horizontal" ? (rtl ? "next" : "prev") : null;
    case "ArrowDown":
      return orientation === "vertical" ? "next" : null;
    case "ArrowUp":
      return orientation === "vertical" ? "prev" : null;
    default:
      return null;
  }
}

/** Keyboard focus: the ring shows even where the engine's heuristic would not. */
export function focusWithRing(element: HTMLElement): void {
  element.focus({ focusVisible: true } as FocusOptions);
}
