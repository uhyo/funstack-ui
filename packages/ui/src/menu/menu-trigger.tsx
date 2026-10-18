"use client";
import type { ComponentPropsWithRef, CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useToolbarContext } from "../internal/toolbar-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { usePopoverTrigger } from "../internal/use-popover-trigger.js";
import { useRender } from "../internal/use-render.js";
import { useMenuContext } from "./menu-context.js";
import type { MenuContextValue } from "./menu-context.js";
import { edgeItem, focusItem, hasModifier, isRtl } from "./menu-dom.js";

export interface MenuTriggerState {
  /** Optimistic open state. */
  readonly open: boolean;
  /** The Root's transition is pending (an open, a part-initiated close or a dismissal notification). */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface MenuTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "onKeyDown" | "aria-expanded" | "aria-haspopup" | "className" | "style" | "children"
> {
  /** Native `disabled`: the menu cannot be opened from this button. */
  disabled?: boolean;
  className?: StateValue<string | undefined, MenuTriggerState>;
  style?: StateValue<CSSProperties | undefined, MenuTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, MenuTriggerState>;
  /** Should render a `<button>` (the command path before hydration). */
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuTriggerState>;
}

/**
 * Opens with the first (`"first"`) or last (`"last"`) item focused, or focuses that item when the
 * menu is already open (a pre-hydration open, walkthrough 10). Shared with SubmenuTrigger.
 */
export function openMenuWithFocus(
  menu: MenuContextValue,
  event: Event,
  which: "first" | "last",
): void {
  const { popover } = menu;
  if (popover.intended()) {
    const popup = popover.popupRef.current;
    if (popup !== null && popup.matches(":popover-open")) {
      const item = edgeItem(popup, which);
      if (item !== null) focusItem(item);
    }
    return;
  }
  menu.setOpenCause(which, isPointerClick(event));
  popover.requestOpen(event, "activate");
}

/** A click from a pointing device (`detail` counts clicks; keyboard and `click()` give 0). */
export function isPointerClick(event: Event): boolean {
  return event.type === "click" && (event as MouseEvent).detail > 0;
}

/**
 * The menu button: `<button type="button" commandfor command="toggle-popover"
 * aria-haspopup="menu" aria-expanded>`. A click (Enter, Space) toggles the menu through the
 * Root's transition; ArrowDown / ArrowUp open it with the first / last item focused (inside a
 * vertical `Toolbar.Root`: the inline-end arrow, with the first item focused).
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `id`, `disabled`, `commandfor`,
 * `command`, `aria-haspopup`, `aria-expanded`, `onClick`, `onKeyDown`, `data-open`,
 * `data-pending`, `data-disabled`.
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
    handlers: { onKeyDown },
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
