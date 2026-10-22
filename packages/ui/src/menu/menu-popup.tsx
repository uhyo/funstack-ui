"use client";
import {
  Activity,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
  ViewTransitionClass,
} from "react";
import {
  FSUI_PRECEDENCE,
  MENU_POINT_FALLBACKS,
  MENU_POINT_HREF,
  MENU_POINT_RULES,
  MENU_POINT_X,
  MENU_POINT_Y,
  POSITION_TRY_FALLBACKS,
  positionArea,
} from "../internal/anchor-position.js";
import type { AnchorAlign, AnchorSide } from "../internal/anchor-position.js";
import { mergeRefs } from "../internal/merge-props.js";
import { ToolbarContext } from "../internal/toolbar-context.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { usePopoverPopup } from "../internal/use-popover-popup.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { claimPress, isHandledBy, MenuListContext, useMenuContext } from "./menu-context.js";
import type { MenuContextValue, MenuListContextValue, MenuPlacement } from "./menu-context.js";
import {
  capturePointer,
  edgeItem,
  focusItem,
  hasModifier,
  isMenuItem,
  isRtl,
  menuItems,
  typeaheadText,
} from "./menu-dom.js";
import { scheduleHoverClose } from "./menu-hover.js";

export type MenuSide = AnchorSide;
export type MenuAlign = AnchorAlign;

export interface MenuPopupState {
  /** Committed open state. Read `:popover-open` for the DOM truth. */
  readonly open: boolean;
  /** `null` with `side={null}`, and while the menu is placed at a point (`context`). */
  readonly side: MenuSide | null;
  readonly align: MenuAlign;
  /** This popup belongs to a submenu. */
  readonly submenu: boolean;
  /**
   * The current open came from a `Menu.ContextTrigger`: the popup is placed at the pointer, with
   * `--menu-point-x` / `--menu-point-y` set inline (`data-context`).
   */
  readonly context: boolean;
}

export interface MenuPopupProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "id"
  | "popover"
  | "role"
  | "aria-labelledby"
  | "onKeyDown"
  | "onFocus"
  | "onBlur"
  | "onMouseDown"
  | "onContextMenu"
  | "onPointerEnter"
  | "onPointerLeave"
  | "onToggle"
  | "onBeforeToggle"
  | "className"
  | "style"
  | "children"
> {
  /**
   * Placement against the Trigger through inline `position-area`, with `position-try-fallbacks`
   * flipping it when it does not fit. Default `"bottom"` for a top-level menu, `"right"` for a
   * submenu (whose fallback is `flip-inline` only). `null` emits no inline positioning (and no
   * `data-side` / `data-align`): the stylesheet owns placement. Ignored for an open from a
   * `Menu.ContextTrigger`, which is placed at the pointer; there `null` also opts out of the
   * inline point placement and the library's `@position-try` rules, leaving only
   * `--menu-point-x` / `--menu-point-y`.
   */
  side?: MenuSide | null;
  /** Alignment along the side. Default `"start"`. Ignored when `side` is `null`. */
  align?: MenuAlign;
  /**
   * `false` (default): the items are not rendered while the menu is closed; mounting them is part
   * of the opening transition, so items that suspend hold the open (and the Trigger pending)
   * until they are ready. `true`: they stay mounted inside `<Activity mode="hidden">`.
   */
  keepMounted?: boolean;
  /**
   * Experimental (Chromium 150+). Renders `focusgroup="menu wrap|nowrap"` and, where the engine
   * implements `focusGroup`, lets the browser handle ArrowUp / ArrowDown / Home / End: items then
   * render no `tabindex` and the library's arrow-key handling steps aside. Typeahead, activation,
   * submenu keys and Tab stay in JS. No effect in other engines. Default `false`.
   */
  experimental_focusgroup?: boolean;
  /**
   * Forwarded to the `<ViewTransition default>` around the popup element. Animates the opening
   * commit and every library-driven close (an item's activation, the Trigger, ArrowLeft, hover
   * leaving a submenu, controlled `open={false}`) in all engines; dismissals (Escape, a click
   * outside, Tab) animate with CSS only. Without it the part renders no `<ViewTransition>`.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, MenuPopupState>;
  style?: StateValue<CSSProperties | undefined, MenuPopupState>;
  children?: StateValue<ReactNode, MenuPopupState>;
  /** Should render a `<div>`; a `<dialog>` would run the dialog focusing steps. */
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuPopupState>;
}

/** Engine capabilities never change while the page lives. */
const subscribeNever = () => () => {};

/** Typeahead buffer lifetime after the last keystroke (design 5.1). */
const TYPEAHEAD_RESET_MS = 500;

const isDev = process.env.NODE_ENV !== "production";

/** What a press may focus inside a popup: items, the popup itself, the consumer's controls. */
const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]:not([contenteditable="false"])';

type PointPlacement = Extract<MenuPlacement, { kind: "point" }>;

/**
 * The inline placement of a point open (context-menu.md 3.3): the point as two custom
 * properties, and unless the stylesheet owns placement, `left` / `top` at it with the other two
 * insets `auto` (longhands, so React never sees a shorthand next to its longhands),
 * `position-area: none` (a consumer's anchored `position-area` would otherwise place the popup
 * inside a grid area) and the library's fallbacks, spelled by generation parity (4.3).
 */
function pointStyle(point: PointPlacement, stylesheetOwned: boolean): CSSProperties {
  const vars = { [MENU_POINT_X]: `${point.x}px`, [MENU_POINT_Y]: `${point.y}px` };
  if (stylesheetOwned) return vars as CSSProperties;
  return {
    ...vars,
    top: `var(${MENU_POINT_Y})`,
    right: "auto",
    bottom: "auto",
    left: `var(${MENU_POINT_X})`,
    positionArea: "none",
    positionTryFallbacks: MENU_POINT_FALLBACKS[point.generation % 2],
  } as CSSProperties;
}

/**
 * The outside right- and middle-click close of a top-level menu (context-menu.md 5): a
 * `contextmenu` outside the menu tree that this menu's ContextTrigger did not handle, or a
 * middle-button `pointerdown` outside it, hides the root popup at once (`"dismiss"` through the
 * `toggle` notification). Chromium's click-based light dismiss ignores those buttons. Returns the
 * cleanup.
 */
function listenOutside(popup: HTMLElement, menu: MenuContextValue): () => void {
  const doc = popup.ownerDocument;
  const inside = (target: EventTarget | null) => target instanceof Node && popup.contains(target);
  const close = () => {
    if (popup.matches(":popover-open")) popup.hidePopover();
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
  doc.addEventListener("contextmenu", onContextMenu);
  doc.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    doc.removeEventListener("contextmenu", onContextMenu);
    doc.removeEventListener("pointerdown", onPointerDown, true);
  };
}

/**
 * The menu itself: `<div popover="auto" role="menu" aria-labelledby={trigger} tabindex="-1">`,
 * placed against its Trigger with CSS Anchor Positioning. Owns the keyboard model (design 5):
 * ArrowUp / ArrowDown / Home / End move focus between items (or the browser does, with
 * `experimental_focusgroup` where supported), printable characters run typeahead, ArrowLeft
 * closes a submenu. The top-level popup closes the whole menu at once when focus leaves it (Tab).
 * Style it with `:popover-open`; it emits `data-side` / `data-align` but no `data-open`.
 *
 * Owned keys (conventions 1.2): `id`, `popover`, `role`, `aria-labelledby` (token-merged),
 * `tabIndex`, `focusgroup` (with the flag), `onKeyDown`, `onBlur`, `onMouseDown` (a press on
 * non-item space keeps focus on the current item), `onContextMenu` (no native menu over this
 * one), `onPointerEnter` / `onPointerLeave`, `data-side` / `data-align` unless `side` is `null`
 * or the menu is placed at a point, and `data-context` for an open from a `Menu.ContextTrigger`
 * (placed at the pointer: `--menu-point-x` / `--menu-point-y` inline, and unless `side` is
 * `null`, `left` / `top` at the point with the library's `@position-try` fallbacks, whose rules
 * it renders as a hoisted `<style>`). A top-level menu closes at once on a right- or
 * middle-click outside it.
 */
export function MenuPopup({
  side: sideProp,
  align = "start",
  keepMounted,
  experimental_focusgroup = false,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: MenuPopupProps) {
  const menu = useMenuContext("Menu.Popup");
  const { popover, submenu, loop } = menu;
  const sideOption = sideProp === undefined ? (submenu ? "right" : "bottom") : sideProp;
  // A ContextTrigger's open is placed at the point; nothing is anchored (context-menu.md 3.3).
  const point = menu.placement.kind === "point" ? menu.placement : null;
  const side = point !== null ? null : sideOption;

  // As Tabs.List (#43): detected only with the flag, never during SSR or hydration.
  const nativeFocusgroup = useSyncExternalStore(
    subscribeNever,
    () => experimental_focusgroup && "focusGroup" in HTMLElement.prototype,
    () => false,
  );

  const typeahead = useRef({ text: "", at: 0 });
  const typingAhead = useCallback(() => {
    const { text, at } = typeahead.current;
    return text !== "" && Date.now() - at <= TYPEAHEAD_RESET_MS;
  }, []);

  // The outside right- / middle-click listeners of a top-level menu, while it is shown.
  const outside = useRef<(() => void) | null>(null);
  const stopOutside = useCallback(() => {
    outside.current?.();
    outside.current = null;
  }, []);
  useEffect(() => stopOutside, [stopOutside]);

  const { setElement, visible, wrapContent, reshow } = usePopoverPopup(popover, {
    part: "Menu.Popup",
    initialFocus: undefined,
    // Design 6.1: the first (or last) enabled item by open cause, nothing for a hover open, the
    // popup itself when there are no items.
    // A pointer open focuses without the focus ring where the engine can be told so (H1).
    resolveInitialFocus: (popup) => {
      const { cause, pointer } = menu.takeOpenCause();
      if (cause === "none") return null;
      const element = edgeItem(popup, cause) ?? popup;
      return pointer ? { element, focusVisible: false } : element;
    },
    keepMounted,
    transition,
    // A point open nests through the region that opened it (context-menu.md 3.1).
    source: () => (point !== null ? point.source : popover.triggerRef.current),
    onToggle: (event) => {
      if (submenu) return;
      const element = popover.popupRef.current;
      if (event.newState === "open" && element !== null && element.matches(":popover-open")) {
        outside.current ??= listenOutside(element, menu);
      } else if (event.newState === "closed") {
        stopOutside();
      }
    },
  });

  // A move (context-menu.md 4.3): the popup is shown and the placement changed since it was
  // shown (a new point, or a right-click in the region while a Trigger open is shown). Re-show
  // it so the respelled fallbacks place it afresh, the source is the region and the first item
  // is focused again; then capture the still-pressed pointer again, against the Firefox / WebKit
  // `pointerup` light dismiss. Runs after the hook's apply effect (declared after it).
  // Once the popup is not visible (hidden, exit animation over) and no open is intended or in
  // flight, a point placement goes back to anchored for the next open that is not a
  // ContextTrigger's: after a point open that was shown and closed, and after one that was
  // rejected or refused (review L1).
  const shownKey = useRef<number | "anchor" | null>(null);
  useLayoutEffect(() => {
    const element = popover.popupRef.current;
    if (element === null) return;
    const key = point !== null ? point.generation : "anchor";
    if (element.matches(":popover-open")) {
      if (shownKey.current !== null && shownKey.current !== key && reshow()) {
        capturePointer(element, point?.pointerId);
      }
      shownKey.current = key;
    } else {
      shownKey.current = null;
      if (!visible && point !== null && !popover.pending && !popover.intended()) {
        menu.resetPlacement(point.generation);
      }
    }
  });

  const devRef = useCallback((element: HTMLElement) => {
    if (isDev && element.tagName === "DIALOG") {
      console.error(
        "Menu.Popup: rendered a <dialog>. Render a <div>: a <dialog popover> runs the dialog " +
          "focusing steps, which fight the menu's item focus.",
      );
    }
    // A press inside a menu is never a long-press of a Menu.ContextTrigger around it (review M1).
    // Native, so it runs before React's root listener dispatches to the region.
    const onPointerDown = (event: Event) => claimPress(event);
    element.addEventListener("pointerdown", onPointerDown);
    return () => element.removeEventListener("pointerdown", onPointerDown);
  }, []);
  const ref = useMemo(() => mergeRefs(setElement, devRef), [setElement, devRef]);

  const listContext = useMemo<MenuListContextValue>(
    () => ({ menu, nativeFocusgroup, typingAhead }),
    [menu, nativeFocusgroup, typingAhead],
  );

  const state: MenuPopupState = {
    open: popover.committed,
    side,
    align,
    submenu,
    context: point !== null,
  };

  const runTypeahead = (popup: HTMLElement, current: HTMLElement | null, key: string): boolean => {
    const now = Date.now();
    const buffer = typeahead.current;
    if (buffer.text === "" || now - buffer.at > TYPEAHEAD_RESET_MS) buffer.text = "";
    if (key === " " && buffer.text === "") return false;
    buffer.text += key.toLowerCase();
    buffer.at = now;
    const items = menuItems(popup);
    if (items.length === 0) return true;
    // A repeated single character cycles through the items starting with it; a longer buffer
    // keeps the current item while it still matches (design 5.1).
    const repeated = [...buffer.text].every((c) => c === buffer.text[0]);
    const search = repeated ? buffer.text[0]! : buffer.text;
    const index = current === null ? -1 : items.indexOf(current);
    const start = repeated || index < 0 ? index + 1 : index;
    for (let i = 0; i < items.length; i++) {
      const item = items[(start + i) % items.length]!;
      if (typeaheadText(item).startsWith(search)) {
        if (item !== current) focusItem(item);
        break;
      }
    }
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || hasModifier(event)) return;
    const popup = event.currentTarget;
    const target = event.target as HTMLElement;
    const onItem = isMenuItem(target, popup);
    if (!onItem && target !== popup) return;
    const key = event.key;

    // ArrowLeft (ArrowRight in RTL) closes a submenu; focus returns to its SubmenuTrigger
    // through the popover hook's nested focus rule (design 6.3).
    if (submenu && key === (isRtl(popup) ? "ArrowRight" : "ArrowLeft")) {
      event.preventDefault();
      popover.requestClose(event.nativeEvent, "activate");
      return;
    }

    if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
      if (!onItem) {
        // The popup itself has focus (no items at open, or focus landed on it some other way):
        // into the list from its edge (review M1).
        event.preventDefault();
        const items = menuItems(popup);
        const item = key === "ArrowDown" || key === "Home" ? items[0] : items.at(-1);
        if (item !== undefined) focusItem(item);
        return;
      }
      // The browser moves focus itself where `focusgroup` is implemented.
      if (nativeFocusgroup) return;
      event.preventDefault();
      const items = menuItems(popup);
      const index = items.indexOf(target);
      const last = items.length - 1;
      let next: number;
      if (key === "Home") next = 0;
      else if (key === "End") next = last;
      else if (key === "ArrowDown") next = index >= last ? (loop ? 0 : last) : index + 1;
      else next = index <= 0 ? (loop ? last : 0) : index - 1;
      const item = items[next];
      if (item !== undefined && item !== target) focusItem(item);
      return;
    }

    if (key.length === 1 && runTypeahead(popup, onItem ? target : null, key)) {
      event.preventDefault();
    }
  };

  // Tab / Shift+Tab or any focus move out of the tree closes the whole stack at once (design
  // 2.2): submenus are DOM descendants of the top-level popup, the Trigger is outside on purpose.
  // A null `relatedTarget` (window blur, a removed element) closes nothing.
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (submenu) return;
    const popup = event.currentTarget;
    const next = event.relatedTarget;
    if (!(next instanceof Node) || popup.contains(next)) return;
    if (popup.matches(":popover-open")) popup.hidePopover();
  };

  // A press on non-item space (padding, a Separator, a GroupLabel) would focus the popup itself
  // (`tabindex="-1"`) and take focus off the current item; keep it where it is (review M1, the
  // pointer-focus model of design 6.2). Focusable content of the consumer's (a text field) still
  // takes focus.
  const onMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    const focusable = target.closest(FOCUSABLE_SELECTOR);
    if (focusable === null || focusable.getAttribute("role") === "menu") event.preventDefault();
  };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: popover.ids.popup,
    popover: "auto",
    role: "menu",
    "aria-labelledby": menu.triggerId,
    // The popup itself takes focus as the last resort when a menu has no items.
    tabIndex: -1,
    ...(experimental_focusgroup && { focusgroup: `menu ${loop ? "wrap" : "nowrap"}` }),
    onKeyDown,
    onBlur,
    onMouseDown,
    // No native menu over the custom one. The popup is a sibling of any ContextTrigger, so this
    // event never reaches a region as a move; an outer region sees it prevented and stays quiet.
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
    },
    ...(submenu && {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== "touch") menu.timers.cancelClose();
      },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== "touch") scheduleHoverClose(menu, event.nativeEvent);
      },
    }),
    ...(side !== null && { "data-side": side, "data-align": align }),
    "data-context": point !== null ? "" : undefined,
  };

  // The shipped `@position-try` rules (conventions 12): hoisted into <head> and deduplicated by
  // React, rendered only by a point open that does not opt out with `side={null}`.
  const pointRules =
    point !== null && sideOption !== null ? (
      <style href={MENU_POINT_HREF} precedence={FSUI_PRECEDENCE}>
        {MENU_POINT_RULES}
      </style>
    ) : null;

  const content = (s: MenuPopupState): ReactNode => {
    let node: ReactNode;
    if (keepMounted === true) {
      node = (
        <Activity mode={visible ? "visible" : "hidden"}>
          {wrapContent(resolveStateValue(children, s))}
        </Activity>
      );
    } else {
      node = visible ? wrapContent(resolveStateValue(children, s)) : null;
    }
    // Not part of an enclosing Toolbar: a Menu.Trigger or ToggleGroup in here sees no Toolbar.
    return (
      <MenuListContext value={listContext}>
        {pointRules}
        <ToolbarContext value={null}>{node}</ToolbarContext>
      </MenuListContext>
    );
  };

  const element = useRender<ComponentPropsWithRef<"div">, MenuPopupState>({
    defaultElement: "div",
    render,
    state,
    className,
    // The inline placement sits under the consumer's style: the consumer wins.
    style:
      point !== null
        ? (s) => ({ ...pointStyle(point, sideOption === null), ...resolveStateValue(style, s) })
        : side === null
          ? style
          : (s) => ({
              positionArea: positionArea(side, align),
              positionTryFallbacks: submenu ? "flip-inline" : POSITION_TRY_FALLBACKS,
              ...resolveStateValue(style, s),
            }),
    children: content,
    props: rest,
    libraryProps,
    ref,
  });

  return useTransitionBoundary("Menu.Popup", transition, element);
}

MenuPopup.displayName = "MenuPopup";
