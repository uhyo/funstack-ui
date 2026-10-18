"use client";
import { Activity, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
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
import { POSITION_TRY_FALLBACKS, positionArea } from "../internal/anchor-position.js";
import type { AnchorAlign, AnchorSide } from "../internal/anchor-position.js";
import { mergeRefs } from "../internal/merge-props.js";
import { ToolbarContext } from "../internal/toolbar-context.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { usePopoverPopup } from "../internal/use-popover-popup.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { MenuListContext, useMenuContext } from "./menu-context.js";
import type { MenuListContextValue } from "./menu-context.js";
import {
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
  readonly side: MenuSide | null;
  readonly align: MenuAlign;
  /** This popup belongs to a submenu. */
  readonly submenu: boolean;
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
   * `data-side` / `data-align`): the stylesheet owns placement.
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
 * non-item space keeps focus on the current item), `onPointerEnter` / `onPointerLeave`, and
 * `data-side` / `data-align` unless `side` is `null`.
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
  const side = sideProp === undefined ? (submenu ? "right" : "bottom") : sideProp;

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

  const { setElement, visible, wrapContent } = usePopoverPopup(popover, {
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
  });

  const devRef = useCallback((element: HTMLElement) => {
    if (isDev && element.tagName === "DIALOG") {
      console.error(
        "Menu.Popup: rendered a <dialog>. Render a <div>: a <dialog popover> runs the dialog " +
          "focusing steps, which fight the menu's item focus.",
      );
    }
    return () => {};
  }, []);
  const ref = useMemo(() => mergeRefs(setElement, devRef), [setElement, devRef]);

  const listContext = useMemo<MenuListContextValue>(
    () => ({ menu, nativeFocusgroup, typingAhead }),
    [menu, nativeFocusgroup, typingAhead],
  );

  const state: MenuPopupState = { open: popover.committed, side, align, submenu };

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
    ...(submenu && {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== "touch") menu.timers.cancelClose();
      },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== "touch") scheduleHoverClose(menu, event.nativeEvent);
      },
    }),
    ...(side !== null && { "data-side": side, "data-align": align }),
  };

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
      side === null
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
