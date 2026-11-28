// Arrow-key navigation shared by the roving-focus engine, Tabs.List and Accordion.Root
// (conventions 3.10). No directive: pure functions (conventions 7.1).
import type { Orientation } from "./types.js";

export type ArrowMove = "next" | "prev" | "first" | "last";

/**
 * Whether a navigation key is the component's to handle (conventions 3.10 rule 2): not already
 * `defaultPrevented` (a consumer's own `onKeyDown` opted out) and no Alt, Ctrl or Meta held
 * (Ctrl+Home scrolls the page, Alt+ArrowLeft goes back). Shift is not a modifier here.
 */
export function isPlainKey(event: {
  readonly defaultPrevented: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}): boolean {
  return !event.defaultPrevented && !event.altKey && !event.ctrlKey && !event.metaKey;
}

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
