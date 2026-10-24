// The pointer gestures of Menu.ContextTrigger (design/components/context-menu.md 2.2, 2.6). No
// "use client" directive: DOM listeners only (conventions 7.1).
import { isPopoverOpen } from "../internal/popover-open.js";
import { submenuHover } from "./menu-context.js";
import { isDisabledItem, ITEM_SELECTOR } from "./menu-dom.js";

/** Movement that cancels a long-press (Base UI's slop); also a touch drag's activation slop. */
export const LONG_PRESS_SLOP = 10;
/**
 * Movement a mouse or pen press-drag-release needs before a release activates or dismisses
 * (Chromium's `kMaximumLengthMovedToActivate`, macOS's "moved"; context-menu.md 2.6).
 */
export const DRAG_SLOP = 4;
/** A release outside the menu dismisses it only this long after the open (GTK, Base UI). */
const DRAG_DISMISS_DELAY = 500;

interface DragOptions {
  readonly pointerId: number;
  /** The open point: the slop is measured from it. */
  readonly x: number;
  readonly y: number;
  readonly slop: number;
  /**
   * Activates `item` for a release: through `item.click()`, with the click swallow of a long-press
   * out of the way and armed again for the click an engine may synthesise from this release.
   */
  readonly activate: (item: HTMLElement) => void;
}

export const isTouchLike = (pointerType: string) =>
  pointerType === "touch" || pointerType === "pen";

/**
 * Press-drag-release (context-menu.md 2.6): while the popup holds the capture of `pointerId`
 * (taken at the open), every `pointermove` and the `pointerup` target the popup and items never
 * see boundary events, so the gesture hit-tests with `elementFromPoint`. A move focuses the item
 * under the pointer quietly (a SubmenuTrigger also starts its hover intent); a release more than
 * the slop away from the open point activates an enabled, non-submenu item through its
 * `click()` (Menu's one activation path), or dismisses the menu when it lands outside every popup
 * of the tree at least 500 ms after the open; any other release leaves the menu open. Ends at the
 * release, `pointercancel`, `lostpointercapture` and the menu closing. Returns the cleanup.
 *
 * The 500 ms count from when the popup is shown, not from the press: with an async
 * `openChangeAction` or suspending items the menu appears only when they settle. A
 * gesture that starts on a popup already showing (a move) counts from its start.
 */
export function startDrag(popup: HTMLElement, options: DragOptions): () => void {
  const doc = popup.ownerDocument;
  // `performance.now()` at the first open `toggle`; null until the popup has been shown.
  let shownAt: number | null = isPopoverOpen(popup) ? performance.now() : null;
  // The SubmenuTrigger the pointer is over, whose hover intent is running.
  let submenuTrigger: HTMLElement | null = null;

  const ours = (event: Event) => (event as globalThis.PointerEvent).pointerId === options.pointerId;
  const hitTest = (event: globalThis.PointerEvent): Element | null =>
    typeof doc.elementFromPoint === "function"
      ? doc.elementFromPoint(event.clientX, event.clientY)
      : null;
  /** The item under the pointer, inside this menu's tree (submenus are DOM descendants). */
  const itemAt = (target: Element | null): HTMLElement | null => {
    const item = target?.closest<HTMLElement>(ITEM_SELECTOR) ?? null;
    return item !== null && popup.contains(item) ? item : null;
  };
  /** The pointer is over the submenu `trigger` opens (its popup is the `commandfor` target). */
  const inSubmenuOf = (trigger: HTMLElement, target: Element | null) => {
    const id = trigger.getAttribute("commandfor");
    const submenu = id === null ? null : doc.getElementById(id);
    return submenu !== null && target !== null && submenu.contains(target);
  };
  const hoverSubmenu = (next: HTMLElement | null, event: Event) => {
    if (next === submenuTrigger) return;
    if (submenuTrigger !== null) submenuHover(submenuTrigger)?.leave(event);
    submenuTrigger = next;
    if (next !== null) submenuHover(next)?.enter(event);
  };

  const onMove = (event: globalThis.PointerEvent) => {
    if (!ours(event)) return;
    const target = hitTest(event);
    const item = itemAt(target);
    // Menu 6.2's pointer focus, without the ring: keyboard and pointer agree on the current item.
    if (item !== null && doc.activeElement !== item) {
      item.focus({ focusVisible: false } as FocusOptions);
    }
    if (item !== null && submenuHover(item) !== undefined) hoverSubmenu(item, event);
    else if (submenuTrigger !== null && !inSubmenuOf(submenuTrigger, target)) {
      hoverSubmenu(null, event);
    }
  };
  const onUp = (event: globalThis.PointerEvent) => {
    if (!ours(event)) return;
    end();
    const moved = Math.hypot(event.clientX - options.x, event.clientY - options.y) > options.slop;
    // Time alone never activates or dismisses: a stationary release keeps the menu open.
    if (!moved) return;
    const target = hitTest(event);
    if (target !== null && popup.contains(target)) {
      const item = itemAt(target);
      // A disabled item, a SubmenuTrigger (native menus activate nothing there), a separator or
      // padding: the menu stays open.
      if (item === null || isDisabledItem(item) || item.hasAttribute("aria-haspopup")) return;
      options.activate(item);
      return;
    }
    if (
      shownAt !== null &&
      performance.now() - shownAt >= DRAG_DISMISS_DELAY &&
      isPopoverOpen(popup)
    ) {
      popup.hidePopover();
    }
  };
  const onEnd = (event: Event) => {
    if (ours(event)) end();
  };
  const onToggle = () => {
    if (!isPopoverOpen(popup)) end();
    else shownAt ??= performance.now();
  };
  const end = () => {
    popup.removeEventListener("pointermove", onMove);
    popup.removeEventListener("pointerup", onUp);
    popup.removeEventListener("pointercancel", onEnd);
    popup.removeEventListener("lostpointercapture", onEnd);
    popup.removeEventListener("toggle", onToggle);
    submenuTrigger = null;
  };
  popup.addEventListener("pointermove", onMove);
  popup.addEventListener("pointerup", onUp);
  popup.addEventListener("pointercancel", onEnd);
  popup.addEventListener("lostpointercapture", onEnd);
  popup.addEventListener("toggle", onToggle);
  return end;
}

/** How long the touch guard waits for the `touchend` that follows the finger's `pointerup`. */
const TOUCH_END_WAIT = 250;

/**
 * While the finger that opened a touch menu is still down, the browser must not take its drag
 * as a pan (it would end the stream with `pointercancel`): a non-passive document `touchmove`
 * listener prevents it (context-menu.md 2.2). The lift's `touchend`, which follows that
 * pointer's `pointerup`, is prevented as well, so the engine synthesises no click from it: a click
 * where the finger was (beside the offset menu) would light-dismiss the menu in Chromium, and one
 * over an item would activate it a second time. Ends at that `touchend` / `touchcancel`, at the
 * pointer's `pointercancel`, and shortly after its `pointerup` if no touch event follows (a
 * synthetic pointer). Returns the cleanup.
 *
 * Only the gesture finger's lift ends it: another finger lifting while it is still
 * down must not hand its next slide to panning. Pointer events expose no `Touch.identifier`, so
 * the lift is recognised by order: the engines dispatch a lift's `pointerup` and `touchend` from
 * the same input, the `pointerup` first. A `touchend` before that pointer's `pointerup` is another
 * finger's; it is still prevented (no click may light-dismiss the menu mid-gesture).
 */
export function guardTouch(doc: Document, pointerId: number): () => void {
  let fallback: ReturnType<typeof setTimeout> | undefined;
  // The gesture's pointer has lifted: the next `touchend` is its own.
  let lifted = false;
  const onTouchMove = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const onTouchEnd = (event: Event) => {
    if (event.cancelable) event.preventDefault();
    if (lifted) end();
  };
  const onPointerUp = (event: Event) => {
    if ((event as globalThis.PointerEvent).pointerId !== pointerId) return;
    lifted = true;
    fallback ??= setTimeout(end, TOUCH_END_WAIT);
  };
  const onPointerCancel = (event: Event) => {
    if ((event as globalThis.PointerEvent).pointerId === pointerId) end();
  };
  const end = () => {
    if (fallback !== undefined) clearTimeout(fallback);
    doc.removeEventListener("touchmove", onTouchMove);
    doc.removeEventListener("touchend", onTouchEnd);
    doc.removeEventListener("touchcancel", end, true);
    doc.removeEventListener("pointerup", onPointerUp, true);
    doc.removeEventListener("pointercancel", onPointerCancel, true);
  };
  doc.addEventListener("touchmove", onTouchMove, { passive: false });
  doc.addEventListener("touchend", onTouchEnd, { passive: false });
  doc.addEventListener("touchcancel", end, true);
  doc.addEventListener("pointerup", onPointerUp, true);
  doc.addEventListener("pointercancel", onPointerCancel, true);
  return end;
}
