"use client";
import { useEffect, useMemo, useRef } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
} from "react";
import { focusWithRing } from "../internal/arrow-keys.js";
import { sortByDocumentOrder } from "../internal/dom-order.js";
import { MenubarContext } from "../internal/menubar-context.js";
import type {
  MenubarContextValue,
  MenubarMenu,
  MenubarOpenFocus,
} from "../internal/menubar-context.js";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useLatest } from "../internal/use-latest.js";
import { useRender } from "../internal/use-render.js";
import { useRovingFocus } from "../internal/use-roving-focus.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Menubar`, passed to the function forms of `className`, `style`, `children` and
 * `render`. Empty: the bar holds no open state (each menu is its own state owner).
 */
export interface MenubarState {}

/**
 * Props of `Menubar`.
 *
 * @see https://ui.funstack.work/components/menubar
 */
export interface MenubarProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "onKeyDown" | "onFocus" | "onBlur" | "onPointerDown" | "className" | "style" | "children"
> {
  /**
   * Arrow keys (on the bar and from inside its menus) wrap from the last menu to the first and
   * back.
   *
   * @defaultValue `true`
   */
  loop?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenubarState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenubarState>;
  /** The menus of the bar (`Menu.Root`s), or a function of the part's state. */
  children?: StateValue<ReactNode, MenubarState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MenubarState>;
}

const STATE: MenubarState = {};

/** The roving engine's entry: the first Trigger before any was focused. */
function firstItem(items: readonly HTMLElement[]): HTMLElement | undefined {
  return items[0];
}

/**
 * The shown popup of a menu of the bar is hidden at once (a dismissal, reported by its `toggle`);
 * an open still pending is superseded (design/components/menubar.md 2.2 step 2, 4).
 */
function closeMenu(menu: MenubarMenu, event: Event): void {
  const popup = menu.popup();
  if (popup !== null && isPopoverOpen(popup)) {
    popup.hidePopover();
  } else if (menu.intended() && !menu.hiddenBeforeToggle()) {
    menu.supersede(event);
  }
}

/**
 * `<div role="menubar">` (WAI-ARIA APG Menubar): a row of top-level `Menu.Root`s whose
 * `Menu.Trigger`s are the items of the bar (`role="menuitem"`). One Tab stop with
 * ArrowLeft / ArrowRight / Home / End between the Triggers (the Toolbar's roving engine);
 * ArrowRight / ArrowLeft inside a menu, the same keys on the Trigger of an open menu and the
 * pointer moving onto another Trigger while a menu is open switch menus. The bar holds no open
 * state: each `Menu.Root` keeps its own (design/components/menubar.md). Name it with
 * `aria-label` or `aria-labelledby`.
 *
 * Owned keys (conventions 1.2): `role`, `onKeyDown`, `onFocus`, `onBlur`, `onPointerDown`.
 *
 * @see https://ui.funstack.work/components/menubar
 */
export function Menubar({
  loop = true,
  className,
  style,
  children,
  render,
  ...rest
}: MenubarProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const roving = useRovingFocus(rootRef, {
    orientation: "horizontal",
    loop,
    native: false,
    entry: firstItem,
    memory: true,
  });
  const latestLoop = useLatest(loop);

  // The menus of the bar, keyed by their Trigger element (design 2.1). Order is the DOM order of
  // the Triggers, read when a key is pressed.
  const registry = useRef(new Map<HTMLElement, MenubarMenu>());

  const context = useMemo<MenubarContextValue>(() => {
    const menus = registry.current;
    const switchTo = (
      target: HTMLElement,
      focus: MenubarOpenFocus,
      event: Event,
      pointer: boolean,
    ) => {
      const menu = menus.get(target);
      if (menu === undefined) return;
      // 1. The Trigger first: a menu holding focus closes by its own rule, and the platform
      // records this Trigger as the focus-return target of the menu about to open.
      if (target.ownerDocument.activeElement !== target) {
        if (pointer) target.focus({ focusVisible: false } as FocusOptions);
        else focusWithRing(target);
      }
      // 2. Every other menu of the bar, at once.
      for (const [trigger, other] of menus) {
        if (trigger !== target) closeMenu(other, event);
      }
      // 3. The target's open, unless it is disabled.
      if (!menu.disabled()) menu.open(event, focus);
    };
    return {
      register: (trigger, menu) => {
        menus.set(trigger, menu);
        return () => {
          if (menus.get(trigger) === menu) menus.delete(trigger);
        };
      },
      switchTo,
      step: (from, delta, event) => {
        const triggers = sortByDocumentOrder([...menus.keys()], (el) => el);
        const index = triggers.indexOf(from);
        if (index < 0) return;
        const last = triggers.length - 1;
        let next = index + delta;
        if (next > last) next = latestLoop.current ? 0 : last;
        else if (next < 0) next = latestLoop.current ? last : 0;
        const target = triggers[next];
        if (target === undefined || target === from) return;
        switchTo(target, "first", event, false);
      },
      otherIntended: (trigger) => {
        for (const [other, menu] of menus) {
          if (other !== trigger && menu.intended() && !menu.hiddenBeforeToggle()) return true;
        }
        return false;
      },
      rtl: () => {
        const root = rootRef.current;
        return root !== null && getComputedStyle(root).direction === "rtl";
      },
    };
  }, [latestLoop]);

  useEffect(() => {
    if (isDev && registry.current.size === 0) {
      console.error(
        "Menubar: no menu of the bar after mount. Put Menu.Root elements, each with a " +
          "Menu.Trigger, directly inside the Menubar.",
      );
    }
  }, []);

  // On a Trigger whose menu is intended open, the engine's move is a switch with focus left on
  // the Trigger it moved to (design 2.3).
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const menu = registry.current.get(target);
    const menuMode = menu !== undefined && !event.defaultPrevented && menu.intended();
    roving.onKeyDown(event);
    if (!menuMode || !event.defaultPrevented) return;
    const focused = target.ownerDocument.activeElement;
    if (focused instanceof HTMLElement && focused !== target && registry.current.has(focused)) {
      context.switchTo(focused, "none", event.nativeEvent, false);
    }
  };

  // Focus leaving the bar (its popups are DOM descendants, so focus in a menu is inside) hides a
  // menu still shown and supersedes a pending open (design 4). A null `relatedTarget` (window
  // blur, a removed element) closes nothing.
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    roving.onBlur(event);
    const next = event.relatedTarget;
    if (!(next instanceof Node) || event.currentTarget.contains(next)) return;
    for (const menu of registry.current.values()) closeMenu(menu, event.nativeEvent);
  };

  const element = useRender<ComponentPropsWithRef<"div">, MenubarState>({
    defaultElement: "div",
    render,
    state: STATE,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      role: "menubar",
      onKeyDown,
      onFocus: roving.onFocus,
      onBlur,
      onPointerDown: roving.onPointerDown,
    },
    ref: rootRef,
  });

  return <MenubarContext value={context}>{element}</MenubarContext>;
}

Menubar.displayName = "Menubar";
