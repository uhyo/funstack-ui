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
import { capturePointer } from "../internal/pointer-capture.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import {
  claimPress,
  isPressClaimed,
  markHandled,
  MenuRegionContext,
  useMenuContext,
} from "./menu-context.js";
import { isEditableTarget } from "./menu-dom.js";
import {
  armClickSwallow,
  DRAG_SLOP,
  guardTouch,
  isTouchLike,
  LONG_PRESS_SLOP,
  startDrag,
} from "./menu-gestures.js";
import type { MenuTriggerState } from "./menu-trigger.js";

/** State of `Menu.ContextTrigger`: the same shape as `MenuTriggerState`. */
export type MenuContextTriggerState = MenuTriggerState;

/**
 * Props of `Menu.ContextTrigger`.
 *
 * @see https://ui.funstack.work/components/context-menu
 */
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
  /**
   * The region does nothing; a `contextmenu` bubbles on to an outer region. `data-disabled`.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * What a `contextmenu` (or long-press) on an editable target inside the region opens: the
   * browser's own menu (`"native"`, default: copy and paste keep working) or this menu.
   * Editable: a text-taking `<input>`, a `<textarea>`, an element with `isContentEditable`.
   *
   * @defaultValue `"native"`
   */
  editableTargets?: "native" | "menu";
  /**
   * Milliseconds a touch or pen pointer must stay down (within 10 px) to open.
   *
   * @defaultValue `500`
   */
  longPressDelay?: number;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenuContextTriggerState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenuContextTriggerState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MenuContextTriggerState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuContextTriggerState>;
}

const isDev = process.env.NODE_ENV !== "production";

interface LongPress {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly x: number;
  readonly y: number;
  readonly timer: ReturnType<typeof setTimeout>;
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
 *
 * @see https://ui.funstack.work/components/context-menu
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
        armClickSwallow(disarmSwallow, doc, pointerId, true);
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
        armClickSwallow(disarmSwallow, source.ownerDocument, pointerId);
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
