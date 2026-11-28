"use client";
import { useCallback } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { useMenubarContext } from "../internal/menubar-context.js";
import type { MenubarOpenFocus } from "../internal/menubar-context.js";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import { useToolbarContext } from "../internal/toolbar-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useLatest } from "../internal/use-latest.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { toggleFromTrigger, usePopoverTrigger } from "../internal/overlay/use-popover-trigger.js";
import type { PopoverTriggerHookState } from "../internal/overlay/use-popover-trigger.js";
import { useRender } from "../internal/use-render.js";
import { useMenuContext } from "./menu-context.js";
import type { MenuContextValue } from "./menu-context.js";
import { edgeItem, focusItem, hasModifier, isRtl } from "./menu-dom.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Menu.Trigger`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export type MenuTriggerState = PopoverTriggerHookState;

/**
 * Props of `Menu.Trigger`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export interface MenuTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "onClick"
  | "onKeyDown"
  | "onMouseDown"
  | "type"
  | "aria-disabled"
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
   * component `render`, and inside a `Menubar` or a `Toolbar.Root` (conventions 3.6),
   * `aria-disabled="true"` instead (the element stays focusable).
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenuTriggerState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenuTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, MenuTriggerState>;
  /**
   * Should render a `<button>` (the `popovertarget` path before hydration). Another element works
   * through the click handler, but a press on it while the menu is open is a light dismiss rather
   * than the awaited close.
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
 * A switch's open (design/components/menubar.md 2.2 step 3): the first item focused when the menu
 * shows (or at once, when it is already shown), or focus left on the Trigger.
 */
function openFromBar(menu: MenuContextValue, event: Event, focus: MenubarOpenFocus): void {
  if (focus === "first") {
    openMenuWithFocus(menu, event, "first");
    return;
  }
  if (menu.popover.intended()) return;
  menu.setOpenCause("none");
  menu.popover.requestOpen(event, "activate");
}

/**
 * The menu button: `<button type="button" popovertarget aria-haspopup="menu">`, with no
 * `aria-expanded` (the browser exposes the menu's state on its invoker; a link or other non-button
 * element, or a disabled component `render`, renders it from the shown menu). A click (Enter,
 * Space) toggles the menu through the Root's transition; ArrowDown / ArrowUp open it with the
 * first / last item focused (inside a vertical `Toolbar.Root`: the inline-end arrow, with the
 * first item focused).
 *
 * Inside a `Menubar` it is an item of the bar (design/components/menubar.md): `role="menuitem"`,
 * no rendered `tabindex` (the bar writes it), and `disabled` as `aria-disabled="true"` (it stays
 * focusable and never opens). Moving the pointer onto it while another menu of the bar is open
 * switches to its menu.
 *
 * Owned keys (conventions 1.2), omitted from the props type: `type` (on a `<button>` only),
 * `aria-disabled` (link or component `render`, and in a Menubar or a Toolbar), `popoverTarget`,
 * `aria-haspopup`, `aria-expanded`, `onClick`, `onKeyDown`, `onMouseDown`; `commandfor`,
 * `command` and `popoverTargetAction` (never written). Also owned: `id`, `disabled`,
 * `data-open`, `data-pending`, `data-disabled`, and in a Menubar `role`. In a Menubar the hover switch is an
 * `onPointerMove` handler merged with the consumer's (theirs runs first).
 *
 * @see https://ui.funstack.work/components/menu
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

  // An item of an enclosing Menubar (design/components/menubar.md 1); the bar's context ends at
  // each Menu.Popup, so a Trigger in a menu never sees it.
  const bar = useMenubarContext();
  const inBar = bar !== null;
  // Inside a vertical Toolbar, ArrowDown / ArrowUp are the Toolbar's: the trigger opens on the
  // inline-end arrow instead, as a submenu trigger does (design/components/toggle-group.md 7.4).
  const toolbar = useToolbarContext();
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || hasModifier(event)) return;
    let which: "first" | "last";
    if (!inBar && toolbar?.orientation === "vertical") {
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

  // The menu as the bar sees it (menubar.md 2.1), read through the latest render.
  const latest = useLatest({ menu, disabled });
  const barRef = useCallback(
    (element: HTMLElement) =>
      bar?.register(element, {
        disabled: () => latest.current.disabled,
        intended: () => latest.current.menu.popover.intended(),
        hiddenBeforeToggle: () => latest.current.menu.popover.hiddenBeforeToggle(),
        popup: () => latest.current.menu.popover.popupRef.current,
        open: (event, focus) => openFromBar(latest.current.menu, event, focus),
        supersede: (event) => latest.current.menu.popover.requestClose(event, "dismiss"),
      }),
    [bar, latest],
  );

  // Menu mode (menubar.md 2.3, 4): the pointer moving onto this Trigger while another menu of the
  // bar is intended open switches to this menu, focus left on the Trigger. `pointermove`, not
  // `pointerenter`: a menu appearing under a resting pointer is no move.
  const onPointerMove =
    bar === null
      ? undefined
      : (event: PointerEvent<HTMLButtonElement>) => {
          if (event.pointerType === "touch" || disabled || menu.popover.intended()) return;
          const element = event.currentTarget;
          if (!bar.otherIntended(element)) return;
          bar.switchTo(element, "none", event.nativeEvent, true);
        };

  const {
    state,
    libraryProps,
    ref: triggerRef,
  } = usePopoverTrigger(menu.popover, {
    part: "Menu.Trigger",
    disabled,
    render,
    // An item of a Menubar, or of a Toolbar (conventions 3.6): disabled stays focusable.
    alwaysFocusable: inBar || toolbar !== null,
    handlers: {
      onKeyDown,
      // Only in a bar: an `undefined` key in the owned layer would remove the consumer's handler.
      ...(onPointerMove !== undefined && { onPointerMove }),
      onMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => {
        // A press on the Trigger of an open menu must not move focus out of the popup: the Popup's
        // focusout would hide the menu before the click's library-owned close (design 2.2).
        if (event.button === 0 && menu.popover.intended()) event.preventDefault();
      },
    },
    // The default toggle, with the open cause recorded right before an open.
    onActivate: (event) =>
      toggleFromTrigger(menu.popover, event.nativeEvent, () =>
        menu.setOpenCause("first", isPointerClick(event.nativeEvent)),
      ),
  });

  const ref = useMergedRefs(triggerRef, barRef);

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
      ...(inBar && { role: "menuitem" }),
      id: menu.triggerId,
      "aria-haspopup": "menu",
    },
    ref,
  });
}

MenuTrigger.displayName = "MenuTrigger";
