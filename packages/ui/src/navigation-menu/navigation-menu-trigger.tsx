"use client";
import type { ComponentPropsWithRef } from "react";
import { usePopoverTrigger } from "../internal/overlay/use-popover-trigger.js";
import { useRender } from "../internal/use-render.js";
import type { PopoverTriggerProps, PopoverTriggerState } from "../popover/popover-trigger.js";
import { useNavigationMenuItemContext } from "./navigation-menu-context.js";

/**
 * State of `NavigationMenu.Trigger`: Popover.Trigger's (design 6), passed to the function forms
 * of `className`, `style`, `children` and `render`.
 */
export type NavigationMenuTriggerState = PopoverTriggerState;

/**
 * Props of `NavigationMenu.Trigger`: Popover.Trigger's, unchanged (design 6).
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export type NavigationMenuTriggerProps = PopoverTriggerProps;

/**
 * The toggle of one panel: `<button type="button" popovertarget>` with no `aria-expanded` (the
 * browser exposes the popover's state on its invoker). Opens on a click (Enter, Space); never on
 * hover. In JS-free mode the browser toggles the panel and the Popup keeps `data-open` current;
 * in library mode the click is cancelled and dispatched through the Item's transition, with
 * optimistic `data-open` and `data-pending` until the change has landed.
 *
 * Owned keys (conventions 1.2), Popover.Trigger's, omitted from the props type: `type`,
 * `aria-disabled` (library mode, link or component `render`), `popoverTarget`, `aria-expanded`,
 * `onClick` (library mode); `commandfor`, `command` and `popoverTargetAction` (never written).
 * Also owned: `disabled`, `data-open`, `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export function NavigationMenuTrigger({
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: NavigationMenuTriggerProps) {
  const ctx = useNavigationMenuItemContext("NavigationMenu.Trigger");
  const { state, libraryProps, ref } = usePopoverTrigger(ctx, {
    part: "NavigationMenu.Trigger",
    disabled,
    render,
  });

  return useRender<ComponentPropsWithRef<"button">, NavigationMenuTriggerState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref,
  });
}

NavigationMenuTrigger.displayName = "NavigationMenuTrigger";
