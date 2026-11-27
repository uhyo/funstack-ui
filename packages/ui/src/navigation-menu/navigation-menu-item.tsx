"use client";
import { useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import { popoverDetails, usePopoverRoot } from "../internal/overlay/use-overlay-root.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
  UrgentChangeHandler,
} from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { NavigationMenuItemContext } from "./navigation-menu-context.js";

/** Details passed as the second argument of `openChangeAction` and `onOpenChange`. */
export interface NavigationMenuOpenChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the Trigger, a followed `NavigationMenu.Link`, a foreign invoker.
   * `"dismiss"`: Escape, a press outside, another panel opening, focus leaving the Item, script.
   * `"platform"`: the panel was found open on mount (opened before hydration); `event` is
   * `undefined`.
   */
  readonly reason: ChangeReason;
}

/**
 * State of `NavigationMenu.Item`, passed to the function forms of `className`, `style`,
 * `children` and `render`.
 */
export interface NavigationMenuItemState {
  /** Optimistic open state (library mode); `false` in JS-free mode. */
  readonly open: boolean;
  /** An `openChangeAction` dispatched through this Item is in flight (library mode only). */
  readonly pending: boolean;
}

/**
 * Props of `NavigationMenu.Item`.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export interface NavigationMenuItemProps extends Omit<
  ComponentPropsWithRef<"li">,
  "className" | "style" | "children"
> {
  /**
   * Controlled open state of this Item's panel. `undefined` means uncontrolled (and, with
   * `defaultOpen`, `openChangeAction` and `onOpenChange` also absent, JS-free mode). A controlled
   * Item needs `onOpenChange` too: the browser closes the panel without asking.
   */
  open?: boolean;
  /** Initial open state in uncontrolled library mode. Opens after hydration, never in the HTML. */
  defaultOpen?: boolean;
  /**
   * Requests only: the Trigger's toggle and a followed Link's close. Awaited: the panel opens
   * when it resolves and the content has rendered, and closes when a close resolves. May be a
   * Server Function. Rejections reach the nearest Error Boundary above the Item.
   */
  openChangeAction?: ChangeAction<boolean, NavigationMenuOpenChangeDetails>;
  /**
   * Facts only: the panel was dismissed (Escape, a press outside, another panel opening, focus
   * leaving the Item, script). Always `false`, called synchronously, outside any Transition, and
   * not awaited. Controlled: set your state directly here (`onOpenChange={setOpen}`).
   */
  onOpenChange?: UrgentChangeHandler<boolean, NavigationMenuOpenChangeDetails>;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, NavigationMenuItemState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, NavigationMenuItemState>;
  /** A Trigger and its Popup, or a Link. The function form receives the optimistic state. */
  children?: StateValue<ReactNode, NavigationMenuItemState>;
  /** Replace the default `<li>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"li">, NavigationMenuItemState>;
}

/**
 * One top-level entry, an `<li>`, and the owner of one flyout: the id the Trigger and Popup share
 * and the open state, with Popover's two modes (design 2). Without `open`, `defaultOpen`,
 * `openChangeAction` and `onOpenChange` the Item runs in **JS-free mode**: the browser toggles
 * the panel. With any of them it runs in **library mode**: opening and the closes a part asks for
 * (Trigger, a followed Link) are requests through `openChangeAction`; dismissals are facts for
 * `onOpenChange`.
 *
 * Focus leaving the Item (to an element outside it) closes its panel (design 3.2): a shown panel
 * is hidden at once (a `"dismiss"` fact), an open still pending is superseded by a `"dismiss"`
 * request. The `focusout` listener is attached through the ref, so `onBlur` stays the
 * consumer's. An Item with only a Link in it is a plain `<li>`.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export function NavigationMenuItem({
  open,
  defaultOpen,
  openChangeAction,
  onOpenChange,
  className,
  style,
  children,
  render,
  ...rest
}: NavigationMenuItemProps) {
  const context = usePopoverRoot<NavigationMenuOpenChangeDetails>({
    component: "navigation-menu",
    part: "NavigationMenu.Item",
    open,
    defaultOpen,
    openChangeAction,
    onOpenChange,
    details: popoverDetails,
  });
  const { mode, popupRef, intended, requestClose, recordCloseIntent } = context;

  // The focus-leave close (design 3.2, Menu's Tab rule on the `li`). A null `relatedTarget`
  // (window blur, a removed element) closes nothing.
  const ref = useCallback(
    (element: HTMLElement) => {
      const onFocusOut = (event: FocusEvent) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || element.contains(next)) return;
        const popup = popupRef.current;
        if (popup !== null && isPopoverOpen(popup)) {
          // A fact in library mode, named by this event; a DOM-level hide in JS-free mode.
          if (mode === "library") recordCloseIntent({ reason: "dismiss", event });
          popup.hidePopover();
        } else if (mode === "library" && intended()) {
          requestClose(event, "dismiss");
        }
      };
      element.addEventListener("focusout", onFocusOut);
      return () => element.removeEventListener("focusout", onFocusOut);
    },
    [mode, popupRef, intended, requestClose, recordCloseIntent],
  );

  const state: NavigationMenuItemState = { open: context.optimistic, pending: context.pending };

  const element = useRender<ComponentPropsWithRef<"li">, NavigationMenuItemState>({
    defaultElement: "li",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    ref,
  });

  return <NavigationMenuItemContext value={context}>{element}</NavigationMenuItemContext>;
}

NavigationMenuItem.displayName = "NavigationMenuItem";
