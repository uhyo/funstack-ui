"use client";
import { useCallback, useEffect, useRef } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import { isPopoverOpen } from "../internal/popover-open.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import {
  claimPress,
  isPressClaimed,
  markHandled,
  MenuRegionContext,
  submenuHover,
  useMenuContext,
} from "./menu-context.js";
import { capturePointer, isDisabledItem, isEditableTarget, ITEM_SELECTOR } from "./menu-dom.js";
import type { MenuTriggerState } from "./menu-trigger.js";

export type MenuContextTriggerState = MenuTriggerState;

export interface MenuContextTriggerProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "onContextMenu"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "className"
  | "style"
  | "children"
> {
  /** The region does nothing; a `contextmenu` bubbles on to an outer region. `data-disabled`. */
  disabled?: boolean;
  /**
   * What a `contextmenu` (or long-press) on an editable target inside the region opens: the
   * browser's own menu (`"native"`, default: copy and paste keep working) or this menu.
   * Editable: a text-taking `<input>`, a `<textarea>`, an element with `isContentEditable`.
   */
  editableTargets?: "native" | "menu";
  /** Milliseconds a touch or pen pointer must stay down (within 10 px) to open. Default 500. */
  longPressDelay?: number;
  className?: StateValue<string | undefined, MenuContextTriggerState>;
  style?: StateValue<CSSProperties | undefined, MenuContextTriggerState>;
  children?: StateValue<ReactNode, MenuContextTriggerState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuContextTriggerState>;
}

/** Movement that cancels a long-press (Base UI's slop); also a touch drag's activation slop. */
const LONG_PRESS_SLOP = 10;
/**
 * Movement a mouse or pen press-drag-release needs before a release activates or dismisses
 * (Chromium's `kMaximumLengthMovedToActivate`, macOS's "moved"; context-menu.md 2.6).
 */
const DRAG_SLOP = 4;
/** A release outside the menu dismisses it only this long after the open (GTK, Base UI). */
const DRAG_DISMISS_DELAY = 500;

const isDev = process.env.NODE_ENV !== "production";

interface LongPress {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly x: number;
  readonly y: number;
  readonly timer: ReturnType<typeof setTimeout>;
}

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

const isTouchLike = (pointerType: string) => pointerType === "touch" || pointerType === "pen";

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
function startDrag(popup: HTMLElement, options: DragOptions): () => void {
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
function guardTouch(doc: Document, pointerId: number): () => void {
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
 * A region whose `contextmenu` (right-click, Ctrl+click, Shift+F10 / the ContextMenu key at a
 * focused descendant) or touch / pen long-press opens the Root's `Menu.Popup` at the pointer
 * (design/components/context-menu.md). A plain element (default `div`) with no role and no ARIA:
 * the region keeps its own semantics (`render={<tr />}`), and keyboard users reach it through
 * focusable content inside it. A second right-click inside the region while the menu is open moves
 * the menu there. Render the `Menu.Popup` as a sibling of the region where the markup allows; in
 * a table row (`render={<tr />}`), inside one of its cells: events from inside the popup are
 * never the region's.
 *
 * Owned keys (conventions 1.2): `onContextMenu`, `onPointerDown`, `onPointerMove`,
 * `onPointerUp`, `onPointerCancel`, `data-open`, `data-pending`, `data-disabled`, and the style
 * key `WebkitTouchCallout` (`"none"`; the consumer's `style` wins).
 */
export function MenuContextTrigger({
  disabled = false,
  editableTargets = "native",
  longPressDelay = 500,
  className,
  style,
  children,
  render,
  ...rest
}: MenuContextTriggerProps) {
  const menu = useMenuContext("Menu.ContextTrigger");
  const { popover } = menu;
  useDevWarning(
    menu.submenu,
    isDev &&
      "Menu.ContextTrigger: rendered in a submenu. A Menu.Root inside a Menu.Popup is a submenu; a " +
        "context menu region belongs to a top-level Menu.Root.",
  );
  useDevWarning(
    longPressDelay < 0,
    isDev && "Menu.ContextTrigger: `longPressDelay` is negative; it is a number of milliseconds.",
  );

  // Modality bookkeeping (design 2.1): a sequence number, not a clock, so two events in the same
  // millisecond still order.
  const sequence = useRef(0);
  const lastPointerDown = useRef(-1);
  const lastKeyDown = useRef(-1);
  const longPress = useRef<LongPress | null>(null);
  // Disarms the one-shot click swallow armed by a long-press open or a drag activation.
  const disarmSwallow = useRef<(() => void) | null>(null);
  // Ends the running press-drag-release gesture and its touch guard (2.6).
  const endDrag = useRef<(() => void) | null>(null);
  const warnedNoPopup = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPress.current !== null) clearTimeout(longPress.current.timer);
    longPress.current = null;
  }, []);

  const stopDrag = useCallback(() => {
    endDrag.current?.();
    endDrag.current = null;
  }, []);

  useEffect(
    () => () => {
      cancelLongPress();
      stopDrag();
      disarmSwallow.current?.();
    },
    [cancelLongPress, stopDrag],
  );
  // A region disabled mid-gesture opens nothing.
  useEffect(() => {
    if (disabled) cancelLongPress();
  }, [disabled, cancelLongPress]);

  // A close ends any armed click swallow and the drag gesture.
  const open = popover.optimistic;
  useEffect(() => {
    if (open) return;
    disarmSwallow.current?.();
    stopDrag();
  }, [open, stopDrag]);

  // The modality bookkeeping observes `keydown` and `pointerdown` without owning them (the region
  // is full of the consumer's interactive content), in the capture phase, so a descendant's
  // `stopPropagation()` (a slider, a drag handle) does not hide them.
  const modalityRef = useCallback((element: HTMLElement) => {
    const onKeyDown = () => {
      lastKeyDown.current = ++sequence.current;
    };
    const onPointerDown = () => {
      lastPointerDown.current = ++sequence.current;
    };
    element.addEventListener("keydown", onKeyDown, true);
    element.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      element.removeEventListener("keydown", onKeyDown, true);
      element.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  /** The popup element to capture on and open, or `null` (no Popup mounted: nothing opens). */
  const popupElement = (): HTMLElement | null => {
    const popup = popover.popupRef.current;
    if (popup === null && isDev && !warnedNoPopup.current) {
      warnedNoPopup.current = true;
      console.error(
        "Menu.ContextTrigger: a context menu was requested but the Menu.Root has no mounted " +
          "Menu.Popup; the browser's own menu shows instead.",
      );
    }
    return popup;
  };

  /**
   * One-shot swallow of the `click` an engine may synthesise when the long-press ends (2.2),
   * scoped to that release: the click comes in the same task as the `pointerup` of
   * `pointerId`, so the swallow ends one task after that `pointerup` (or `pointercancel`), and at
   * once on any `keydown`, the next `pointerdown`, or the menu closing. iOS synthesises no click
   * after a long-press; a swallow left armed would eat the next keyboard activation
   * (`element.click()`).
   */
  const armClickSwallow = (doc: Document, pointerId: number, releasing = false) => {
    disarmSwallow.current?.();
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
      if (disarmSwallow.current === disarm) disarmSwallow.current = null;
    };
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("pointerdown", disarm, true);
    doc.addEventListener("keydown", disarm, true);
    doc.addEventListener("pointerup", onRelease, true);
    doc.addEventListener("pointercancel", onRelease, true);
    disarmSwallow.current = disarm;
    // Armed from inside the release itself (a drag activation): the click comes in this task.
    if (releasing) released = setTimeout(disarm, 0);
  };

  /**
   * Starts the press-drag-release gesture of 2.6 on the pointer the popup captured at this open
   * or move (a new one replaces the running one), with the touch guard for a finger.
   */
  const beginDrag = (
    popup: HTMLElement,
    pointerId: number,
    point: { readonly x: number; readonly y: number },
    pointerType: string,
    slop: number,
  ) => {
    stopDrag();
    const doc = popup.ownerDocument;
    const end = startDrag(popup, {
      pointerId,
      x: point.x,
      y: point.y,
      slop,
      activate: (item) => {
        disarmSwallow.current?.();
        item.click();
        armClickSwallow(doc, pointerId, true);
      },
    });
    const unguard = pointerType === "touch" ? guardTouch(doc, pointerId) : null;
    endDrag.current = () => {
      end();
      unguard?.();
    };
  };

  /**
   * The event comes from this Root's own popup, rendered inside the region (a table row, where a
   * `<div>` cannot be a sibling of the `<tr>`): never a move or a long-press of the region.
   */
  const fromOwnPopup = (target: EventTarget | null): boolean => {
    const popup = popover.popupRef.current;
    return popup !== null && target instanceof Node && popup.contains(target);
  };

  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    const native = event.nativeEvent;
    // An inner region or a consumer handler was first (the Popup's own handler prevents a
    // right-click inside the menu); a disabled region lets the event bubble on to an outer
    // region (design 2.4).
    if (native.defaultPrevented || disabled || fromOwnPopup(native.target)) return;
    // Copy and paste keep the browser's menu (2.3).
    if (editableTargets === "native" && isEditableTarget(native.target)) return;
    const popup = popupElement();
    if (popup === null) return;
    native.preventDefault();
    markHandled(native, menu);
    // Android and pen: the platform's own `contextmenu` arrived during our timer; it opens.
    const timed = longPress.current;
    cancelLongPress();
    const keyboard = native.button === -1 || lastKeyDown.current > lastPointerDown.current;
    const pointerEvent = native as globalThis.PointerEvent;
    const pointerType =
      timed?.pointerType ??
      (typeof pointerEvent.pointerType === "string" ? pointerEvent.pointerType : "mouse");
    // The pointer still down: the one this event reports, or (Android, whose touch `contextmenu`
    // has `buttons === 0`) the finger the long-press was timing.
    const pointerId =
      native.buttons !== 0 && typeof pointerEvent.pointerId === "number"
        ? pointerEvent.pointerId
        : (timed?.pointerId ?? undefined);
    const point = { x: native.clientX, y: native.clientY };
    // whatwg/html#10905: in Firefox and WebKit the pending `pointerup` would light-dismiss a
    // menu opened between `pointerdown` and `pointerup`. Capture now, on the still-hidden popup:
    // the open commit lands at an unpredictable time relative to the `pointerup`. With the
    // capture, the press-drag-release gesture runs (2.6); Windows (`contextmenu` after the
    // release) and the keyboard take neither.
    if (pointerId !== undefined && capturePointer(popup, pointerId)) {
      const slop = timed !== null || pointerType === "touch" ? LONG_PRESS_SLOP : DRAG_SLOP;
      beginDrag(popup, pointerId, point, pointerType, slop);
    }
    menu.openAt(point, {
      source: event.currentTarget,
      event: native,
      pointer: !keyboard,
      pointerId,
      // A touch or pen open is placed above the point (4.7).
      offset: !keyboard && isTouchLike(pointerType),
    });
  };

  // The long-press only; the modality bookkeeping is `modalityRef`'s.
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const native = event.nativeEvent;
    if (longPress.current !== null) {
      // A second finger: not a long-press.
      cancelLongPress();
      return;
    }
    if (disabled || (native.pointerType !== "touch" && native.pointerType !== "pen")) return;
    // A press inside any Menu.Popup (this Root's, or another menu inside the region) is claimed by
    // that popup; a press an inner region already times is claimed by it.
    if (fromOwnPopup(native.target)) return;
    if (!native.isPrimary || isPressClaimed(native)) return;
    if (editableTargets === "native" && isEditableTarget(native.target)) return;
    // The innermost enabled region times the press; outer regions leave it (as `contextmenu`'s
    // `defaultPrevented` rule, design 2.4).
    claimPress(native);
    const source = event.currentTarget;
    const { pointerId, pointerType, clientX, clientY } = native;
    const timer = setTimeout(
      () => {
        longPress.current = null;
        const popup = popupElement();
        if (popup === null) return;
        const point = { x: clientX, y: clientY };
        // The finger is still down: its `pointerup` would light-dismiss in WebKit. The capture
        // also lets it slide onto an item and lift to activate it (2.6).
        if (capturePointer(popup, pointerId)) {
          beginDrag(popup, pointerId, point, pointerType, LONG_PRESS_SLOP);
        }
        armClickSwallow(source.ownerDocument, pointerId);
        menu.openAt(point, { source, event: native, pointer: true, pointerId, offset: true });
      },
      Math.max(0, longPressDelay),
    );
    longPress.current = { pointerId, pointerType, x: clientX, y: clientY, timer };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const press = longPress.current;
    if (press === null || event.pointerId !== press.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_SLOP) {
      cancelLongPress();
    }
  };

  // `pointercancel`: the browser took the gesture for panning (the region stays scrollable).
  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    const press = longPress.current;
    if (press !== null && event.pointerId === press.pointerId) cancelLongPress();
  };

  const state: MenuContextTriggerState = {
    open: popover.optimistic,
    pending: popover.pending,
    disabled,
  };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    onContextMenu,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    "data-open": dataAttr(state.open),
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"div">, MenuContextTriggerState>({
    defaultElement: "div",
    render,
    state,
    className,
    // iOS link and image previews appear at about the long-press time (2.2).
    style: (s) => ({ WebkitTouchCallout: "none", ...resolveStateValue(style, s) }),
    // A Menu.Root inside is a nested region's menu (no "outside its Popup" warning).
    children: (s) => (
      <MenuRegionContext value={true}>{resolveStateValue(children, s)}</MenuRegionContext>
    ),
    props: rest,
    libraryProps,
    ref: modalityRef,
  });
}

MenuContextTrigger.displayName = "MenuContextTrigger";
