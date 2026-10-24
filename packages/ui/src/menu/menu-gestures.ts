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
 * Press-drag-release (context-menu.md 2.6). The popup holds the capture of `pointerId`, so its
 * items see no boundary events and the gesture hit-tests with `elementFromPoint`. A move focuses
 * the item under the pointer without the ring (a SubmenuTrigger starts its hover intent); a
 * release beyond the slop activates an enabled, non-submenu item through `click()`, or dismisses
 * when outside every popup of the tree at least 500 ms after the popup was shown (not after the
 * press: an async open appears late). Ends at the release, `pointercancel`,
 * `lostpointercapture` or the close. Returns the cleanup.
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
 * The touch guard while the finger that opened a menu is down (context-menu.md 2.2): a
 * non-passive `touchmove` listener keeps its drag from becoming a pan (`pointercancel`), and the
 * lift's `touchend` is prevented so no click is synthesised (it would light-dismiss the menu or
 * activate an item twice). Only that finger's lift ends it, recognised by order (its
 * `pointerup` comes first; pointer events carry no `Touch.identifier`); other fingers'
 * `touchend`s are prevented too. Also ends at `touchcancel`, the pointer's `pointercancel`, and
 * shortly after its `pointerup` when no touch event follows. Returns the cleanup.
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

/**
 * One-shot swallow of the `click` an engine may synthesise when the long-press ends (2.2),
 * scoped to that release: the click comes in the same task as the `pointerup` of
 * `pointerId`, so the swallow ends one task after that `pointerup` (or `pointercancel`), and at
 * once on any `keydown`, the next `pointerdown`, or the menu closing. iOS synthesises no click
 * after a long-press; a swallow left armed would eat the next keyboard activation
 * (`element.click()`). `slot` holds the disarm of the armed swallow (one per region).
 */
export function armClickSwallow(
  slot: { current: (() => void) | null },
  doc: Document,
  pointerId: number,
  releasing = false,
): void {
  slot.current?.();
  let released: ReturnType<typeof setTimeout> | undefined;
  const onClick = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    disarm();
  };
  const onRelease = (event: Event) => {
    if ((event as globalThis.PointerEvent).pointerId !== pointerId) return;
    if (released === undefined) released = setTimeout(disarm, 0);
  };
  const disarm = () => {
    if (released !== undefined) clearTimeout(released);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("pointerdown", disarm, true);
    doc.removeEventListener("keydown", disarm, true);
    doc.removeEventListener("pointerup", onRelease, true);
    doc.removeEventListener("pointercancel", onRelease, true);
    if (slot.current === disarm) slot.current = null;
  };
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("pointerdown", disarm, true);
  doc.addEventListener("keydown", disarm, true);
  doc.addEventListener("pointerup", onRelease, true);
  doc.addEventListener("pointercancel", onRelease, true);
  slot.current = disarm;
  // Armed from inside the release itself (a drag activation): the click comes in this task.
  if (releasing) released = setTimeout(disarm, 0);
}
