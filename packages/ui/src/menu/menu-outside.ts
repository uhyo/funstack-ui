// The outside right- and middle-click, scroll and wheel handling of an open top-level menu
// (design/components/context-menu.md 5). No "use client" directive: DOM listeners only
// (conventions 7.1).
import { isPopoverOpen } from "../internal/popover-open.js";
import { isHandledBy } from "./menu-context.js";
import type { MenuContextValue, MenuPlacement } from "./menu-context.js";

/**
 * The element under a wheel event that can scroll the way the wheel turns, up to `popup`: then
 * the wheel is the menu's own and the page under it is not involved.
 */
function scrollsWithin(popup: HTMLElement, target: EventTarget | null, event: WheelEvent) {
  const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
  const delta = vertical ? event.deltaY : event.deltaX;
  if (delta === 0) return true;
  let element = target instanceof Element ? target : null;
  while (element !== null && popup.contains(element)) {
    const computed = element.ownerDocument.defaultView?.getComputedStyle(element);
    const overflow = computed?.[vertical ? "overflowY" : "overflowX"] ?? "";
    if (overflow === "auto" || overflow === "scroll" || overflow === "overlay") {
      // Scroll offsets run 0..room (down, or right in LTR) or -room..0 (right to left).
      const room = vertical
        ? element.scrollHeight - element.clientHeight
        : element.scrollWidth - element.clientWidth;
      const offset = vertical ? element.scrollTop : element.scrollLeft;
      const min = !vertical && computed?.direction === "rtl" ? -room : 0;
      if (room > 0 && (delta > 0 ? offset < min + room - 0.5 : offset > min + 0.5)) return true;
    }
    element = element.parentElement;
  }
  return false;
}

/**
 * The outside right- and middle-click close of a top-level menu (context-menu.md 5): a
 * `contextmenu` outside the menu tree that this menu's ContextTrigger did not handle, or a
 * middle-button `pointerdown` outside it, hides the root popup at once (`"dismiss"` through the
 * `toggle` notification). Chromium's click-based light dismiss ignores those buttons.
 *
 * While the menu is placed at a point (4.8; read at each event: a right-click may
 * re-place a Trigger-opened menu), a `scroll` of the document or of an element that contains the
 * region closes it the same way; scrolls elsewhere and inside the menu are ignored. Scrolling
 * already in flight at the open (a smooth scroll, trackpad momentum) does not count: scroll
 * events are ignored until the first animation frame without one. And a `wheel`
 * over any menu never scrolls the page: it is prevented unless something in the menu under the
 * pointer can scroll that way, or it is a zoom (`ctrlKey`: Ctrl+wheel, trackpad pinch). Returns
 * the cleanup.
 */
export function listenOutside(
  popup: HTMLElement,
  menu: MenuContextValue,
  placement: () => MenuPlacement,
): () => void {
  const doc = popup.ownerDocument;
  const inside = (target: EventTarget | null) => target instanceof Node && popup.contains(target);
  const close = () => {
    if (isPopoverOpen(popup)) popup.hidePopover();
  };
  // Bubble phase: the region's handler ran first and marked a move.
  const onContextMenu = (event: Event) => {
    if (inside(event.target) || isHandledBy(event, menu)) return;
    close();
  };
  const onPointerDown = (event: Event) => {
    if ((event as globalThis.PointerEvent).button !== 1 || inside(event.target)) return;
    close();
  };
  // Scroll events run in a frame's rendering steps, before its animation frame callbacks: the
  // first callback that saw none since the last one ends the in-flight scroll window.
  const view = doc.defaultView;
  let settling = typeof view?.requestAnimationFrame === "function";
  let scrolledThisFrame = false;
  let frame = 0;
  const tick = () => {
    if (scrolledThisFrame) {
      scrolledThisFrame = false;
      frame = view!.requestAnimationFrame(tick);
    } else settling = false;
  };
  if (settling) frame = view!.requestAnimationFrame(tick);
  const onScroll = (event: Event) => {
    if (settling) {
      scrolledThisFrame = true;
      return;
    }
    const current = placement();
    if (current.kind !== "point") return;
    const target = event.target;
    // The point is meaningless once the content under it moved: the document, or a scroller
    // around the region (React Aria's rule). A scroller elsewhere or inside the menu is not.
    if (target instanceof Node && target.nodeType !== Node.DOCUMENT_NODE) {
      if (inside(target) || !target.contains(current.source)) return;
    }
    close();
  };
  // Native menus never scroll the page from inside the menu; a non-overflowing popup would chain
  // the wheel to the page (Firefox ignores `overscroll-behavior` there).
  const onWheel = (event: WheelEvent) => {
    // A zoom, not a scroll: Ctrl+wheel and a trackpad pinch (`wheel` with `ctrlKey`) stay the
    // user's.
    if (event.ctrlKey) return;
    if (!scrollsWithin(popup, event.target, event)) event.preventDefault();
  };
  doc.addEventListener("contextmenu", onContextMenu);
  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("scroll", onScroll, { capture: true, passive: true });
  popup.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    if (settling) view!.cancelAnimationFrame(frame);
    doc.removeEventListener("contextmenu", onContextMenu);
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("scroll", onScroll, { capture: true });
    popup.removeEventListener("wheel", onWheel);
  };
}
