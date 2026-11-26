// The Drawer's swipe to dismiss (design/components/drawer.md 4, 5): the glue between the
// dialog-agnostic tracker (`internal/swipe.ts`) and a `<dialog>`: which presses are candidates,
// which way the edge is, how far it is, the custom properties, and the release that finishes
// the slide before the browser closes the dialog. No directive: DOM listeners only
// (conventions 7.1); only `drawer-popup.tsx` imports it.
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import { animationBaseline, exitAnimations } from "../internal/overlay/use-exit-animation.js";
import { swipeTranslation } from "../internal/swipe-arithmetic.js";
import type { SwipeDirection } from "../internal/swipe-arithmetic.js";
import { trackSwipe } from "../internal/swipe.js";

/** The edge a drawer is attached to (conventions 13.1's `AnchorSide` vocabulary). */
export type DrawerSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";

/** The custom properties the drag writes (design 4.3). */
export const SWIPE_X = "--drawer-swipe-x";
export const SWIPE_Y = "--drawer-swipe-y";
export const SWIPE_PROGRESS = "--drawer-swipe-progress";
/** Present on the Popup while a pointer drags it (design 4.3). */
export const SWIPING = "data-swiping";

/** Whether the drawer's axis is vertical (`top` / `bottom`). */
export function isVerticalSide(side: DrawerSide): boolean {
  return side === "top" || side === "bottom";
}

/**
 * The inline `touch-action` of a drawer with the swipe on (design 5.1): the browser keeps the
 * cross axis and pinch zoom, the drawer's axis is the page's.
 */
export function swipeTouchAction(side: DrawerSide): string {
  return isVerticalSide(side) ? "pan-x pinch-zoom" : "pan-y pinch-zoom";
}

/**
 * The direction a swipe dismisses toward: toward the side. An inline side reads the dialog's
 * computed `direction`, at the press (design 2): a gesture-time read, not placement.
 */
export function swipeDirectionOf(side: DrawerSide, dialog: Element): SwipeDirection {
  switch (side) {
    case "top":
      return "up";
    case "bottom":
      return "down";
    case "left":
      return "left";
    case "right":
      return "right";
    case "inline-start":
    case "inline-end": {
      const rtl = getComputedStyle(dialog).direction === "rtl";
      return (side === "inline-end") !== rtl ? "right" : "left";
    }
  }
}

/**
 * The distance that takes the dialog fully off its edge (design 4.1), from its box now (the
 * offset is still 0 when the drag starts): for `down`, the viewport's height minus its top.
 */
export function swipeExtent(dialog: Element, direction: SwipeDirection): number {
  const rect = dialog.getBoundingClientRect();
  const view = dialog.ownerDocument.defaultView;
  const width = view?.innerWidth ?? 0;
  const height = view?.innerHeight ?? 0;
  switch (direction) {
    case "down":
      return Math.max(0, height - rect.top);
    case "up":
      return Math.max(0, rect.bottom);
    case "right":
      return Math.max(0, width - rect.left);
    case "left":
      return Math.max(0, rect.right);
  }
}

/** Whether a pointer event on the dialog itself lies outside its border box (the `::backdrop`). */
function onBackdrop(dialog: Element, event: PointerEvent): boolean {
  const rect = dialog.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return !(rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom);
}

function isTextEntry(element: Element): boolean {
  if (element.matches("input, textarea, select")) return true;
  if ((element as HTMLElement).isContentEditable === true) return true;
  // jsdom has no `isContentEditable`.
  const editable = element.getAttribute("contenteditable");
  return editable !== null && editable.toLowerCase() !== "false";
}

/** Computed `overflow` on the axis makes a scroll container there (design 5.1). */
function scrollsOn(element: Element, vertical: boolean): boolean {
  const style = getComputedStyle(element);
  const overflow = vertical ? style.overflowY : style.overflowX;
  return overflow === "auto" || overflow === "scroll";
}

/**
 * Whether a press can become a swipe of `dialog` (design 4.1 "Not a candidate", 5.1, 8.1): not
 * on the `::backdrop`; its nearest `<dialog>` is this one (not a nested one); not inside an open
 * popover, a text-entry or range control, or a scroll container along the drawer's axis between
 * the target and the dialog (by computed `overflow`, whatever the overflow amount).
 */
export function isSwipeCandidate(
  dialog: HTMLDialogElement,
  event: PointerEvent,
  vertical: boolean,
): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (target === dialog) return !onBackdrop(dialog, event);
  if (target.closest("dialog") !== dialog) return false;
  for (let node: Element | null = target; node !== null && node !== dialog;) {
    if (isTextEntry(node)) return false;
    if (node.hasAttribute("popover") && isPopoverOpen(node)) return false;
    if (scrollsOn(node, vertical)) return false;
    node = node.parentElement;
  }
  return true;
}

function clearOffset(dialog: HTMLElement): void {
  dialog.style.removeProperty(SWIPE_X);
  dialog.style.removeProperty(SWIPE_Y);
  dialog.style.removeProperty(SWIPE_PROGRESS);
}

function writeOffset(
  dialog: HTMLElement,
  offset: number,
  progress: number,
  direction: SwipeDirection,
): void {
  const [x, y] = swipeTranslation(offset, direction);
  dialog.style.setProperty(SWIPE_X, `${x}px`);
  dialog.style.setProperty(SWIPE_Y, `${y}px`);
  dialog.style.setProperty(SWIPE_PROGRESS, String(progress));
}

/**
 * Installs the swipe on a drawer's `<dialog>` and returns its cleanup (design 4.1, 4.2).
 * `dismiss(event)` records the close intent and calls `requestClose()`.
 */
export function listenDrawerSwipe(
  dialog: HTMLDialogElement,
  side: DrawerSide,
  dismiss: (event: Event) => void,
): () => void {
  const vertical = isVerticalSide(side);
  let direction: SwipeDirection = "down";
  /** A dismissal waits for its slide: presses start nothing meanwhile. */
  let closing = false;
  let disposed = false;

  const tracker = trackSwipe(dialog, {
    press: (event) => {
      if (closing || !dialog.open || !isSwipeCandidate(dialog, event, vertical)) return null;
      direction = swipeDirectionOf(side, dialog);
      return direction;
    },
    extent: () => swipeExtent(dialog, direction),
    start: () => {
      dialog.setAttribute(SWIPING, "");
    },
    move: (offset, progress) => {
      writeOffset(dialog, offset, progress, direction);
    },
    end: ({ outcome, event, extent }) => {
      // What already runs (an entry still sliding in, a spinner inside) is not the release.
      const baseline = animationBaseline(dialog);
      dialog.removeAttribute(SWIPING);
      if (outcome !== "dismiss") {
        // The consumer's transition on `translate` brings the drawer back.
        clearOffset(dialog);
        return;
      }
      // Finish the motion first (design 4.2): the same transition carries the drawer off its
      // edge while the dialog is still open, which every engine animates.
      writeOffset(dialog, extent, 1, direction);
      closing = true;
      const close = (): void => {
        closing = false;
        if (disposed || !dialog.open) return;
        dismiss(event);
        // A consumer's `cancel` listener kept it open: slide back.
        if (dialog.open) clearOffset(dialog);
      };
      const animations = exitAnimations(dialog, baseline);
      if (animations.length === 0) close();
      else void Promise.allSettled(animations.map((animation) => animation.finished)).then(close);
    },
  });

  // The dialog closing for any other reason (Escape, a Close, a Form settling) aborts a drag;
  // the custom properties go with the `close` event, not before (the closing frame keeps them).
  const onBeforeToggle = (event: Event): void => {
    if (event.target !== dialog) return;
    if ((event as ToggleEvent).newState === "open") {
      clearOffset(dialog);
      return;
    }
    if (tracker.dragging()) {
      tracker.cancel();
      dialog.removeAttribute(SWIPING);
    }
  };
  const onClose = (event: Event): void => {
    if (event.target !== dialog) return;
    tracker.cancel();
    dialog.removeAttribute(SWIPING);
    clearOffset(dialog);
  };
  dialog.addEventListener("beforetoggle", onBeforeToggle);
  dialog.addEventListener("close", onClose);

  return () => {
    disposed = true;
    tracker.dispose();
    dialog.removeEventListener("beforetoggle", onBeforeToggle);
    dialog.removeEventListener("close", onClose);
    dialog.removeAttribute(SWIPING);
    clearOffset(dialog);
  };
}
