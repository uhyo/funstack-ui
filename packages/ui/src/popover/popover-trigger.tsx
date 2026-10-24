"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { usePopoverTrigger } from "../internal/use-popover-trigger.js";
import type { PopoverTriggerHookState } from "../internal/use-popover-trigger.js";
import { useRender } from "../internal/use-render.js";
import { usePopoverContext } from "./popover-context.js";

export type PopoverTriggerState = PopoverTriggerHookState;

export interface PopoverTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "onClick"
  | "aria-expanded"
  | "commandfor"
  | "command"
  | "popoverTarget"
  | "popoverTargetAction"
  | "className"
  | "style"
  | "children"
> {
  /**
   * Never dispatches. Native `disabled` on a `<button>` (no longer an invoker); in library mode
   * with a link or component `render`, `aria-disabled="true"` instead: the element stays
   * focusable.
   */
  disabled?: boolean;
  className?: StateValue<string | undefined, PopoverTriggerState>;
  style?: StateValue<CSSProperties | undefined, PopoverTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, PopoverTriggerState>;
  /**
   * Should render a `<button>`; another element works only in library mode (click handler), and
   * a press on it while the popup is open is a light dismiss rather than the awaited close.
   */
  render?: RenderProp<ComponentPropsWithRef<"button">, PopoverTriggerState>;
}

/**
 * The toggle: `<button type="button" popovertarget>`, with no `aria-expanded`: the browser exposes
 * the popover's state on its invoker (#121). In JS-free mode the browser toggles the popover and
 * the Popup keeps `data-open` current. In library mode the click is cancelled (so the toggle does
 * not run) and dispatched through the Root's transition: an open, or a library-owned close while
 * open. The button shows optimistic `data-open` and `data-pending` until the change has landed; a
 * non-button `render` renders `aria-expanded` from the shown popup (in the top layer, #118).
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `aria-disabled`
 * (library mode, link or component `render`), `popoverTarget`, `aria-expanded`,
 * `onClick` (library mode), `data-open`, `data-pending`, `data-disabled`; `commandfor`,
 * `command` and `popoverTargetAction` (never written; omitted from the props type). `aria-haspopup` and `aria-controls` pass
 * through.
 */
export function PopoverTrigger({
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: PopoverTriggerProps) {
  const ctx = usePopoverContext("Popover.Trigger");
  const { state, libraryProps, ref } = usePopoverTrigger(ctx, {
    part: "Popover.Trigger",
    disabled,
    render,
  });

  return useRender<ComponentPropsWithRef<"button">, PopoverTriggerState>({
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

PopoverTrigger.displayName = "PopoverTrigger";
