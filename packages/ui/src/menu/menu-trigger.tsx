"use client";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { isPopoverOpen } from "../internal/popover-open.js";
import { useToolbarContext } from "../internal/toolbar-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { usePopoverTrigger } from "../internal/use-popover-trigger.js";
import type { PopoverTriggerHookState } from "../internal/use-popover-trigger.js";
import { useRender } from "../internal/use-render.js";
import { useMenuContext } from "./menu-context.js";
import type { MenuContextValue } from "./menu-context.js";
import { edgeItem, focusItem, hasModifier, isRtl } from "./menu-dom.js";

const isDev = process.env.NODE_ENV !== "production";

export type MenuTriggerState = PopoverTriggerHookState;

export interface MenuTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "onClick"
  | "onKeyDown"
  | "onMouseDown"
  | "aria-expanded"
  | "aria-haspopup"
  | "commandfor"
  | "command"
  | "popoverTarget"
  | "popoverTargetAction"
  | "className"
  | "style"
  | "children"
> {
  /**
   * The menu cannot be opened from this button. Native `disabled` on a `<button>`; with a link or
   * component `render`, `aria-disabled="true"` instead (the element stays focusable).
   */
  disabled?: boolean;
  className?: StateValue<string | undefined, MenuTriggerState>;
  style?: StateValue<CSSProperties | undefined, MenuTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, MenuTriggerState>;
  /**
   * Should render a `<button>` (the `popovertarget` path before hydration). Another element works through
   * the click handler, but a press on it while the menu is open is a light dismiss rather than the
   * awaited close.
   */
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuTriggerState>;
}

/**
 * Opens with the first (`"first"`) or last (`"last"`) item focused, or focuses that item when the
 * menu is already open (a pre-hydration open, design walkthrough 10). Shared with SubmenuTrigger.
 */
export function openMenuWithFocus(
  menu: MenuContextValue,
  event: Event,
  which: "first" | "last",
): void {
  const { popover } = menu;
  if (popover.intended()) {
    const popup = popover.popupRef.current;
    if (popup !== null && isPopoverOpen(popup)) {
      const item = edgeItem(popup, which);
      if (item !== null) focusItem(item);
    }
    return;
  }
  menu.setOpenCause(which, isPointerClick(event));
  popover.requestOpen(event, "activate");
}

/** A click from a pointing device (`detail` counts clicks; keyboard and `click()` give 0). */
function isPointerClick(event: Event): boolean {
  return event.type === "click" && (event as MouseEvent).detail > 0;
}

/**
 * The menu button: `<button type="button" popovertarget aria-haspopup="menu">`, with no
 * `aria-expanded` (the browser exposes the menu's state on its invoker, #121; a link or component
 * `render` renders it from the shown menu). A click (Enter, Space) toggles the menu through the
 * Root's transition; ArrowDown / ArrowUp open it with the first / last item focused (inside a
 * vertical `Toolbar.Root`: the inline-end arrow, with the first item focused).
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `id`, `disabled`, `aria-disabled`
 * (link or component `render`), `popoverTarget`, `aria-haspopup`, `aria-expanded`, `onClick`,
 * `onKeyDown`, `onMouseDown`, `data-open`, `data-pending`, `data-disabled`; `commandfor`,
 * `command` and `popoverTargetAction` are reserved.
 */
export function MenuTrigger({
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: MenuTriggerProps) {
  const menu = useMenuContext("Menu.Trigger");
  useDevWarning(
    menu.submenu,
    isDev &&
      "Menu.Trigger: rendered in a submenu. Use Menu.SubmenuTrigger, which is also an item of the " +
        "parent menu.",
  );

  // Inside a vertical Toolbar, ArrowDown / ArrowUp are the Toolbar's: the trigger opens on the
  // inline-end arrow instead, as a submenu trigger does (design/components/toggle-group.md 7.4).
  const toolbar = useToolbarContext();
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || hasModifier(event)) return;
    let which: "first" | "last";
    if (toolbar?.orientation === "vertical") {
      const openKey = isRtl(event.currentTarget) ? "ArrowLeft" : "ArrowRight";
      if (event.key !== openKey) return;
      which = "first";
    } else {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      which = event.key === "ArrowDown" ? "first" : "last";
    }
    // No page scroll, and an enclosing Toolbar sees `defaultPrevented`; Enter and Space stay the
    // native click.
    event.preventDefault();
    openMenuWithFocus(menu, event.nativeEvent, which);
  };

  const { state, libraryProps, ref } = usePopoverTrigger(menu.popover, {
    part: "Menu.Trigger",
    disabled,
    render,
    handlers: {
      onKeyDown,
      onMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => {
        // A press on the Trigger of an open menu must not move focus out of the popup: the Popup's
        // focusout would hide the menu before the click's library-owned close (design 2.2, #110).
        if (event.button === 0 && menu.popover.intended()) event.preventDefault();
      },
    },
    activate: (event) => {
      const native = event.nativeEvent;
      if (menu.popover.intended()) {
        menu.popover.requestClose(native, "activate");
      } else {
        menu.setOpenCause("first", isPointerClick(native));
        menu.popover.requestOpen(native, "activate");
      }
    },
  });

  return useRender<ComponentPropsWithRef<"button">, MenuTriggerState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      ...libraryProps,
      id: menu.triggerId,
      "aria-haspopup": "menu",
    },
    ref,
  });
}

MenuTrigger.displayName = "MenuTrigger";
