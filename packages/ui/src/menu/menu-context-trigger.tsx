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
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { markHandled, MenuRegionContext, useMenuContext } from "./menu-context.js";
import { capturePointer, isEditableTarget } from "./menu-dom.js";

export interface MenuContextTriggerState {
  /** Optimistic open state (the Root's). */
  readonly open: boolean;
  /** The Root's transition is pending (an open or a close in flight). */
  readonly pending: boolean;
  readonly disabled: boolean;
}

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

/** Movement that cancels a long-press (Base UI's slop). */
const LONG_PRESS_SLOP = 10;

const isDev = process.env.NODE_ENV !== "production";

/** `pointerdown` events a region already started a long-press for (nested regions). */
const claimedPresses = new WeakSet<Event>();

interface LongPress {
  readonly pointerId: number;
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
    "Menu.ContextTrigger: rendered in a submenu. A Menu.Root inside a Menu.Popup is a submenu; a " +
      "context menu region belongs to a top-level Menu.Root.",
  );
  useDevWarning(
    longPressDelay < 0,
    "Menu.ContextTrigger: `longPressDelay` is negative; it is a number of milliseconds.",
  );

  // Modality bookkeeping (design 2.1): a sequence number, not a clock, so two events in the same
  // millisecond still order.
  const sequence = useRef(0);
  const lastPointerDown = useRef(-1);
  const lastKeyDown = useRef(-1);
  const longPress = useRef<LongPress | null>(null);
  // Disarms the one-shot click swallow armed by a long-press open.
  const disarmSwallow = useRef<(() => void) | null>(null);
  const warnedNoPopup = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPress.current !== null) clearTimeout(longPress.current.timer);
    longPress.current = null;
  }, []);

  useEffect(
    () => () => {
      cancelLongPress();
      disarmSwallow.current?.();
    },
    [cancelLongPress],
  );
  // A region disabled mid-gesture opens nothing.
  useEffect(() => {
    if (disabled) cancelLongPress();
  }, [disabled, cancelLongPress]);

  // `keydown` is observed, not owned: the region is full of the consumer's interactive content.
  // Capture, so a descendant's `stopPropagation()` does not hide the key from the bookkeeping.
  const keyRef = useCallback((element: HTMLElement) => {
    const onKeyDown = () => {
      lastKeyDown.current = ++sequence.current;
    };
    element.addEventListener("keydown", onKeyDown, true);
    return () => element.removeEventListener("keydown", onKeyDown, true);
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

  /** One-shot swallow of the `click` an engine may synthesise when the long-press ends (2.2). */
  const armClickSwallow = (doc: Document) => {
    disarmSwallow.current?.();
    const onClick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      disarm();
    };
    const disarm = () => {
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("pointerdown", disarm, true);
      if (disarmSwallow.current === disarm) disarmSwallow.current = null;
    };
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("pointerdown", disarm, true);
    disarmSwallow.current = disarm;
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
    cancelLongPress();
    const keyboard = native.button === -1 || lastKeyDown.current > lastPointerDown.current;
    const pointerId = (native as globalThis.PointerEvent).pointerId;
    const id = typeof pointerId === "number" ? pointerId : undefined;
    // whatwg/html#10905: in Firefox and WebKit the pending `pointerup` would light-dismiss a
    // menu opened between `pointerdown` and `pointerup`. Capture now, on the still-hidden popup:
    // the open commit lands at an unpredictable time relative to the `pointerup`.
    if (native.buttons !== 0) capturePointer(popup, id);
    menu.openAt(
      { x: native.clientX, y: native.clientY },
      { source: event.currentTarget, event: native, pointer: !keyboard, pointerId: id },
    );
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    lastPointerDown.current = ++sequence.current;
    const native = event.nativeEvent;
    if (longPress.current !== null) {
      // A second finger: not a long-press.
      cancelLongPress();
      return;
    }
    if (disabled || (native.pointerType !== "touch" && native.pointerType !== "pen")) return;
    if (fromOwnPopup(native.target)) return;
    if (!native.isPrimary || claimedPresses.has(native)) return;
    if (editableTargets === "native" && isEditableTarget(native.target)) return;
    // The innermost enabled region times the press; outer regions leave it (as `contextmenu`'s
    // `defaultPrevented` rule, design 2.4).
    claimedPresses.add(native);
    const source = event.currentTarget;
    const { pointerId, clientX, clientY } = native;
    const timer = setTimeout(
      () => {
        longPress.current = null;
        const popup = popupElement();
        if (popup === null) return;
        // The finger is still down: its `pointerup` would light-dismiss in WebKit.
        capturePointer(popup, pointerId);
        armClickSwallow(source.ownerDocument);
        menu.openAt(
          { x: clientX, y: clientY },
          { source, event: native, pointer: true, pointerId },
        );
      },
      Math.max(0, longPressDelay),
    );
    longPress.current = { pointerId, x: clientX, y: clientY, timer };
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
    ref: keyRef,
  });
}

MenuContextTrigger.displayName = "MenuContextTrigger";
