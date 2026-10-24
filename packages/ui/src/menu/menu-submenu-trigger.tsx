"use client";
import { useCallback } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
} from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useLatest } from "../internal/use-latest.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { usePopoverTrigger } from "../internal/use-popover-trigger.js";
import { useRender } from "../internal/use-render.js";
import { registerSubmenuHover, useMenuContext } from "./menu-context.js";
import { hasModifier, isRtl } from "./menu-dom.js";
import { scheduleHoverClose } from "./menu-hover.js";
import type { MenuItemProps } from "./menu-item.js";
import { openMenuWithFocus } from "./menu-trigger.js";
import type { MenuTriggerState } from "./menu-trigger.js";
import { useMenuItem } from "./use-menu-item.js";

const isDev = process.env.NODE_ENV !== "production";

export type MenuSubmenuTriggerState = MenuTriggerState;

export interface MenuSubmenuTriggerProps extends Omit<
  MenuItemProps,
  | "action"
  | "closeOnActivate"
  | "aria-expanded"
  | "aria-haspopup"
  | "commandfor"
  | "command"
  | "popoverTarget"
  | "popoverTargetAction"
  | "onPointerEnter"
  | "onPointerLeave"
  | "className"
  | "style"
  | "children"
  | "render"
> {
  className?: StateValue<string | undefined, MenuSubmenuTriggerState>;
  style?: StateValue<CSSProperties | undefined, MenuSubmenuTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, MenuSubmenuTriggerState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuSubmenuTriggerState>;
}

/**
 * The item that opens a submenu: an item of the parent menu (`role="menuitem"`, roving
 * `tabindex`, typeahead) and the Trigger of the submenu's Root (`popovertarget`,
 * `aria-haspopup="menu"`; no `aria-expanded`: the browser exposes the submenu's state on its
 * invoker, #121). ArrowRight (ArrowLeft in
 * RTL), Enter, Space or a click open the submenu with its first item focused; hovering it opens
 * the submenu after the Root's `delay` and leaves focus where it is.
 *
 * Owned keys (conventions 1.2): the Trigger's (`type`, `id`, `popoverTarget`,
 * `aria-haspopup`, `aria-expanded`, `data-open`, `data-pending`; `commandfor`, `command` and
 * `popoverTargetAction`, never written) and the item's (`role`,
 * `tabIndex`, `disabled` (absent), `aria-disabled`, `data-disabled`, `data-typeahead`,
 * `onClick`, `onKeyDown`, `onPointerMove`, `onPointerEnter`, `onPointerLeave`).
 */
export function MenuSubmenuTrigger({
  disabled = false,
  label,
  className,
  style,
  children,
  render,
  ...rest
}: MenuSubmenuTriggerProps) {
  const menu = useMenuContext("Menu.SubmenuTrigger");
  useDevWarning(
    !menu.submenu,
    isDev &&
      "Menu.SubmenuTrigger: rendered in a top-level Menu.Root. Use Menu.Trigger, or put this Root " +
        "inside the parent's Menu.Popup.",
  );

  const open = (event: Event) => openMenuWithFocus(menu, event, "first");

  // The item half: role, roving tabindex, aria-disabled, Enter / Space, pointer focus. Its
  // activation is the click, which the trigger half handles (`activate` below), so the item's own
  // `onClick` is not used.
  const item = useMenuItem({
    part: "Menu.SubmenuTrigger",
    role: "menuitem",
    disabled,
    label,
  });

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || hasModifier(event) || disabled) return;
    const parentPopup = event.currentTarget.closest('[role="menu"]');
    const forward = parentPopup !== null && isRtl(parentPopup) ? "ArrowLeft" : "ArrowRight";
    if (event.key !== forward) return;
    event.preventDefault();
    open(event.nativeEvent);
  };

  // Hover intent (design/components/menu.md 7), shared by the pointer handlers and a
  // press-drag-release gesture of a context menu, whose captured pointer never enters this element
  // (context-menu.md 2.6).
  const hoverEnter = (native: Event) => {
    if (disabled) return;
    menu.timers.open(menu.delay, () => {
      menu.setOpenCause("none");
      menu.popover.requestOpen(native, "activate");
    });
  };
  const hoverLeave = (native: Event) => {
    // Leaving before the open delay cancels it; leaving an open submenu's trigger starts the
    // close delay (cancelled by entering the submenu).
    if (menu.popover.intended()) scheduleHoverClose(menu, native);
    else menu.timers.cancel();
  };
  const submenuPopupRef = menu.popover.popupRef;
  const latestHover = useLatest({ enter: hoverEnter, leave: hoverLeave });
  const hoverRef = useCallback(
    (element: HTMLElement) =>
      registerSubmenuHover(element, {
        enter: (event) => latestHover.current.enter(event),
        leave: (event) => latestHover.current.leave(event),
        popup: () => submenuPopupRef.current,
      }),
    [latestHover, submenuPopupRef],
  );

  const {
    state,
    libraryProps,
    ref: triggerRef,
  } = usePopoverTrigger(menu.popover, {
    part: "Menu.SubmenuTrigger",
    disabled,
    render,
    disabledAs: "aria",
    // Item first (Enter / Space activation, pointer focus), then the submenu keys.
    handlers: {
      onKeyDown: (event) => {
        item.libraryProps.onKeyDown(event);
        onKeyDown(event);
      },
      onPointerMove: item.libraryProps.onPointerMove,
      onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType !== "touch") hoverEnter(event.nativeEvent);
      },
      onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType !== "touch") hoverLeave(event.nativeEvent);
      },
    },
    // A click opens (or moves focus into the open submenu); it never closes.
    activate: (event) => open(event.nativeEvent),
    opensOnly: true,
  });
  const ref = useMergedRefs(triggerRef, hoverRef);

  return useRender<ComponentPropsWithRef<"button">, MenuSubmenuTriggerState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      ...libraryProps,
      role: item.libraryProps.role,
      tabIndex: item.libraryProps.tabIndex,
      "data-typeahead": item.libraryProps["data-typeahead"],
      id: menu.triggerId,
      "aria-haspopup": "menu",
    },
    ref,
  });
}

MenuSubmenuTrigger.displayName = "MenuSubmenuTrigger";
