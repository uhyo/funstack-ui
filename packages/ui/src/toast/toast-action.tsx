"use client";
import { useLayoutEffect, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import type { Action, RenderProp, StateValue } from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import type { ToastActionDetails, ToastItem } from "./toast.js";
import { useToastRootContext } from "./toast-context.js";

export interface ToastActionState {
  /** This part's action is in flight. */
  readonly pending: boolean;
  readonly toast: ToastItem;
}

export interface ToastActionProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "className" | "style" | "children"
> {
  /**
   * Runs in this part's own transition: `data-pending` on the Action and the Root, the toast's
   * timer paused. When it resolves the toast closes with `reason: "activate"` (unless
   * `closeOnSettle` is `false`); a rejection keeps the toast and reaches the nearest Error
   * Boundary above the Viewport. A caught error counts as success and closes the toast: rethrow
   * after `toast.update`, or use `closeOnSettle={false}`. Default: the toast's `action.action`.
   */
  action?: Action<[details: ToastActionDetails]>;
  /** Close the toast when the action resolves. Default `true`. */
  closeOnSettle?: boolean;
  /** Default: the toast's `action.label`. */
  children?: StateValue<ReactNode, ToastActionState>;
  className?: StateValue<string | undefined, ToastActionState>;
  style?: StateValue<CSSProperties | undefined, ToastActionState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, ToastActionState>;
}

/**
 * The toast's action button (Undo, Retry, View): a `button type="button"` whose `action` runs as
 * a transition. Renders nothing when neither the part nor the toast has an action. Never natively
 * disabled while pending: a second click meanwhile is ignored and the Action is `aria-disabled`.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `onClick`, `aria-disabled`,
 * `data-pending`.
 */
export function ToastAction({
  action,
  closeOnSettle = true,
  children,
  className,
  style,
  render,
  ...rest
}: ToastActionProps) {
  const root = useToastRootContext("Toast.Action");
  const { pending, run } = useActionTrigger();
  const [token] = useState(() => ({}));
  const effective = action ?? root.toast.action?.action;
  const { setActionPending } = root;

  // The Root (and through it the Viewport's timer) sees this part's pending state.
  useLayoutEffect(() => {
    if (!pending) return;
    setActionPending(token, true);
    return () => setActionPending(token, false);
  }, [pending, setActionPending, token]);

  const state: ToastActionState = { pending, toast: root.toast };

  const onClick = (event: MouseEvent<HTMLElement>): void => {
    if (effective === undefined || rest.disabled === true) return;
    const native = event.nativeEvent;
    const details = createActionDetails(native, { id: root.toast.id });
    // A second click while this Action's own run is in flight starts nothing and is cancelled
    // (the hook's guard): one Undo, one Retry.
    const started = run(
      () => effective(details),
      () => {
        // Closing is idempotent: a dismissal meanwhile already closed it.
        if (closeOnSettle) root.close("activate", native);
      },
    );
    if (!started) event.preventDefault();
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    onClick,
    // Exactly while `data-pending`. Owned, so an idle Action removes a render element's own.
    "aria-disabled": pending ? true : undefined,
    "data-pending": dataAttr(pending),
  };

  const element = useRender<ComponentPropsWithRef<"button">, ToastActionState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children: children ?? root.toast.action?.label,
    props: rest,
    libraryProps,
  });
  return effective === undefined ? null : element;
}

ToastAction.displayName = "ToastAction";
